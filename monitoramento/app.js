(function(){
"use strict";
const $=id=>document.getElementById(id);
let config=[], current=null, sourceLabel="GitHub (legado)", sourceWarning="";
const fmtDate=s=>s?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"medium",timeZone:"America/Sao_Paulo"}).format(new Date(s)):"—";
const label={online:"Online",offline:"Offline",instavel:"Instável",lento:"Lenta",aguardando:"Aguardando teste"};
const clean=s=>String(s??"");
function node(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=clean(txt);return e}
function metric(id,v){$(id).textContent=v}
function card(m){
const o=node("article","card");const top=node("div","cardtop");const t=node("div");t.append(node("h3","",m.nome));top.append(t);
const s=m.estado||"aguardando";top.append(node("span","badge "+s,label[s]||"Aguardando"));o.append(top);
const a=node("a","",m.url);a.href=m.url;a.target="_blank";a.rel="noopener noreferrer";o.append(a);
const stats=node("div","stats");for(const [title,v] of [["Resposta",Number.isFinite(m.tempo_ms)?m.tempo_ms+" ms":"—"],["Disponibilidade",m.total_testes?((m.testes_ok/m.total_testes)*100).toFixed(1)+"%":"—"],["Último sucesso",m.ultimo_sucesso?fmtDate(m.ultimo_sucesso):"—"]]){const item=node("span");item.append(node("strong","",v),node("span","",title));stats.append(item)}o.append(stats);
const bars=node("div","bars");bars.title="Últimas verificações, da esquerda para a direita";bars.setAttribute("aria-label","Histórico: "+(m.recentes||[]).map(x=>label[x]||x).join(", "));
for(const v of (m.recentes||[]).slice(-48)){const b=node("span","bar "+v);b.title=label[v]||v;bars.append(b)}
if(!bars.children.length){bars.append(node("small","","Aguardando histórico de verificações."));bars.style.height="auto"}
o.append(bars);if(m.erro&&s!=="online"&&s!=="lento")o.append(node("p","secondary",m.erro));
return o;
}
async function carregar(){
const bt=$("atualizar");bt.disabled=true;bt.textContent="Atualizando...";
try{
const [c,sr]=await Promise.all([fetch("./config.json",{cache:"no-store"}),fetch("./data-source.json?ts="+Date.now(),{cache:"no-store"}).catch(()=>null)]);
if(!c.ok)throw Error("Não foi possível ler a configuração.");
const cfg=await c.json();config=cfg.monitores.filter(m=>m.ativo!==false);
let remote="";
if(sr?.ok){try{const dc=await sr.json();if(typeof dc.worker_url==="string"&&dc.worker_url.startsWith("https://")&&new URL(dc.worker_url).pathname==="/status")remote=dc.worker_url;}catch(_){}}
let r;
sourceLabel=remote?"Cloudflare AUVRIUN":"GitHub Actions (legado)";sourceWarning="";
if(remote){try{r=await fetch(remote+"?ts="+Date.now(),{cache:"no-store",signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error("HTTP "+r.status);}
catch(_){r=null;sourceLabel="GitHub (reserva)";sourceWarning=" • falha ao conectar ao Cloudflare";}}
if(!r){r=await fetch("./data/status.json?ts="+Date.now(),{cache:"no-store"});}
if(!r.ok)throw Error("Não foi possível ler o status.");
current=await r.json();render();
}catch(err){$("atualizacao").textContent="Erro ao atualizar o painel: "+err.message; $("sinal").className="pulse offline";if(!current)$("servicos").replaceChildren(node("div","empty","Falha ao carregar as informações."))}
finally{bt.disabled=false;bt.textContent="Atualizar painel";}
}
function render(){
const monitors=config.map(m=>({id:m.id,nome:m.nome,url:m.url,estado:"aguardando",...(current.monitores||[]).find(x=>x.id===m.id)}));
const live=monitors.filter(x=>x.estado==="online"||x.estado==="lento").length,issues=monitors.filter(x=>["offline","instavel"].includes(x.estado)).length;
metric("total",monitors.length);metric("ativos",live);metric("problemas",issues);
const tested=monitors.reduce((n,m)=>n+(m.total_testes||0),0),ok=monitors.reduce((n,m)=>n+(m.testes_ok||0),0);
metric("uptime",tested?((ok/tested)*100).toFixed(1)+"%":"—");
$("atualizacao").textContent=current.atualizado_em?"Última verificação: "+fmtDate(current.atualizado_em)+(Date.now()-Date.parse(current.atualizado_em)>15*60000?" • dados desatualizados":"")+" • "+sourceLabel+sourceWarning:"Aguardando a primeira execução do monitoramento • "+sourceLabel;
$("sinal").className="pulse "+(current.atualizado_em?(issues?"offline":"online"):"");
const selected=$("filtro").value,filtered=monitors.filter(m=>selected==="todos"||selected==="online"&&(m.estado==="online"||m.estado==="lento")||selected==="problemas"&&["offline","instavel"].includes(m.estado));
const grid=$("servicos");grid.replaceChildren(...(filtered.map(card)));if(!filtered.length)grid.append(node("div","empty","Nenhuma API neste filtro."));
const ev=$("eventos");ev.replaceChildren();for(const e of (current.eventos||[]).slice().reverse().slice(0,40)){const row=node("div","event");row.append(node("time","",fmtDate(e.em)));const info=node("div");info.append(node("strong","",e.nome+" • "+(e.tipo==="queda"?"Indisponibilidade detectada":"Recuperação")),node("p","",e.detalhe||""));row.append(info);row.append(node("span","badge "+(e.tipo==="queda"?"offline":"online"),e.tipo==="queda"?"Queda":"Recuperada"));ev.append(row)}
if(!ev.children.length)ev.append(node("div","empty","Nenhum incidente registrado."));
}
$("atualizar").addEventListener("click",carregar);$("filtro").addEventListener("change",()=>current&&render());
carregar();setInterval(carregar,60000);
})();