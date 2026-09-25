const cfg=window.JJ_CONFIG||{};
let deferredPrompt=null,DATA=[],GRADS=[],PAGE=40,visible=40;
const FALLBACK_GRADS=[
 {row:2,faixa:"BRANCA",grau:"INÍCIO",data:"2024-01-29"},
 {row:3,faixa:"BRANCA",grau:"1º GRAU",data:"2024-02-19"},
 {row:4,faixa:"BRANCA",grau:"2º GRAU",data:"2024-05-15"},
 {row:5,faixa:"BRANCA",grau:"3º GRAU",data:"2024-08-19"},
 {row:6,faixa:"BRANCA",grau:"4º GRAU",data:"2024-11-01"},
 {row:7,faixa:"AZUL",grau:"INÍCIO",data:"2024-12-11"},
 {row:8,faixa:"AZUL",grau:"1º GRAU",data:"2025-07-30"},
 {row:9,faixa:"AZUL",grau:"2º GRAU",data:"2025-12-17"},
 {row:10,faixa:"AZUL",grau:"3º GRAU",data:"2026-07-06"},
 {row:11,faixa:"AZUL",grau:"4º GRAU",data:"2026-09-21"}
];
const $=s=>document.querySelector(s);
const fmt=d=>{
 if(!d)return "—";
 const m=String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
 return m?m[3]+"/"+m[2]+"/"+m[1]:String(d);
};
const today=()=>{
 const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
 return y+"-"+m+"-"+day;
};
const daysSince=d=>Math.max(0,Math.floor((new Date()-new Date(d+"T12:00:00"))/86400000));
const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
$("#data").value=today();$("#local").value="TEGA";$("#gradData").value=today();

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("#btnInstall").hidden=false});
$("#btnInstall").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("#btnInstall").hidden=true};

document.querySelectorAll(".bottom button").forEach(b=>b.onclick=()=>showView(b.dataset.view));
function showView(name){
 document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
 document.querySelectorAll(".bottom button").forEach(v=>v.classList.remove("active"));
 $("#view"+name).classList.add("active");
 document.querySelector('[data-view="'+name+'"]').classList.add("active");
 window.scrollTo({top:0,behavior:"smooth"});
}

async function api(action,payload={}){
 if(!cfg.API_URL)throw new Error("API ainda não configurada");
 const r=await fetch(cfg.API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(Object.assign({action},payload))});
 const j=await r.json();if(!j.ok)throw new Error(j.error||"Erro na API");return j;
}

function calcProfile(grads){
 const sorted=grads.slice().sort((a,b)=>a.data.localeCompare(b.data));
 const starts=sorted.filter(g=>String(g.grau).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase()==="INICIO");
 const faixaStart=starts.length?starts[starts.length-1]:sorted[0];
 let grau=faixaStart;
 if(faixaStart)sorted.forEach(g=>{if(g.faixa===faixaStart.faixa&&g.data>=faixaStart.data)grau=g});
 return {faixa:faixaStart?faixaStart.faixa:"—",faixaData:faixaStart?faixaStart.data:"",grau:grau?grau.grau:"—",grauData:grau?grau.data:""};
}
function countMap(arr,keyFn){const m={};arr.forEach(x=>{const k=keyFn(x);if(k)m[k]=(m[k]||0)+1});return m}

function renderResumo(){
 const now=new Date(),year=String(now.getFullYear()),ym=year+"-"+String(now.getMonth()+1).padStart(2,"0");
 const nogi=DATA.filter(x=>x.tipo==="NOGI").length;
 const ano=DATA.filter(x=>x.data.indexOf(year)===0).length;
 const p=calcProfile(GRADS);
 $("#kpiTotal").textContent=DATA.length;
 $("#kpiMes").textContent=DATA.filter(x=>x.data.indexOf(ym)===0).length;
 $("#kpiAno").textContent=ano;
 $("#kpiNogi").textContent=nogi;
 $("#kpiNogiPct").textContent=DATA.length?Math.round(nogi/DATA.length*100)+"% do total":"0%";
 $("#kpiFaixa").textContent=p.faixa;
 $("#kpiDiasFaixa").textContent=p.faixaData?daysSince(p.faixaData)+" dias • desde "+fmt(p.faixaData):"";
 $("#kpiGrau").textContent=p.grau==="INÍCIO"?"SEM GRAU":p.grau;
 $("#kpiDiasGrau").textContent=p.grauData?daysSince(p.grauData)+" dias • desde "+fmt(p.grauData):"";

 const months=[];for(let i=1;i<=12;i++)months.push(year+"-"+String(i).padStart(2,"0"));
 const mc=countMap(DATA.filter(x=>x.data.indexOf(year)===0),x=>x.data.slice(0,7));
 const max=Math.max.apply(null,[1].concat(months.map(m=>mc[m]||0)));
 const labels=["J","F","M","A","M","J","J","A","S","O","N","D"];
 $("#anoGrafico").textContent=year;
 $("#graficoMes").innerHTML=months.map((m,i)=>'<div class="bar-wrap"><div class="bar" style="height:'+Math.max(3,(mc[m]||0)/max*130)+'px"><b>'+(mc[m]||0)+'</b></div><div class="bar-label">'+labels[i]+'</div></div>').join("");

 const gi=DATA.length-nogi;
 $("#tipoResumo").innerHTML='<div class="type-box"><div class="type-card"><strong>'+gi+'</strong><span>GI • '+(DATA.length?Math.round(gi/DATA.length*100):0)+'%</span></div><div class="type-card"><strong>'+nogi+'</strong><span>NOGI • '+(DATA.length?Math.round(nogi/DATA.length*100):0)+'%</span></div></div>';
 renderStats("#locaisResumo",countMap(DATA,x=>x.local||"—"),false);
 renderStats("#anosResumo",countMap(DATA,x=>x.data.slice(0,4)),true);
 renderFaixas();
}

function renderStats(sel,map,desc){
 const entries=Object.entries(map).sort((a,b)=>desc?b[0].localeCompare(a[0]):b[1]-a[1]);
 const max=Math.max.apply(null,[1].concat(entries.map(x=>x[1])));
 $(sel).innerHTML=entries.map(x=>'<div class="stat-line"><span>'+esc(x[0])+'</span><div class="track"><div class="fill" style="width:'+(x[1]/max*100)+'%"></div></div><strong>'+x[1]+'</strong></div>').join("")||'<span class="muted">Sem dados</span>';
}

function renderFaixas(){
 const starts=GRADS.filter(g=>String(g.grau).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase()==="INICIO").sort((a,b)=>a.data.localeCompare(b.data));
 const map={};
 DATA.forEach(t=>{let belt=starts.length?starts[0].faixa:"SEM FAIXA";starts.forEach(s=>{if(t.data>=s.data)belt=s.faixa});map[belt]=(map[belt]||0)+1});
 renderStats("#faixasResumo",map,false);
}

function renderHistorico(){
 const ano=$("#filtroAno").value,mes=$("#filtroMes").value,tipo=$("#filtroTipo").value,local=$("#filtroLocal").value;
 const busca=$("#filtroBusca").value.trim().toLowerCase();
 const rows=DATA.slice().filter(x=>{
  if(ano&&x.data.slice(0,4)!==ano)return false;
  if(mes&&x.data.slice(5,7)!==mes)return false;
  if(tipo&&x.tipo!==tipo)return false;
  if(local&&(x.local||"")!==local)return false;
  if(busca){
   const alvo=[x.data,fmt(x.data),x.local,x.tipo,x.observacao].join(" ").toLowerCase();
   if(!alvo.includes(busca))return false;
  }
  return true;
 }).sort((a,b)=>b.data.localeCompare(a.data));
 const show=rows.slice(0,visible);
 $("#qtdFiltrada").textContent=rows.length+" treino"+(rows.length===1?"":"s");
 $("#historico").innerHTML=show.map(x=>'<div class="row"><strong>'+fmt(x.data)+'</strong><div><b>'+esc(x.local||"—")+'</b><br><small>'+(x.tipo||"GI")+(x.observacao?" • "+esc(x.observacao):"")+'</small></div><div class="row-actions"><button class="icon-btn" onclick="editTreino(\''+x.id+'\')">✎</button><button class="icon-btn delete" onclick="deleteTreino(\''+x.id+'\')">×</button></div></div>').join("")||"<p>Nenhum treino encontrado.</p>";
 $("#btnMais").hidden=visible>=rows.length;
}

function renderGrads(){
 const p=calcProfile(GRADS);
 $("#evoFaixa").textContent=p.faixa;
 $("#evoGrau").textContent=p.grau==="INÍCIO"?"SEM GRAU":p.grau;
 $("#evoFaixaDesde").textContent=p.faixaData?"Faixa desde "+fmt(p.faixaData)+" • "+daysSince(p.faixaData)+" dias":"";
 $("#evoGrauDesde").textContent=p.grauData&&p.grau!=="INÍCIO"?"Grau desde "+fmt(p.grauData)+" • "+daysSince(p.grauData)+" dias":"";
 $("#graduacoes").innerHTML=GRADS.slice().sort((a,b)=>b.data.localeCompare(a.data)).map(g=>'<div class="time-item"><span class="dot"></span><div class="time-main"><strong>'+esc(g.faixa)+' • '+esc(g.grau)+'</strong><small>'+fmt(g.data)+'</small></div><div class="time-actions"><button class="icon-btn" onclick="editGrad('+g.row+')">✎</button><button class="icon-btn delete" onclick="deleteGrad('+g.row+')">×</button></div></div>').join("");
}

async function carregar(){
 try{
  const j=await api("list");DATA=j.data||[];GRADS=(j.graduacoes&&j.graduacoes.length)?j.graduacoes:FALLBACK_GRADS.slice();
  const anos=[...new Set(DATA.map(x=>x.data.slice(0,4)))].sort().reverse();
  const current=$("#filtroAno").value;
  $("#filtroAno").innerHTML='<option value="">Todos</option>'+anos.map(a=>'<option '+(a===current?'selected':'')+'>'+a+'</option>').join("");
  const localAtual=$("#filtroLocal").value;
  const locais=[...new Set(DATA.map(x=>x.local).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  $("#filtroLocal").innerHTML='<option value="">Todos</option>'+locais.map(l=>'<option value="'+esc(l)+'" '+(l===localAtual?'selected':'')+'>'+esc(l)+'</option>').join("");
  renderResumo();renderHistorico();renderGrads();
 }catch(e){$("#status").textContent=e.message}
}

window.editTreino=id=>{
 const x=DATA.find(t=>t.id===id);if(!x)return;
 $("#treinoId").value=x.id;$("#data").value=x.data;$("#local").value=x.local||"TEGA";$("#tipo").value=x.tipo||"GI";$("#obs").value=x.observacao||"";
 $("#formTitulo").textContent="Editar treino";$("#btnCancelarEdicao").hidden=false;showView("Treinos");
};
function clearTreino(){$("#treinoId").value="";$("#data").value=today();$("#local").value="TEGA";$("#tipo").value="GI";$("#obs").value="";$("#formTitulo").textContent="Novo treino";$("#btnCancelarEdicao").hidden=true}
$("#btnCancelarEdicao").onclick=clearTreino;
$("#formTreino").onsubmit=async e=>{e.preventDefault();$("#status").textContent="Salvando...";try{await api($("#treinoId").value?"update":"save",{treino:{id:$("#treinoId").value,data:$("#data").value,local:$("#local").value.trim()||"TEGA",tipo:$("#tipo").value,observacao:$("#obs").value.trim()}});clearTreino();$("#status").textContent="Treino salvo.";await carregar()}catch(err){$("#status").textContent=err.message}};
window.deleteTreino=async id=>{if(!confirm("Apagar este treino?"))return;try{await api("delete",{id:id});await carregar()}catch(e){alert(e.message)}};

window.editGrad=row=>{const g=GRADS.find(x=>x.row===row);if(!g)return;$("#gradRow").value=g.row;$("#gradFaixa").value=g.faixa;$("#gradGrau").value=g.grau;$("#gradData").value=g.data;$("#gradTitulo").textContent="Editar graduação";$("#btnCancelarGrad").hidden=false;showView("Evolucao")};
function clearGrad(){$("#gradRow").value="";$("#gradData").value=today();$("#gradTitulo").textContent="Registrar graduação";$("#btnCancelarGrad").hidden=true}
$("#btnCancelarGrad").onclick=clearGrad;
$("#formGrad").onsubmit=async e=>{e.preventDefault();$("#statusGrad").textContent="Salvando...";try{await api("saveGraduacao",{graduacao:{row:Number($("#gradRow").value||0),faixa:$("#gradFaixa").value,grau:$("#gradGrau").value,data:$("#gradData").value}});clearGrad();$("#statusGrad").textContent="Graduação salva.";await carregar()}catch(err){$("#statusGrad").textContent=err.message}};
window.deleteGrad=async row=>{if(!confirm("Apagar este marco de graduação?"))return;try{await api("deleteGraduacao",{row:row});await carregar()}catch(e){alert(e.message)}};

["#filtroAno","#filtroMes","#filtroTipo","#filtroLocal"].forEach(s=>$(s).onchange=()=>{visible=PAGE;renderHistorico()});
$("#filtroBusca").oninput=()=>{visible=PAGE;renderHistorico()};
$("#btnLimparFiltros").onclick=()=>{$("#filtroBusca").value="";$("#filtroAno").value="";$("#filtroMes").value="";$("#filtroTipo").value="";$("#filtroLocal").value="";visible=PAGE;renderHistorico()};
$("#btnNovoTreino").onclick=()=>{clearTreino();showView("Treinos");setTimeout(()=>$("#data").focus(),200)};
$("#btnMais").onclick=()=>{visible+=PAGE;renderHistorico()};
if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js");
carregar();