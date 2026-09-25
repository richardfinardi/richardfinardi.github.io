const cfg=window.JJ_CONFIG||{};
let deferredPrompt=null,DATA=[],GRADS=[],PAGE=40,visible=40,TOKEN=localStorage.getItem("jj-token")||"",CURRENT_USER=null;

const FALLBACK_GRADS=[];
const $=s=>document.querySelector(s);
const isoDate=v=>{
 const s=String(v||"").trim();
 let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return m[1]+"-"+m[2]+"-"+m[3];
 m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);if(m)return m[3]+"-"+m[2]+"-"+m[1];
 return s;
};
const fmt=d=>{
 if(!d)return "—";
 const m=String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
 return m?m[3]+"/"+m[2]+"/"+m[1]:String(d);
};
const today=()=>{
 const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
 return y+"-"+m+"-"+day;
};
const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

function setDefaultDates(){
 if($("#data"))$("#data").value=today();
 if($("#local"))$("#local").value="TEGA";
 if($("#gradData"))$("#gradData").value=today();
 if($("#setupDataFaixa"))$("#setupDataFaixa").value=today();
 if($("#setupDataGrau"))$("#setupDataGrau").value=today();
}
setDefaultDates();

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;if($("#btnInstall"))$("#btnInstall").hidden=false});
if($("#btnInstall"))$("#btnInstall").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("#btnInstall").hidden=true};

function setAuthMode(mode){
 const login=mode==="login";
 $("#loginPanel").hidden=!login;
 $("#registerPanel").hidden=login;
 $("#authStatus").textContent="";
}
$("#btnOpenRegister").onclick=()=>{history.replaceState(null,"",location.pathname+"#cadastro");setAuthMode("register")};
$("#btnBackLogin").onclick=()=>{history.replaceState(null,"",location.pathname);setAuthMode("login")};

let API_SEQ=0;
const API_PENDING=new Map();

window.addEventListener("message",e=>{
 if(!e.data||e.data.type!=="JJ_API_RESULT")return;
 const p=API_PENDING.get(e.data.id);if(!p)return;
 API_PENDING.delete(e.data.id);
 p.cleanup();
 p.resolve(e.data.result);
});

async function api(action,payload={}){
 if(!cfg.API_URL)throw new Error("API ainda não configurada");
 const body=Object.assign({action},payload);
 if(TOKEN&&action!=="login"&&action!=="register")body.token=TOKEN;

 const id="r"+Date.now()+"_"+(++API_SEQ);
 const frameName="jj_api_"+id;

 const j=await new Promise((resolve,reject)=>{
  const iframe=document.createElement("iframe");
  iframe.name=frameName;
  iframe.style.cssText="position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px;border:0";
  iframe.setAttribute("aria-hidden","true");

  const form=document.createElement("form");
  form.method="POST";
  form.action=cfg.API_URL;
  form.target=frameName;
  form.style.display="none";

  const payloadInput=document.createElement("input");
  payloadInput.type="hidden";payloadInput.name="payload";payloadInput.value=JSON.stringify(body);
  const idInput=document.createElement("input");
  idInput.type="hidden";idInput.name="requestId";idInput.value=id;
  form.appendChild(payloadInput);form.appendChild(idInput);

  const cleanup=()=>{clearTimeout(timer);form.remove();setTimeout(()=>iframe.remove(),50)};
  const timer=setTimeout(()=>{
    API_PENDING.delete(id);cleanup();reject(new Error("Não foi possível conectar ao servidor."));
  },30000);

  API_PENDING.set(id,{resolve,reject,cleanup});
  document.body.appendChild(iframe);
  document.body.appendChild(form);
  form.submit();
 });

 if(!j||!j.ok){
  const err=j&&j.error?j.error:"Erro na API";
  if(err==="AUTH_REQUIRED"||err==="SESSION_EXPIRED"){clearSession();showAuth();throw new Error("Sua sessão expirou. Entre novamente.");}
  throw new Error(err);
 }
 return j;
}
function saveSession(j){
 TOKEN=j.token||TOKEN;
 if(TOKEN)localStorage.setItem("jj-token",TOKEN);
 if(j.user)CURRENT_USER=j.user;
}
function clearSession(){
 TOKEN="";CURRENT_USER=null;DATA=[];GRADS=[];
 localStorage.removeItem("jj-token");
}
function showAuth(){
 $("#authShell").hidden=false;$("#setupShell").hidden=true;$("#appShell").hidden=true;
 setAuthMode(location.hash==="#cadastro"?"register":"login");
}
function showSetup(){
 $("#authShell").hidden=true;$("#setupShell").hidden=false;$("#appShell").hidden=true;
}
function showApp(){
 $("#authShell").hidden=true;$("#setupShell").hidden=true;$("#appShell").hidden=false;
 if(CURRENT_USER){
  $("#perfilNome").textContent=CURRENT_USER.nome||"—";
  $("#perfilEmail").textContent=CURRENT_USER.email||"";
 }
 showView("Resumo");
}
async function enterApp(){
 showApp();
 await carregar();
}

$("#formLogin").onsubmit=async e=>{
 e.preventDefault();$("#authStatus").textContent="Entrando...";
 try{
  const j=await api("login",{email:$("#loginEmail").value.trim(),senha:$("#loginSenha").value});
  saveSession(j);
  $("#loginSenha").value="";
  if(j.needsSetup)showSetup();else await enterApp();
 }catch(err){$("#authStatus").textContent=err.message}
};
$("#formRegister").onsubmit=async e=>{
 e.preventDefault();
 const s1=$("#regSenha").value,s2=$("#regSenha2").value;
 if(s1!==s2){$("#authStatus").textContent="As senhas não conferem.";return;}
 $("#authStatus").textContent="Criando conta...";
 try{
  const j=await api("register",{nome:$("#regNome").value.trim(),email:$("#regEmail").value.trim(),senha:s1});
  saveSession(j);
  $("#regSenha").value="";$("#regSenha2").value="";
  if(j.needsSetup)showSetup();else await enterApp();
 }catch(err){$("#authStatus").textContent=err.message}
};
$("#setupGrau").onchange=()=>{
 const temGrau=$("#setupGrau").value!=="INÍCIO";
 $("#setupDataGrauLabel").hidden=!temGrau;
 if(temGrau&&!$("#setupDataGrau").value)$("#setupDataGrau").value=today();
};
$("#formSetup").onsubmit=async e=>{
 e.preventDefault();$("#setupStatus").textContent="Salvando...";
 try{
  const grau=$("#setupGrau").value;
  await api("setupGraduacao",{faixa:$("#setupFaixa").value,grau,dataFaixa:$("#setupDataFaixa").value,dataGrau:grau==="INÍCIO"?$("#setupDataFaixa").value:$("#setupDataGrau").value});
  $("#setupStatus").textContent="";
  await enterApp();
 }catch(err){$("#setupStatus").textContent=err.message}
};
$("#btnSair").onclick=async()=>{
 try{if(TOKEN)await api("logout")}catch(_){}
 clearSession();showAuth();
};

document.querySelectorAll(".bottom button").forEach(b=>b.onclick=()=>showView(b.dataset.view));
function showView(name){
 document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
 document.querySelectorAll(".bottom button").forEach(v=>v.classList.remove("active"));
 const view=$("#view"+name),btn=document.querySelector('[data-view="'+name+'"]');
 if(view)view.classList.add("active");if(btn)btn.classList.add("active");
 window.scrollTo({top:0,behavior:"smooth"});
}

function calcProfile(grads){
 const valid=(Array.isArray(grads)?grads:[]).filter(g=>g&&g.data&&g.faixa);
 const sorted=valid.slice().sort((a,b)=>String(a.data).localeCompare(String(b.data)));
 if(!sorted.length)return {faixa:"—",faixaData:"",grau:"—",grauData:""};
 const starts=sorted.filter(g=>normTxt(g.grau)==="INICIO");
 const faixaStart=starts.length?starts[starts.length-1]:sorted[0];
 let grau=faixaStart;
 sorted.forEach(g=>{if(g.faixa===faixaStart.faixa&&String(g.data)>=String(faixaStart.data))grau=g});
 return {faixa:faixaStart.faixa,faixaData:faixaStart.data,grau:grau?grau.grau:"—",grauData:grau?grau.data:""};
}
function countMap(arr,keyFn){const m={};arr.forEach(x=>{const k=keyFn(x);if(k)m[k]=(m[k]||0)+1});return m}
function normTxt(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase()}
function grauNumero(grau){
 const g=normTxt(grau);if(g==="INICIO"||g==="SEM GRAU")return 0;
 const m=g.match(/([1-4])/);return m?Number(m[1]):0;
}
function renderBeltIcon(target,faixa,grau){
 const el=$(target);if(!el)return;
 const f=normTxt(faixa),g=grauNumero(grau);
 const colors={BRANCA:"#f4f4f4",AZUL:"#2b78ff",ROXA:"#7a3db8",MARROM:"#6b3f22",PRETA:"#111111"};
 el.style.setProperty("--belt",colors[f]||"#2b78ff");
 el.style.setProperty("--rank",f==="PRETA"?"#d8171f":"#090a0c");
 el.innerHTML="";
 for(let i=1;i<=g;i++){const s=document.createElement("i");s.className="stripe s"+i;el.appendChild(s);}
}
function tempoCompacto(iso){
 if(!iso)return "";
 const start=new Date(iso+"T12:00:00"),end=new Date();if(isNaN(start.getTime()))return "";
 let months=(end.getFullYear()-start.getFullYear())*12+(end.getMonth()-start.getMonth());
 if(end.getDate()<start.getDate())months--;months=Math.max(0,months);
 if(months>=12){const a=Math.floor(months/12),m=months%12;return a+"a"+(m?m+"m":"");}
 if(months>=1)return months+"m";
 const days=Math.max(0,Math.floor((new Date(end.getFullYear(),end.getMonth(),end.getDate())-new Date(start.getFullYear(),start.getMonth(),start.getDate()))/86400000));
 return days+" "+(days===1?"dia":"dias");
}

function renderResumo(){
 const now=new Date(),year=String(now.getFullYear()),ym=year+"-"+String(now.getMonth()+1).padStart(2,"0");
 const nogi=DATA.filter(x=>x.tipo==="NOGI").length,anoData=DATA.filter(x=>x.data.indexOf(year)===0);
 const ano=anoData.length,giAno=anoData.filter(x=>x.tipo==="GI").length,nogiAno=anoData.filter(x=>x.tipo==="NOGI").length,p=calcProfile(GRADS);
 $("#kpiTotal").textContent=DATA.length;$("#kpiMes").textContent=DATA.filter(x=>x.data.indexOf(ym)===0).length;
 $("#kpiAno").textContent=ano;$("#kpiGiAno").textContent=giAno;$("#kpiNogiAno").textContent=nogiAno;
 $("#kpiFaixa").textContent=p.faixa;$("#kpiGrau").textContent=p.grau==="INÍCIO"?"SEM GRAU":p.grau;
 renderBeltIcon("#kpiBeltIcon",p.faixa,p.grau);
 $("#kpiDiasFaixa").textContent=p.faixaData?p.faixa+" DESDE "+fmt(p.faixaData)+" ("+tempoCompacto(p.faixaData)+")":"";
 $("#kpiDiasGrau").textContent=p.grauData?(p.grau==="INÍCIO"?"SEM GRAU":p.grau)+" DESDE "+fmt(p.grauData)+" ("+tempoCompacto(p.grauData)+")":"";
 const months=[];for(let i=1;i<=12;i++)months.push(year+"-"+String(i).padStart(2,"0"));
 const mc=countMap(anoData,x=>x.data.slice(0,7)),max=Math.max.apply(null,[1].concat(months.map(m=>mc[m]||0))),labels=["J","F","M","A","M","J","J","A","S","O","N","D"];
 $("#anoGrafico").textContent=year;
 $("#graficoMes").innerHTML=months.map((m,i)=>'<div class="bar-wrap"><div class="bar" style="height:'+Math.max(3,(mc[m]||0)/max*130)+'px"><b>'+(mc[m]||0)+'</b></div><div class="bar-label">'+labels[i]+'</div></div>').join("");
 const gi=DATA.length-nogi;
 $("#tipoResumo").innerHTML='<div class="type-box"><div class="type-card"><strong>'+gi+'</strong><span>GI • '+(DATA.length?Math.round(gi/DATA.length*100):0)+'%</span></div><div class="type-card"><strong>'+nogi+'</strong><span>NOGI • '+(DATA.length?Math.round(nogi/DATA.length*100):0)+'%</span></div></div>';
 renderStats("#locaisResumo",countMap(DATA,x=>x.local||"—"),false);renderStats("#anosResumo",countMap(DATA,x=>x.data.slice(0,4)),true);renderFaixas();
}
function renderStats(sel,map,desc){
 const entries=Object.entries(map).sort((a,b)=>desc?b[0].localeCompare(a[0]):b[1]-a[1]),max=Math.max.apply(null,[1].concat(entries.map(x=>x[1])));
 $(sel).innerHTML=entries.map(x=>'<div class="stat-line"><span>'+esc(x[0])+'</span><div class="track"><div class="fill" style="width:'+(x[1]/max*100)+'%"></div></div><strong>'+x[1]+'</strong></div>').join("")||'<span class="muted">Sem dados</span>';
}
function renderFaixas(){
 const starts=GRADS.filter(g=>normTxt(g.grau)==="INICIO").sort((a,b)=>a.data.localeCompare(b.data)),map={};
 DATA.forEach(t=>{let belt=starts.length?starts[0].faixa:"SEM FAIXA";starts.forEach(s=>{if(t.data>=s.data)belt=s.faixa});map[belt]=(map[belt]||0)+1});
 renderStats("#faixasResumo",map,false);
}
function renderHistorico(){
 const ano=$("#filtroAno").value,mes=$("#filtroMes").value,tipo=$("#filtroTipo").value,local=$("#filtroLocal").value,busca=$("#filtroBusca").value.trim().toLowerCase();
 const rows=DATA.slice().filter(x=>{
  if(ano&&x.data.slice(0,4)!==ano)return false;if(mes&&x.data.slice(5,7)!==mes)return false;if(tipo&&x.tipo!==tipo)return false;if(local&&(x.local||"")!==local)return false;
  if(busca&&!([x.data,fmt(x.data),x.local,x.tipo,x.observacao].join(" ").toLowerCase().includes(busca)))return false;return true;
 }).sort((a,b)=>b.data.localeCompare(a.data));
 $("#qtdFiltrada").textContent=rows.length+" treino"+(rows.length===1?"":"s");
 $("#historico").innerHTML=rows.slice(0,visible).map(x=>'<div class="row"><strong>'+fmt(x.data)+'</strong><div><b>'+esc(x.local||"—")+'</b><br><small>'+(x.tipo||"GI")+(x.observacao?" • "+esc(x.observacao):"")+'</small></div><div class="row-actions"><button class="icon-btn" onclick="editTreino(\''+x.id+'\')">✎</button><button class="icon-btn delete" onclick="deleteTreino(\''+x.id+'\')">×</button></div></div>').join("")||"<p>Nenhum treino encontrado.</p>";
 $("#btnMais").hidden=visible>=rows.length;
}
function renderGrads(){
 const p=calcProfile(GRADS);
 $("#evoFaixa").textContent=p.faixa;$("#evoGrau").textContent=p.grau==="INÍCIO"?"SEM GRAU":p.grau;renderBeltIcon("#evoBeltIcon",p.faixa,p.grau);
 $("#evoFaixaDesde").textContent=p.faixaData?p.faixa+" DESDE "+fmt(p.faixaData)+" ("+tempoCompacto(p.faixaData)+")":"";
 $("#evoGrauDesde").textContent=p.grauData?(p.grau==="INÍCIO"?"SEM GRAU":p.grau)+" DESDE "+fmt(p.grauData)+" ("+tempoCompacto(p.grauData)+")":"";
 $("#graduacoes").innerHTML=GRADS.slice().sort((a,b)=>b.data.localeCompare(a.data)).map(g=>'<div class="time-item"><span class="dot"></span><div class="time-main"><strong>'+esc(g.faixa)+' • '+esc(g.grau)+'</strong><small>'+fmt(g.data)+'</small></div><div class="time-actions"><button class="icon-btn" onclick="editGrad(\''+g.id+'\')">✎</button><button class="icon-btn delete" onclick="deleteGrad(\''+g.id+'\')">×</button></div></div>').join("");
}

function preencherFiltros(){
 const anos=[...new Set(DATA.map(x=>String(x.data).slice(0,4)).filter(Boolean))].sort().reverse(),current=$("#filtroAno").value;
 $("#filtroAno").innerHTML='<option value="">Todos</option>'+anos.map(a=>'<option '+(a===current?'selected':'')+'>'+a+'</option>').join("");
 const localAtual=$("#filtroLocal").value,locais=[...new Set(DATA.map(x=>x.local).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 $("#filtroLocal").innerHTML='<option value="">Todos</option>'+locais.map(l=>'<option value="'+esc(l)+'" '+(l===localAtual?'selected':'')+'>'+esc(l)+'</option>').join("");
}
function cacheKey(){return CURRENT_USER&&CURRENT_USER.userId?"jj-last-data-"+CURRENT_USER.userId:"";}
async function carregar(tentativa=0){
 try{
  const j=await api("list");
  DATA=(Array.isArray(j.data)?j.data:[]).filter(x=>x&&x.data).map(x=>Object.assign({},x,{data:isoDate(x.data)}));
  GRADS=(Array.isArray(j.graduacoes)?j.graduacoes:FALLBACK_GRADS).filter(x=>x&&x.data&&x.faixa).map(x=>Object.assign({},x,{data:isoDate(x.data)}));
  try{if(cacheKey())localStorage.setItem(cacheKey(),JSON.stringify({data:DATA,graduacoes:GRADS,ts:Date.now()}))}catch(_){}
  preencherFiltros();renderResumo();renderHistorico();renderGrads();
  const aviso=$("#loadError");if(aviso)aviso.remove();
 }catch(e){
  let cache=null;try{cache=cacheKey()?JSON.parse(localStorage.getItem(cacheKey())||"null"):null}catch(_){}
  if(cache&&Array.isArray(cache.data)){DATA=cache.data;GRADS=Array.isArray(cache.graduacoes)?cache.graduacoes:[];preencherFiltros();renderResumo();renderHistorico();renderGrads();mostrarErro("Conexão temporariamente indisponível. Mostrando os últimos dados salvos.");return;}
  mostrarErro(e.message==="Sua sessão expirou. Entre novamente."?e.message:"Não consegui carregar os dados agora. Tentando novamente…");
  if(TOKEN&&tentativa<3)setTimeout(()=>carregar(tentativa+1),1200*(tentativa+1));
 }
}
function mostrarErro(msg){
 let el=$("#loadError");if(!el){el=document.createElement("div");el.id="loadError";el.className="load-error";const resumo=$("#viewResumo");if(resumo)resumo.insertBefore(el,resumo.firstChild);}el.textContent=msg;
}

window.editTreino=id=>{const x=DATA.find(t=>t.id===id);if(!x)return;$("#treinoId").value=x.id;$("#data").value=x.data;$("#local").value=x.local||"TEGA";$("#tipo").value=x.tipo||"GI";$("#obs").value=x.observacao||"";$("#formTitulo").textContent="Editar treino";$("#btnCancelarEdicao").hidden=false;showView("Treinos")};
function clearTreino(){$("#treinoId").value="";$("#data").value=today();$("#local").value="TEGA";$("#tipo").value="GI";$("#obs").value="";$("#formTitulo").textContent="Novo treino";$("#btnCancelarEdicao").hidden=true}
$("#btnCancelarEdicao").onclick=clearTreino;
$("#formTreino").onsubmit=async e=>{e.preventDefault();$("#status").textContent="Salvando...";try{await api($("#treinoId").value?"update":"save",{treino:{id:$("#treinoId").value,data:$("#data").value,local:$("#local").value.trim()||"TEGA",tipo:$("#tipo").value,observacao:$("#obs").value.trim()}});clearTreino();$("#status").textContent="Treino salvo.";await carregar()}catch(err){$("#status").textContent=err.message}};
window.deleteTreino=async id=>{if(!confirm("Apagar este treino?"))return;try{await api("delete",{id});await carregar()}catch(e){alert(e.message)}};

window.editGrad=id=>{const g=GRADS.find(x=>x.id===id);if(!g)return;$("#gradRow").value=g.id;$("#gradFaixa").value=g.faixa;$("#gradGrau").value=g.grau;$("#gradData").value=g.data;$("#gradTitulo").textContent="Editar graduação";$("#btnCancelarGrad").hidden=false;showView("Evolucao")};
function clearGrad(){$("#gradRow").value="";$("#gradData").value=today();$("#gradTitulo").textContent="Registrar graduação";$("#btnCancelarGrad").hidden=true}
$("#btnCancelarGrad").onclick=clearGrad;
$("#formGrad").onsubmit=async e=>{e.preventDefault();$("#statusGrad").textContent="Salvando...";try{await api("saveGraduacao",{graduacao:{id:$("#gradRow").value,faixa:$("#gradFaixa").value,grau:$("#gradGrau").value,data:$("#gradData").value}});clearGrad();$("#statusGrad").textContent="Graduação salva.";await carregar()}catch(err){$("#statusGrad").textContent=err.message}};
window.deleteGrad=async id=>{if(!confirm("Apagar este marco de graduação?"))return;try{await api("deleteGraduacao",{id});await carregar()}catch(e){alert(e.message)}};

["#filtroAno","#filtroMes","#filtroTipo","#filtroLocal"].forEach(s=>$(s).onchange=()=>{visible=PAGE;renderHistorico()});
$("#filtroBusca").oninput=()=>{visible=PAGE;renderHistorico()};
$("#btnLimparFiltros").onclick=()=>{$("#filtroBusca").value="";$("#filtroAno").value="";$("#filtroMes").value="";$("#filtroTipo").value="";$("#filtroLocal").value="";visible=PAGE;renderHistorico()};
$("#btnNovoTreino").onclick=()=>{clearTreino();showView("Treinos");setTimeout(()=>$("#data").focus(),200)};
$("#btnMais").onclick=()=>{visible+=PAGE;renderHistorico()};

async function bootstrap(){
 if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js");
 if(!TOKEN){showAuth();return;}
 try{
  const j=await api("me");CURRENT_USER=j.user;
  $("#perfilNome").textContent=CURRENT_USER.nome||"—";$("#perfilEmail").textContent=CURRENT_USER.email||"";
  const list=await api("list");
  const grads=Array.isArray(list.graduacoes)?list.graduacoes:[];
  if(!grads.length){showSetup();return;}
  showApp();
  DATA=(Array.isArray(list.data)?list.data:[]).filter(x=>x&&x.data).map(x=>Object.assign({},x,{data:isoDate(x.data)}));
  GRADS=grads.filter(x=>x&&x.data&&x.faixa).map(x=>Object.assign({},x,{data:isoDate(x.data)}));
  preencherFiltros();renderResumo();renderHistorico();renderGrads();
 }catch(e){if(TOKEN){$("#authStatus").textContent=e.message}showAuth();}
}
bootstrap();