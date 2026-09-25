const cfg=window.JJ_CONFIG||{};
let deferredPrompt=null;
const $=s=>document.querySelector(s);
const fmt=d=>new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit"});
function today(){return new Date().toISOString().slice(0,10)}
$("#data").value=today();

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("#btnInstall").hidden=false});
$("#btnInstall").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("#btnInstall").hidden=true};
$("#btnHoje").onclick=()=>$("#data").value=today();
$("#goNovo").onclick=()=>$("#formTreino").scrollIntoView({behavior:"smooth"});

async function api(action,payload={}){
 if(!cfg.API_URL) throw new Error("API ainda não configurada");
 const r=await fetch(cfg.API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,...payload})});
 const j=await r.json(); if(!j.ok) throw new Error(j.error||"Erro na API"); return j;
}
async function carregar(){
 try{
  const j=await api("list");
  const rows=j.data||[];
  const now=new Date(), ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  $("#kpiTotal").textContent=rows.length;
  $("#kpiMes").textContent=rows.filter(x=>(x.data||"").startsWith(ym)).length;
  $("#kpiNogi").textContent=rows.filter(x=>String(x.tipo).toUpperCase()==="NOGI").length;
  $("#kpiFaixa").textContent=j.profile?.faixaAtual||"AZUL";
  $("#kpiDiasFaixa").textContent=j.profile?.diasNaFaixa?j.profile.diasNaFaixa+" dias na faixa":"";
  const anos=[...new Set(rows.map(x=>(x.data||"").slice(0,4)).filter(Boolean))].sort().reverse();
  $("#filtroAno").innerHTML='<option value="">Todos</option>'+anos.map(a=>`<option>${a}</option>`).join("");
  render(rows);
  $("#filtroAno").onchange=()=>render(rows.filter(x=>!$("#filtroAno").value||(x.data||"").startsWith($("#filtroAno").value)));
 }catch(e){$("#status").textContent=e.message}
}
function render(rows){
 $("#historico").innerHTML=rows.slice().sort((a,b)=>(b.data||"").localeCompare(a.data||"")).slice(0,100).map(x=>`
 <div class="row"><strong>${fmt(x.data)}</strong><div>${x.local||"—"}<br><small>${x.observacao||""}</small></div><span class="tag">${x.tipo||"GI"}</span></div>`).join("")||"<p>Nenhum treino.</p>";
}
$("#formTreino").onsubmit=async e=>{
 e.preventDefault(); $("#status").textContent="Salvando...";
 try{
  await api("save",{treino:{data:$("#data").value,local:$("#local").value.trim(),tipo:$("#tipo").value,observacao:$("#obs").value.trim()}});
  $("#status").textContent="Treino salvo."; $("#obs").value=""; await carregar();
 }catch(err){$("#status").textContent=err.message}
};
if("serviceWorker"in navigator) navigator.serviceWorker.register("./sw.js");
carregar();