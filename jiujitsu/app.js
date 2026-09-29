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

function hideBoot(){if($("#bootShell"))$("#bootShell").hidden=true}
function setAuthMode(mode){
 const login=mode==="login",register=mode==="register",recovery=mode==="recovery";
 $("#loginPanel").hidden=!login;
 $("#registerPanel").hidden=!register;
 $("#recoveryPanel").hidden=!recovery;
 $("#authStatus").textContent="";
}
$("#btnOpenRegister").onclick=()=>{history.replaceState(null,"",location.pathname+"#cadastro");setAuthMode("register")};
$("#btnBackLogin").onclick=()=>{history.replaceState(null,"",location.pathname);setAuthMode("login")};
$("#btnForgotPassword").onclick=()=>{
 $("#recoveryEmail").value=$("#loginEmail").value.trim();
 $("#formRecoveryRequest").hidden=false;$("#formRecoveryReset").hidden=true;
 setAuthMode("recovery");
};
$("#btnBackRecovery").onclick=()=>setAuthMode("login");

let API_SEQ=0;

function readApiResult(requestId){
 return new Promise((resolve,reject)=>{
  const cb="__jjcb_"+requestId.replace(/[^A-Za-z0-9_$]/g,"_");
  const script=document.createElement("script");
  let finished=false;
  const cleanup=()=>{if(finished)return;finished=true;try{delete window[cb]}catch(_){window[cb]=undefined}script.remove()};
  const timer=setTimeout(()=>{cleanup();reject(new Error("Servidor demorou para responder."))},15000);
  window[cb]=payload=>{
   clearTimeout(timer);cleanup();
   if(payload&&payload.ready)resolve(payload.result);
   else reject(new Error("Resposta do servidor não encontrada."));
  };
  script.onerror=()=>{clearTimeout(timer);cleanup();reject(new Error("Não foi possível ler a resposta do servidor."))};
  script.src=cfg.API_URL+(cfg.API_URL.includes("?")?"&":"?")+"requestId="+encodeURIComponent(requestId)+"&callback="+encodeURIComponent(cb)+"&_="+Date.now();
  document.head.appendChild(script);
 });
}

async function api(action,payload={}){
 if(!cfg.API_URL)throw new Error("API ainda não configurada");
 const body=Object.assign({action},payload);
 if(TOKEN&&!["login","register","requestPasswordReset","resetPassword"].includes(action))body.token=TOKEN;

 const id="r"+Date.now()+"_"+(++API_SEQ)+"_"+Math.random().toString(36).slice(2,10);
 const frameName="jj_api_"+id;

 const iframe=document.createElement("iframe");
 iframe.name=frameName;
 iframe.style.cssText="position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px;border:0";
 iframe.setAttribute("aria-hidden","true");

 const form=document.createElement("form");
 form.method="POST";form.action=cfg.API_URL;form.target=frameName;form.style.display="none";
 const p=document.createElement("input");p.type="hidden";p.name="payload";p.value=JSON.stringify(body);
 const rid=document.createElement("input");rid.type="hidden";rid.name="requestId";rid.value=id;
 form.appendChild(p);form.appendChild(rid);

 document.body.appendChild(iframe);
 document.body.appendChild(form);

 const j=await new Promise((resolve,reject)=>{
  let sent=false,done=false;
  const timer=setTimeout(()=>{if(done)return;done=true;form.remove();iframe.remove();reject(new Error("Não foi possível conectar ao servidor."))},30000);
  iframe.onload=async()=>{
   if(!sent||done)return;
   try{
    const result=await readApiResult(id);
    if(done)return;done=true;clearTimeout(timer);form.remove();iframe.remove();resolve(result);
   }catch(err){
    if(done)return;done=true;clearTimeout(timer);form.remove();iframe.remove();reject(err);
   }
  };
  setTimeout(()=>{sent=true;form.submit()},0);
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
 if(j.user){
  CURRENT_USER=j.user;
  if(j.user.userId)localStorage.setItem("jj-user-id",j.user.userId);
 }
}
function clearSession(){
 TOKEN="";CURRENT_USER=null;DATA=[];GRADS=[];
 localStorage.removeItem("jj-token");
 localStorage.removeItem("jj-user-id");
}
function showAuth(){
 hideBoot();
 $("#authShell").hidden=false;$("#setupShell").hidden=true;$("#appShell").hidden=true;
 setAuthMode(location.hash==="#cadastro"?"register":"login");
}
function showSetup(){
 hideBoot();
 $("#authShell").hidden=true;$("#setupShell").hidden=false;$("#appShell").hidden=true;
}
function showApp(){
 hideBoot();
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
  if(j.needsSetup)showSetup();
  else{
   showApp();
   DATA=(Array.isArray(j.data)?j.data:[]).filter(x=>x&&x.data).map(x=>Object.assign({},x,{data:isoDate(x.data)}));
   GRADS=(Array.isArray(j.graduacoes)?j.graduacoes:[]).filter(x=>x&&x.data&&x.faixa).map(x=>Object.assign({},x,{data:isoDate(x.data)}));
   try{if(cacheKey())localStorage.setItem(cacheKey(),JSON.stringify({data:DATA,graduacoes:GRADS,ts:Date.now()}))}catch(_){}
   preencherFiltros();renderResumo();renderHistorico();renderGrads();
  }
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
$("#formRecoveryRequest").onsubmit=async e=>{
 e.preventDefault();
 const email=$("#recoveryEmail").value.trim();
 $("#authStatus").textContent="Enviando código...";
 try{
  const j=await api("requestPasswordReset",{email});
  $("#authStatus").textContent=j.message||"Código enviado.";
  $("#formRecoveryRequest").hidden=true;
  $("#formRecoveryReset").hidden=false;
  $("#recoveryCode").focus();
 }catch(err){$("#authStatus").textContent=err.message}
};
$("#formRecoveryReset").onsubmit=async e=>{
 e.preventDefault();
 const p1=$("#recoveryNewPassword").value,p2=$("#recoveryNewPassword2").value;
 if(p1!==p2){$("#authStatus").textContent="As senhas não conferem.";return;}
 $("#authStatus").textContent="Alterando senha...";
 try{
  const j=await api("resetPassword",{email:$("#recoveryEmail").value.trim(),codigo:$("#recoveryCode").value.trim(),novaSenha:p1});
  $("#authStatus").textContent=j.message||"Senha alterada.";
  $("#loginEmail").value=$("#recoveryEmail").value.trim();
  $("#loginSenha").value="";
  $("#recoveryCode").value="";$("#recoveryNewPassword").value="";$("#recoveryNewPassword2").value="";
  setTimeout(()=>setAuthMode("login"),700);
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
$("#btnTogglePassword").onclick=()=>{
 $("#formChangePassword").hidden=!$("#formChangePassword").hidden;
 $("#passwordStatus").textContent="";
};
$("#formChangePassword").onsubmit=async e=>{
 e.preventDefault();
 const atual=$("#senhaAtual").value,nova=$("#novaSenha").value,nova2=$("#novaSenha2").value;
 if(nova!==nova2){$("#passwordStatus").textContent="As novas senhas não conferem.";return;}
 $("#passwordStatus").textContent="Alterando...";
 try{
  const j=await api("changePassword",{senhaAtual:atual,novaSenha:nova});
  $("#passwordStatus").textContent=j.message||"Senha alterada.";
  $("#senhaAtual").value="";$("#novaSenha").value="";$("#novaSenha2").value="";
  setTimeout(()=>{$("#formChangePassword").hidden=true;$("#passwordStatus").textContent=""},1200);
 }catch(err){$("#passwordStatus").textContent=err.message}
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
function cacheKey(){const uid=(CURRENT_USER&&CURRENT_USER.userId)||localStorage.getItem("jj-user-id")||"";return uid?"jj-last-data-"+uid:"";}
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
function normHeader(s){
 return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();
}
function excelDateToIso(v){
 if(v instanceof Date&&!isNaN(v.getTime())){
  return v.getFullYear()+"-"+String(v.getMonth()+1).padStart(2,"0")+"-"+String(v.getDate()).padStart(2,"0");
 }
 if(typeof v==="number"&&window.XLSX){
  const d=XLSX.SSF.parse_date_code(v);
  if(d)return d.y+"-"+String(d.m).padStart(2,"0")+"-"+String(d.d).padStart(2,"0");
 }
 const s=String(v||"").trim();
 let m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);if(m)return m[1]+"-"+String(m[2]).padStart(2,"0")+"-"+String(m[3]).padStart(2,"0");
 m=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);if(m)return m[3]+"-"+String(m[2]).padStart(2,"0")+"-"+String(m[1]).padStart(2,"0");
 return "";
}
function pickCol(row,aliases){
 const keys=Object.keys(row);
 for(const a of aliases){
  const hit=keys.find(k=>normHeader(k)===a);
  if(hit!=null)return row[hit];
 }
 return "";
}
function parseImportWorkbook(file){
 return new Promise((resolve,reject)=>{
  if(!window.XLSX){reject(new Error("Leitor de Excel não carregou. Verifique sua conexão."));return;}
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error("Não foi possível ler o arquivo."));
  reader.onload=()=>{
   try{
    const wb=XLSX.read(reader.result,{type:"array",cellDates:true});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const raw=XLSX.utils.sheet_to_json(ws,{defval:"",raw:true});
    const rows=[];
    raw.forEach((r,i)=>{
      const data=excelDateToIso(pickCol(r,["DATA","DATE","DT TREINO","DATA TREINO"]));
      const local=String(pickCol(r,["LOCAL","ACADEMIA","LOCAL TREINO"])||"TEGA").trim()||"TEGA";
      let tipo=normHeader(pickCol(r,["TIPO","MODALIDADE","GI NOGI","GI NO GI"])).replace(/ /g,"");
      if(tipo==="NO-GI"||tipo==="NO GI")tipo="NOGI";
      if(!tipo)tipo="GI";
      const observacao=String(pickCol(r,["OBSERVACAO","OBSERVACOES","OBS","NOTA","NOTAS"])||"").trim();
      if(!data)return;
      rows.push({data,local,tipo,observacao,_linha:i+2});
    });
    if(!rows.length)throw new Error("Não encontrei treinos válidos. A planilha precisa ter uma coluna DATA.");
    resolve(rows);
   }catch(err){reject(err)}
  };
  reader.readAsArrayBuffer(file);
 });
}
function renderImportPreview(rows){
 const el=$("#importPreview");el.hidden=false;
 const sample=rows.slice(0,5);
 el.innerHTML='<div class="import-summary"><strong>'+rows.length+'</strong><span> treinos encontrados</span></div>'+
 '<div class="import-table-wrap"><table><thead><tr><th>Data</th><th>Local</th><th>Tipo</th><th>Observação</th></tr></thead><tbody>'+
 sample.map(r=>'<tr><td>'+fmt(r.data)+'</td><td>'+esc(r.local)+'</td><td>'+esc(r.tipo)+'</td><td>'+esc(r.observacao)+'</td></tr>').join("")+
 '</tbody></table></div><button id="btnConfirmImport" class="primary full" type="button">Importar '+rows.length+' treinos</button>';
 $("#btnConfirmImport").onclick=async()=>{
  $("#importStatus").textContent="Importando...";
  $("#btnConfirmImport").disabled=true;
  try{
   const clean=rows.map(({data,local,tipo,observacao})=>({data,local,tipo,observacao}));
   const j=await api("importTreinos",{treinos:clean});
   $("#importStatus").textContent=j.inserted+" importados"+(j.skipped?" • "+j.skipped+" duplicados ignorados":"")+".";
   el.hidden=true;$("#fileImportExcel").value="";
   await carregar();
  }catch(err){$("#importStatus").textContent=err.message;$("#btnConfirmImport").disabled=false}
 };
}
$("#btnDownloadExcelModel").onclick=()=>{
 if(!window.XLSX){$("#importStatus").textContent="Leitor de Excel não carregou. Verifique sua conexão.";return;}
 const dados=[
  ["DATA","LOCAL","TIPO","OBSERVACAO"],
  ["25/09/2026","TEGA","GI","Exemplo - apague esta linha antes de importar"],
  ["26/09/2026","TEGA","NOGI","Exemplo - apague esta linha antes de importar"]
 ];
 const ws=XLSX.utils.aoa_to_sheet(dados);
 ws["!cols"]=[{wch:14},{wch:22},{wch:12},{wch:48}];
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,ws,"TREINOS");
 XLSX.writeFile(wb,"modelo-importacao-treinos.xlsx",{compression:true});
};
$("#btnImportExcel").onclick=()=>$("#fileImportExcel").click();
$("#fileImportExcel").onchange=async e=>{
 const file=e.target.files&&e.target.files[0];if(!file)return;
 $("#importStatus").textContent="Lendo planilha...";
 try{
  const rows=await parseImportWorkbook(file);
  $("#importStatus").textContent="";
  renderImportPreview(rows);
 }catch(err){$("#importStatus").textContent=err.message;$("#importPreview").hidden=true}
};

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

 let cached=null;
 try{cached=cacheKey()?JSON.parse(localStorage.getItem(cacheKey())||"null"):null}catch(_){}
 if(cached&&Array.isArray(cached.data)){
  DATA=cached.data;GRADS=Array.isArray(cached.graduacoes)?cached.graduacoes:[];
  showApp();preencherFiltros();renderResumo();renderHistorico();renderGrads();
 }

 try{
  const j=await api("bootstrap");
  CURRENT_USER=j.user;
  $("#perfilNome").textContent=CURRENT_USER.nome||"—";$("#perfilEmail").textContent=CURRENT_USER.email||"";
  const grads=Array.isArray(j.graduacoes)?j.graduacoes:[];
  if(!grads.length){showSetup();return;}
  showApp();
  DATA=(Array.isArray(j.data)?j.data:[]).filter(x=>x&&x.data).map(x=>Object.assign({},x,{data:isoDate(x.data)}));
  GRADS=grads.filter(x=>x&&x.data&&x.faixa).map(x=>Object.assign({},x,{data:isoDate(x.data)}));
  try{if(cacheKey())localStorage.setItem(cacheKey(),JSON.stringify({data:DATA,graduacoes:GRADS,ts:Date.now()}))}catch(_){}
  preencherFiltros();renderResumo();renderHistorico();renderGrads();
 }catch(e){
  if(!cached){if(TOKEN)$("#authStatus").textContent=e.message;showAuth();}
 }
}
bootstrap();