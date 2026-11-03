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

function emailChannel(env) {
  if (env.GOOGLE_APPS_SCRIPT_URL && env.ALERT_WEBHOOK_TOKEN) return "Google Apps Script";
  if (env.RESEND_API_KEY && env.ALERT_EMAIL_TO && env.ALERT_EMAIL_FROM) return "Resend";
  return null;
}

async function sendGoogleEmail(event, env) {
  const scriptUrl = String(env.GOOGLE_APPS_SCRIPT_URL || "");
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(scriptUrl)) {
    throw new Error("GOOGLE_APPS_SCRIPT_URL invalida: use URL de implantacao /exec");
  }
  const response = await fetch(scriptUrl, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: env.ALERT_WEBHOOK_TOKEN,
      event: {
        id: event.id, nome: event.nome, url: event.url,
        tipo: event.tipo, em: event.em, detalhe: event.detalhe
      }
    }),
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error("Google Apps Script HTTP " + response.status);
  let result;
  try {
    result = await response.json();
  } catch (_) {
    throw new Error("Google Apps Script retornou resposta nao-JSON; verifique acesso Anyone");
  }
  if (!result || result.ok !== true) {
    const reason = ["INVALID_TOKEN", "NOT_CONFIGURED", "INVALID_EVENT", "NO_RECIPIENT", "QUOTA_EXCEEDED"]
      .includes(result?.error) ? result.error : "FAILED";
    throw new Error("Google Apps Script recusou o envio: " + reason);
  }
  return true;
}

async function sendEmail(event, env) {
  if (emailChannel(env) === "Google Apps Script") return sendGoogleEmail(event, env);
  if (emailChannel(env) !== "Resend") throw new Error("Canal de e-mail nao configurado");
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
  // Nao propagar corpo da falha do provedor para o painel publico.
  if (!response.ok) throw new Error("Resend HTTP " + response.status);
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
      const email = await this.ctx.storage.get("email_status") || {};
      const channel = emailChannel(this.env);
      const enabled = Boolean(channel);
      // Nunca divulgar enderecos, chaves ou cabecalhos do provedor.
      return new Response(JSON.stringify({
        ...status,
        alertas_email: {
          configurado: enabled,
          canal: channel || "Nenhum",
          ultimo_envio_em: email.ultimo_envio_em || null,
          ultima_falha_em: email.ultima_falha_em || null,
          ultimo_erro: email.ultimo_erro || null
        }
      }), { status: 200, headers: CORS });
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

    // Mensagens sao enviadas pelo Worker, independentemente de navegador ou celular.
    const channel = emailChannel(this.env);
    if (channel) {
      // Cada provedor inicia na propria data de ativacao; jamais dispara incidentes
      // antigos que ocorreram antes da autorizacao do usuario.
      const activationKey = channel === "Google Apps Script" ?
        "email_enabled_since_google" : "email_enabled_since";
      let enabledSince = await this.ctx.storage.get(activationKey);
      if (!enabledSince) {
        enabledSince = now;
        await this.ctx.storage.put(activationKey, enabledSince);
      }
      const metrics = await this.ctx.storage.get("email_status") || {};
      let dirty = false;
      const pending = snapshot.eventos.filter(e =>
        !e.email_enviado && (e.email_tentativas || 0) < 3 &&
        Date.parse(e.em) >= Date.parse(enabledSince) &&
        Date.now() - Date.parse(e.em) < 86400000).slice(-5);
      for (const event of pending) {
        event.email_tentativas = (event.email_tentativas || 0) + 1;
        dirty = true;
        try {
          await sendEmail(event, this.env);
          event.email_enviado = true;
          metrics.ultimo_envio_em = new Date().toISOString();
          metrics.ultimo_erro = null;
          console.log("Alerta aceito por " + channel + ":", event.nome, event.tipo);
        } catch (error) {
          metrics.ultima_falha_em = new Date().toISOString();
          // Registrar somente o tipo de falha, sem resposta completa com dados pessoais.
          metrics.ultimo_erro = String(error?.message || "Falha desconhecida").slice(0, 110);
          console.error("Erro ao enviar alerta", event.nome, event.tipo, metrics.ultimo_erro);
        }
      }
      if (dirty) {
        await this.ctx.storage.put("status", snapshot);
        await this.ctx.storage.put("email_status", metrics);
      }
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
