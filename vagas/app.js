/* Chácara das Flores | app web responsiva / PWA */
(function(){
"use strict";
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const API=String(window.VAGAS_API_URL||"").trim();
const ONE=String(window.VAGAS_ONESIGNAL_APP_ID||"").trim();
const KEY="chacara_vagas_token";
let token=localStorage.getItem(KEY)||"", me=null, data={}, deferredInstall=null, current="inicio", searchParams=null, refreshing=false, oneStarted=false;
const h=v=>String(v===undefined||v===null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const val=id=>$("#"+id)?.value||"";
const dt=s=>{if(!s)return"";const [date,time]=s.split("T");const p=date.split("-");return p.length===3?p[2]+"/"+p[1]+"/"+p[0]+(time?" "+time.slice(0,5):""):s};
const isoLocal=d=>{const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")+"T"+String(x.getHours()).padStart(2,"0")+":"+String(x.getMinutes()).padStart(2,"0")};
const now=()=>isoLocal(new Date());
const err=e=>{const msg=e&&e.message||String(e);toast(msg,true);return msg};
const empty=text=>'<div class="empty">'+h(text)+'</div>';
const badge=s=>{let c={CONFIRMADA:"green",EM_USO:"blue",PENDENTE:"amber",ATRASADA:"red",CANCELADA:"red",REJEITADA:"red",FINALIZADA:""}[s]||"";return '<span class="badge '+c+'">'+h(String(s||"").replaceAll("_"," "))+'</span>'};
function toast(t,bad){const o=$("#toast");o.textContent=t;o.classList.remove("hide");o.style.background=bad?"#933d42":"#113f75";clearTimeout(toast.timer);toast.timer=setTimeout(()=>o.classList.add("hide"),5000)}
async function api(action,payload){
 if(!API)throw Error("Integração com o servidor ainda não ativada. Configure o endereço do Apps Script em config.js.");
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),25000);
 try{
  const response=await fetch(API,{method:"POST",redirect:"follow",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:JSON.stringify(Object.assign({action,token},payload||{})),signal:ctrl.signal});
  if(!response.ok)throw Error("Servidor indisponível (HTTP "+response.status+").");
  const json=await response.json();if(!json.ok)throw Error(json.error||"Operação não realizada");return json.data||{};
 }catch(e){if(e.name==="AbortError")throw Error("Tempo de resposta excedido.");throw e}finally{clearTimeout(timeout)}
}
async function action(name,payload,ok){try{const r=await api(name,payload);toast(ok||"Operação concluída");await reload();return r}catch(e){err(e)}}
function route(name){current=name;$$("[data-view]").forEach(el=>el.classList.toggle("hide",el.dataset.view!==name));$$("[data-page]").forEach(el=>el.classList.toggle("active",el.dataset.page===name));window.scrollTo({top:0,behavior:"smooth"});if(name==="busca")search(false);if(name==="config")renderConfig()}
function showAuth(show){$("#loginView").classList.toggle("hide",!show);$("#appView").classList.toggle("hide",show);$("#topnav").classList.toggle("hide",show);$("#bottomnav").classList.toggle("hide",show);$("#logoutBtn").classList.toggle("hide",show);$("#headerName").textContent=show?"":(me?me.nome.split(" ")[0]:"")}
function initDates(){const local=isoLocal(new Date());["homeDate","searchDate"].forEach(id=>$("#"+id).value=local.slice(0,10));const next=new Date(Date.now()+3600000);$("#avStart").value=isoLocal(next);$("#avEnd").value=isoLocal(new Date(next.getTime()+3600000))}
async function login(e){e.preventDefault();const btn=e.submitter;if(btn)btn.disabled=true;try{const r=await api("login",{email:val("email"),pin:val("pin")});token=r.token;localStorage.setItem(KEY,token);await reload();toast("Bem-vindo ao sistema de vagas")}catch(ex){err(ex)}finally{if(btn)btn.disabled=false}}
async function register(e){e.preventDefault();const form=e.target;let x=Object.fromEntries(new FormData(form));try{await api("register",x);toast("Cadastro enviado. Aguarde a aprovação da administração.");$("#registerForm").reset();switchRegister(false)}catch(ex){err(ex)}}
function switchRegister(register){$("#registerForm").classList.toggle("hide",!register);$("#loginForm").classList.toggle("hide",register);$("#authTitle").textContent=register?"Cadastro de morador":"Acesso dos moradores";$("#toggleRegister").textContent=register?"Já sou cadastrado. Entrar":"Solicitar cadastro de morador"}
async function reload(){if(!token||refreshing)return;refreshing=true;try{const x=await api("state");me=x.me;data=x;showAuth(false);render();return x}catch(e){token="";me=null;localStorage.removeItem(KEY);showAuth(true);err(e)}finally{refreshing=false}}
function render(){
 $("#greeting").textContent="Olá, "+(me.nome||"morador").split(" ")[0]+" · "+(me.bloco||"")+" / "+(me.apartamento||"");
 $("#headerName").textContent=(me.nome||"").split(" ")[0];
 const list=(data.listings||[]).filter(x=>x.disponivelAgora);
 $("#kpiDisponiveis").textContent=list.length;
 $("#kpiReservas").textContent=(data.reservations||[]).filter(x=>["PENDENTE","CONFIRMADA","EM_USO"].includes(x.status)).length;
 $("#kpiMinhas").textContent=(data.spots||[]).length;
 $("#homeSpots").innerHTML=list.length?list.slice(0,5).map(spotHtml).join(""):empty("Nenhuma vaga está livre neste momento. Use a busca para encontrar outro horário.");
 $("#avVaga").innerHTML=(data.spots||[]).map(x=>'<option value="'+h(x.id)+'">'+h("Vaga "+x.numero+" · "+x.bloco)+'</option>').join("");
 if(!(data.spots||[]).length)$("#avVaga").innerHTML='<option value="">Cadastre uma vaga primeiro</option>';
 $("#mySpots").innerHTML=(data.spots||[]).length?(data.spots||[]).map(x=>'<div class="listrow"><div><strong>Vaga '+h(x.numero)+" · "+h(x.bloco)+'</strong><div class="sub">'+h(x.andar||"")+'</div></div><span class="badge green">Cadastrada</span></div>').join(""):empty("Cadastre sua primeira vaga para disponibilizá-la.");
 const incoming=data.incoming||[];
 $("#myAvailability").innerHTML=(incoming.length?'<h3>Solicitações aguardando sua aprovação</h3>'+incoming.map(x=>'<div class="listrow"><div><strong>'+h(x.vagaLabel)+' · '+h(x.moradorNome)+'</strong><div class="sub">'+h(dt(x.inicio))+" até "+h(dt(x.fim))+" · "+h(x.placa)+'</div></div><div class="actions"><button class="btn small" data-action="approve" data-id="'+h(x.id)+'">Aprovar</button><button class="btn small danger" data-action="reject" data-id="'+h(x.id)+'">Recusar</button></div></div>').join(""):"")+'<h3 style="margin-top:16px">Períodos publicados</h3>'+((data.availability||[]).length?(data.availability||[]).map(x=>'<div class="listrow"><div><strong>'+h(x.vagaLabel)+'</strong><div class="sub">'+h(dt(x.inicio))+" até "+h(dt(x.fim))+'</div><div class="sub">'+(x.aprovacao==="COM_APROVACAO"?"Com aprovação":"Reserva automática")+'</div></div><div class="actions">'+badge(x.status)+'<button class="btn small danger" data-action="endAvailability" data-id="'+h(x.id)+'">Encerrar</button></div></div>').join(""):empty("Você ainda não publicou disponibilidades."));
 $("#myReservations").innerHTML=(data.reservations||[]).length?(data.reservations||[]).map(x=>'<div class="listrow"><div><strong>'+h(x.vagaLabel)+'</strong><div class="sub">'+h(dt(x.inicio))+" até "+h(dt(x.fim))+" · "+h(x.placa)+'</div><div class="sub">'+h(x.ownerLabel||"")+'</div></div><div class="actions">'+badge(x.status)+(x.status==="CONFIRMADA"?'<button class="btn small" data-action="checkin" data-id="'+h(x.id)+'">Já estacionei</button>':"")+(x.status==="EM_USO"?'<button class="btn small" data-action="checkout" data-id="'+h(x.id)+'">Liberei a vaga</button>':"")+(["CONFIRMADA","EM_USO"].includes(x.status)?'<button class="btn small outline" data-action="extend" data-id="'+h(x.id)+'">Prorrogar</button>':"")+(["PENDENTE","CONFIRMADA"].includes(x.status)?'<button class="btn small danger" data-action="cancel" data-id="'+h(x.id)+'">Cancelar</button>':"")+'</div></div>').join(""):empty("Você ainda não possui reservas.");
 $("#myWaitlist").innerHTML=(data.waiting||[]).length?(data.waiting||[]).map(x=>'<div class="listrow"><div><strong>'+h(dt(x.inicio))+' até '+h(dt(x.fim))+'</strong></div>'+badge(x.status)+'</div>').join(""):empty("Você não está aguardando nenhuma vaga.");
 if($("#portaria"))$("#portaria").innerHTML=(data.portaria||[]).length?(data.portaria||[]).map(x=>'<div class="listrow"><div><strong>'+h(x.vagaLabel)+' · '+h(x.morador)+'</strong><div class="sub">'+h(dt(x.inicio))+' até '+h(dt(x.fim))+' · '+h(x.placa)+'</div></div>'+badge(x.status)+'</div>').join(""):empty("Não há reservas confirmadas.");
 $("#myNotices").innerHTML=(data.notices||[]).length?(data.notices||[]).map(x=>'<div class="listrow"><div><strong>'+h(x.titulo)+'</strong><div class="sub">'+h(x.mensagem)+'</div><div class="sub">'+h(dt(x.criado_em.replace(" ","T")))+'</div></div>'+(x.lida==="SIM"?'<span class="badge">Lida</span>':'<span class="badge blue">Nova</span>')+'</div>').join(""):empty("Nenhuma notificação.");
 $("#profileSummary").innerHTML='<strong>'+h(me.nome)+'</strong><br>'+h(me.bloco)+" · Apto "+h(me.apartamento)+"<br>"+h(me.email)+"<br>Perfil: "+h(me.perfil);
 $("#adminSection").classList.toggle("hide",me.perfil!=="ADMIN");
 $("#adminResidents").innerHTML=(data.users||[]).map(x=>'<div class="listrow"><div><strong>'+h(x.nome)+'</strong><div class="sub">'+h(x.bloco)+"/"+h(x.apartamento)+" · "+h(x.email)+'</div></div><div class="actions">'+badge(x.ativo==="SIM"?"CONFIRMADA":"PENDENTE")+(x.ativo!=="SIM"?'<button class="btn small" data-action="activate" data-id="'+h(x.id)+'">Autorizar acesso</button>':"")+'</div></div>').join("")||empty("Sem cadastros pendentes.");
 if(current==="busca")search(false);
 if(ONE)setupOneSignal(false);
}
function spotHtml(x){
 const approve=x.aprovacao==="COM_APROVACAO";
 return '<div class="spot"><div class="spot-icon">🚘</div><div class="spot-main"><h3>'+h(x.vagaLabel)+'</h3><p>'+h(x.andar||"")+" · "+h(dt(x.inicio))+" a "+h(dt(x.fim))+'</p><span class="badge '+(approve?"amber":"green")+'">'+(approve?"Com aprovação":"Reserva automática")+'</span></div><button class="btn small" data-book="'+h(x.id)+'">Solicitar vaga</button></div>'
}
function search(interactive){
 if(!me)return;
 const date=val("searchDate"),ini=val("searchStart"),fim=val("searchEnd");
 if(!date||ini>=fim){if(interactive)toast("O horário final precisa ser posterior à entrada.",true);return}
 searchParams={inicio:date+"T"+ini,fim:date+"T"+fim,placa:val("searchPlaca").toUpperCase().replace(/[^A-Z0-9]/g,"")};
 const r=(data.listings||[]).filter(x=>x.inicio<=searchParams.inicio&&x.fim>=searchParams.fim&&x.vaga_id!==undefined&&!(x.ocupacoes||[]).some(z=>z.inicio<searchParams.fim&&searchParams.inicio<z.fim));
 $("#searchInfo").textContent=r.length+" vaga(s) compatível(is)";
 $("#waitlistActions").classList.toggle("hide",!!r.length);
 $("#searchResults").innerHTML=r.length?r.map(spotHtml).join(""):empty("Nenhuma vaga disponível nesse período. Tente outro horário.");
}
async function booking(id){
 if(!searchParams||!searchParams.placa){route("busca");toast("Informe período e placa para solicitar.",true);return}
 const x=(data.listings||[]).find(z=>z.id===id);if(!x){toast("Disponibilidade desatualizada",true);await reload();return}
 if(x.inicio>searchParams.inicio||x.fim<searchParams.fim){route("busca");toast("Ajuste o horário dentro da disponibilidade da vaga.",true);return}
 const approval=x.aprovacao==="COM_APROVACAO";
 if(!confirm((approval?"Enviar solicitação para aprovação?":"Confirmar reserva automática?")+"\n"+x.vagaLabel+"\n"+dt(searchParams.inicio)+" até "+dt(searchParams.fim)))return;
 try{await api("reserve",{disponibilidade_id:id,inicio:searchParams.inicio,fim:searchParams.fim,placa:searchParams.placa});toast(approval?"Solicitação enviada ao proprietário.":"Reserva confirmada!");await reload();route("reservas")}catch(e){err(e);await reload()}
}
async function submitSpot(e){e.preventDefault();try{await api("addSpot",Object.fromEntries(new FormData(e.target)));e.target.reset();toast("Vaga cadastrada");await reload()}catch(e){err(e)}}
async function publish(e){
 e.preventDefault();
 let start=val("avStart"),end=val("avEnd");
 if(!val("avVaga")){toast("Cadastre uma vaga primeiro.",true);return}
 if(start>=end){toast("Fim deve ser depois do início.",true);return}
 try{await api("publish",{vaga_id:val("avVaga"),inicio:start,fim:end,aprovacao:$('input[name="approval"]:checked').value,recorrencia:val("avRepeat")});toast("Disponibilidade publicada");await reload();route("vagas")}catch(e){err(e)}
}
async function clickAction(button){
 const a=button.dataset.action,id=button.dataset.id;
 if(["reject","cancel","endAvailability"].includes(a)&&!confirm("Confirma esta operação?"))return;
 if(a==="extend"){const novo=prompt("Digite o novo horário de saída no formato AAAA-MM-DDTHH:MM");if(!novo)return;if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(novo)){toast("Formato inválido.",true);return}await action("extend",{id,fim:novo},"Reserva prorrogada");return}
 const mapping={approve:"approve",reject:"reject",cancel:"cancel",checkin:"checkin",checkout:"checkout",endAvailability:"endAvailability",activate:"activate"};
 if(mapping[a])await action(mapping[a],{id},"Atualizado com sucesso");
}
function renderConfig(){
 const b=$("#enablePush");b.disabled=!ONE;
 $("#pushState").textContent=!ONE?"Integração push aguardando configuração do OneSignal.":Notification.permission==="granted"?"Permissão do navegador concedida.":"Toque para autorizar notificações.";
}
async function setupOneSignal(requestPermission){
 if(!ONE||oneStarted&& !requestPermission)return;
 if(!window.OneSignalDeferred)window.OneSignalDeferred=[];
 if(!oneStarted){
  const script=document.createElement("script");script.async=true;script.src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";document.head.appendChild(script);oneStarted=true;
 }
 window.OneSignalDeferred.push(async function(OneSignal){
  try{await OneSignal.init({appId:ONE,serviceWorkerPath:"vagas/sw.js",serviceWorkerParam:{scope:"/vagas/"}});if(me)await OneSignal.login(me.id);if(requestPermission){await OneSignal.Notifications.requestPermission();toast("Configuração de notificações solicitada")}}
  catch(e){if(requestPermission)err(e)}
 });
}
function install(){
 if(deferredInstall){deferredInstall.prompt();deferredInstall.userChoice.finally(()=>deferredInstall=null);return}
 const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
 alert(ios?"No Safari: toque em Compartilhar → Adicionar à Tela de Início. Depois abra o atalho e autorize as notificações.":"No Chrome: abra o menu ⋮ e escolha Adicionar à tela inicial ou Instalar aplicativo.");
}
function wire(){
 $("#loginForm").addEventListener("submit",login);
 $("#registerForm").addEventListener("submit",register);
 $("#toggleRegister").onclick=()=>switchRegister($("#registerForm").classList.contains("hide"));
 $("#logoutBtn").onclick=()=>{token="";me=null;data={};localStorage.removeItem(KEY);showAuth(true);switchRegister(false)};
 $("#spotForm").addEventListener("submit",submitSpot);
 $("#availabilityForm").addEventListener("submit",publish);
 $("#searchForm").addEventListener("submit",e=>{e.preventDefault();search(true)});
 $("#homeSearch").addEventListener("submit",e=>{e.preventDefault();$("#searchDate").value=val("homeDate");$("#searchStart").value=val("homeStart");$("#searchEnd").value=val("homeEnd");route("busca");search(true)});
 document.body.addEventListener("click",async e=>{
  const go=e.target.closest("[data-go],[data-page]");if(go){route(go.dataset.go||go.dataset.page);return}
  const book=e.target.closest("[data-book]");if(book){if(!searchParams){$("#searchDate").value=isoLocal(new Date()).slice(0,10);$("#searchStart").value="08:00";$("#searchEnd").value="18:00";searchParams=null;route("busca");toast("Selecione o horário e a placa.");return}await booking(book.dataset.book);return}
  const a=e.target.closest("[data-action]");if(a)await clickAction(a)
 });
 $("#markRead").onclick=()=>action("readNotices",{},"Notificações marcadas como lidas");
 $("#waitlistBtn").onclick=async()=>{if(!searchParams||!searchParams.placa){toast("Informe primeiro o período e a placa.",true);return}if(!confirm("Deseja receber aviso caso uma vaga seja disponibilizada nesse período?"))return;try{await api("waitlist",searchParams);toast("Lista de espera ativada.");await reload();route("reservas")}catch(e){err(e)}};
 $("#installTop").onclick=install;$("#installSettings").onclick=install;
 $("#enablePush").onclick=async()=>{if(!ONE){renderConfig();return}await setupOneSignal(true)};
 window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("#installBanner").classList.remove("hide")});
 window.addEventListener("appinstalled",()=>{$("#installBanner").classList.add("hide");toast("Atalho instalado")});
 document.addEventListener("visibilitychange",()=>{if(!document.hidden&&token)reload()});
 if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(()=>{});
}
async function main(){
 initDates();wire();
 if(!API)$("#systemAlert").innerHTML='<div class="msg warn"><strong>Instalação em andamento:</strong> a interface foi publicada, mas ainda falta ativar a API do Google Apps Script. Reservas reais não são aceitas até a conexão ser concluída.</div>';
 if(token)await reload();else showAuth(true);
 setInterval(()=>{if(!document.hidden&&token)reload()},60000);
}
document.addEventListener("DOMContentLoaded",main);
})();