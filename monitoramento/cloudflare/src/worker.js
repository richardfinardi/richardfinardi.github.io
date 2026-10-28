import { DurableObject } from "cloudflare:workers";
import config from "../../config.json";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8"
};
const LIMIT_MS = Number(config.limite_lentidao_ms || 2500);
const FAILURE_LIMIT = Number(config.falhas_para_alerta || 3);

async function probe(monitor) {
  const started = Date.now();
  let http = null;
  let erro = "";
  try {
    const response = await fetch(monitor.url, {
      method: "GET",
      redirect: "manual",
      headers: { "Accept": "application/json", "User-Agent": "Auvriun-API-Monitor/1.0" },
      signal: AbortSignal.timeout(12000)
    });
    http = response.status;
    if (!response.ok) throw new Error("HTTP " + http);
    if (monitor.tipo === "fastapi") {
      const result = await response.json();
      if (!result || typeof result !== "object" || !result.openapi)
        throw new Error("Resposta nao e OpenAPI valida");
    } else {
      await response.body?.cancel();
    }
    return { ok: true, http, tempo_ms: Date.now() - started, erro };
  } catch (error) {
    erro = (error?.name === "TimeoutError" ? "Tempo limite de 12s excedido" : String(error?.message || error)).slice(0, 190);
    return { ok: false, http, tempo_ms: Date.now() - started, erro };
  }
}

async function sendEmail(event, env) {
  if (!env.RESEND_API_KEY || !env.ALERT_EMAIL_TO || !env.ALERT_EMAIL_FROM) return null;
  const subject = event.tipo === "queda" ? "[RF Monitor] API FORA DO AR: " + event.nome :
    "[RF Monitor] API RECUPERADA: " + event.nome;
  const description = event.tipo === "queda" ? "Falha confirmada em 3 verificacoes consecutivas." :
    "API voltou a responder corretamente.";
  const body = description + "\n\nCliente: " + event.nome + "\n" +
    "Endereco: " + event.url + "\n" +
    "Horario (UTC): " + event.em + "\n" +
    "Detalhes: " + event.detalhe + "\n\nPainel: https://consultoriarf.net/monitoramento/";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.ALERT_EMAIL_FROM,
      to: env.ALERT_EMAIL_TO.split(",").map(x => x.trim()).filter(Boolean),
      subject, text: body
    }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Resend HTTP " + response.status + ": " + (await response.text()).slice(0, 250));
  return true;
}

export class MonitorState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.running = null;
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/status") {
      const status = await this.ctx.storage.get("status") || {
        atualizado_em: null, intervalo_minutos: config.intervalo_minutos || 5,
        monitores: [], eventos: []
      };
      return new Response(JSON.stringify(status), { status: 200, headers: CORS });
    }
    if (request.method === "POST" && path === "/run") {
      if (this.running) {
        await this.running;
      } else {
        this.running = this.run().finally(() => { this.running = null; });
        await this.running;
      }
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }
    return new Response("Not found", { status: 404 });
  }

  async run() {
    let previous = await this.ctx.storage.get("status") || { monitores: [], eventos: [] };
    // Descartar o historico inicial contaminado pelo bug redirect:"error".
    // O Worker da Cloudflare rejeita essa opcao antes de fazer a requisicao.
    const recorded = previous.monitores || [];
    if (recorded.length && recorded.every(m =>
      typeof m.erro === "string" && m.erro.startsWith("Invalid redirect value"))) {
      console.warn("Resetando verificacoes falsas geradas pelo redirect invalido.");
      previous = { monitores: [], eventos: [] };
    }
    const previousById = new Map((previous.monitores || []).map(m => [m.id, m]));
    const monitors = config.monitores.filter(m => m.ativo !== false);
    const probes = await Promise.all(monitors.map(probe));
    const now = new Date().toISOString();
    const events = (previous.eventos || []).slice(-499);
    const updated = monitors.map((monitor, idx) => {
      const p = probes[idx];
      const old = previousById.get(monitor.id) || {};
      const failures = p.ok ? 0 : (old.falhas_seguidas || 0) + 1;
      const state = p.ok ? (p.tempo_ms > LIMIT_MS ? "lento" : "online") :
        (failures >= FAILURE_LIMIT ? "offline" : "instavel");
      const past = old.estado || "aguardando";
      const item = {
        id: monitor.id, nome: monitor.nome, url: monitor.url,
        estado: state, http: p.http, tempo_ms: p.tempo_ms, erro: p.erro,
        ultima_verificacao: now,
        ultimo_sucesso: p.ok ? now : (old.ultimo_sucesso || null),
        falhas_seguidas: failures, total_testes: (old.total_testes || 0) + 1,
        testes_ok: (old.testes_ok || 0) + Number(p.ok),
        mudanca_em: past !== state ? now : (old.mudanca_em || now),
        recentes: [...(old.recentes || []), state].slice(-48)
      };
      if (state === "offline" && past !== "offline") {
        events.push({
          em: now, id: monitor.id, nome: monitor.nome, url: monitor.url,
          tipo: "queda", detalhe: p.erro || "API sem resposta correta.",
          email_enviado: false, email_tentativas: 0
        });
      } else if (p.ok && past === "offline") {
        events.push({
          em: now, id: monitor.id, nome: monitor.nome, url: monitor.url,
          tipo: "recuperacao", detalhe: "Resposta valida apos indisponibilidade.",
          email_enviado: false, email_tentativas: 0
        });
      }
      console.log(monitor.nome, state, p.http, p.tempo_ms + "ms");
      return item;
    });
    const snapshot = {
      atualizado_em: now,
      intervalo_minutos: Number(config.intervalo_minutos) || 5,
      monitores: updated, eventos: events.slice(-500)
    };
    await this.ctx.storage.put("status", snapshot);

    // Reenvio limitado: falhas do provedor nao apagam o incidente.
    if (this.env.RESEND_API_KEY && this.env.ALERT_EMAIL_TO && this.env.ALERT_EMAIL_FROM) {
      let dirty = false;
      for (const event of snapshot.eventos.filter(e =>
        !e.email_enviado && (e.email_tentativas || 0) < 3 &&
        Date.now() - Date.parse(e.em) < 86400000).slice(-5)) {
        try {
          event.email_enviado = await sendEmail(event, this.env);
          event.email_tentativas = (event.email_tentativas || 0) + 1;
          dirty = true;
        } catch (e) {
          event.email_tentativas = (event.email_tentativas || 0) + 1;
          dirty = true;
          console.error("Falha de alerta", event.nome, String(e));
        }
      }
      if (dirty) await this.ctx.storage.put("status", snapshot);
    }
  }
}

function instance(env) {
  return env.MONITOR_STATE.get(env.MONITOR_STATE.idFromName("consultoriarf-apis"));
}

export default {
  async scheduled(_event, env) {
    const response = await instance(env).fetch(new Request("https://internal.monitor/run", { method: "POST" }));
    if (!response.ok) throw new Error("Falha no monitoramento: " + response.status);
  },
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method === "GET" && path === "/status") {
      return instance(env).fetch(new Request("https://internal.monitor/status"));
    }
    if (request.method === "GET" && (path === "/" || path === "/health")) {
      const response = await instance(env).fetch(new Request("https://internal.monitor/status"));
      const data = await response.json();
      const ageMinutes = data.atualizado_em ?
        Math.round((Date.now() - Date.parse(data.atualizado_em)) / 60000) : null;
      return new Response(JSON.stringify({
        servico: "AUVRIUN Monitoramento", configurado: true,
        atualizado_em: data.atualizado_em, atraso_minutos: ageMinutes,
        dados_atrasados: ageMinutes === null || ageMinutes > 15,
        endpoint: "/status"
      }), { headers: CORS });
    }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: CORS });
  }
};
