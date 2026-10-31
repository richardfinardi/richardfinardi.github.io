/**
 * Chácara das Flores | API de empréstimo de vagas
 * Publicar este arquivo como projeto GOOGLE APPS SCRIPT (Implantar > Aplicativo da Web).
 * CONFIGURAÇÕES OBRIGATÓRIAS em Propriedades do script:
 * ADMIN_EMAIL, BOOTSTRAP_CODE, REGISTRATION_CODE
 * O opcional ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY habilita push.
 * Execute o Apps Script no fuso America/Sao_Paulo e na conta proprietária da planilha.
 * NUNCA coloque as propriedades/segredos no GitHub ou config.js.
 */
const SPREADSHEET_ID="1baP2aPHfxocrl-vACXgYY7g46s1sks4PYmQ_yF-NNMw";
const TZ="America/Sao_Paulo";
const HEADERS={
 MORADORES:["id","nome","bloco","apartamento","email","telefone","placa","perfil","ativo","pin_salt","pin_hash","criado_em"],
 VAGAS:["id","morador_id","bloco","numero","andar","observacoes","ativa","criado_em"],
 DISPONIBILIDADES:["id","vaga_id","inicio","fim","aprovacao","recorrencia","status","criado_em"],
 RESERVAS:["id","disponibilidade_id","vaga_id","solicitante_id","inicio","fim","placa","status","criado_em","atualizado_em","checkin_em","checkout_em"],
 NOTIFICACOES:["id","morador_id","tipo","titulo","mensagem","lida","criado_em","referencia_id"],
 HISTORICO:["id","data_hora","ator_id","acao","entidade","entidade_id","detalhes"],
 SESSOES:["hash_token","morador_id","expira_em","criado_em"],
 CONFIG:["chave","valor","descricao"],
 LISTA_ESPERA:["id","morador_id","inicio","fim","placa","status","criado_em","notificado_em"]
};
function doGet(e){return out_({ok:true,data:{name:"Chácara das Flores Vagas",status:"api-online",version:"1.0.0"}})}
function doPost(e){
 try{
  let req=JSON.parse((e.postData&&e.postData.contents)||"{}");
  let result=route_(req);
  return out_({ok:true,data:result});
 }catch(err){console.error(err&&err.stack||err);return out_({ok:false,error:String(err.message||err)})}
}
function out_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
function require_(v,msg){if(!v)throw Error(msg)}
function uuid_(){return Utilities.getUuid()}
function timestamp_(){return Utilities.formatDate(new Date(),TZ,"yyyy-MM-dd'T'HH:mm:ss")}
function clock_(){return Utilities.formatDate(new Date(),TZ,"yyyy-MM-dd'T'HH:mm")}
function property_(name){return PropertiesService.getScriptProperties().getProperty(name)||""}
function pepper_(){let p=property_("SESSION_PEPPER");if(!p){p=uuid_()+uuid_();PropertiesService.getScriptProperties().setProperty("SESSION_PEPPER",p)}return p}
function hash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8).map(x=>("0"+(x&255).toString(16)).slice(-2)).join("")}
function sheet_(name){const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);require_(sh,"Aba inexistente: "+name);return sh}
function all_(name){
 const sh=sheet_(name), values=sh.getDataRange().getDisplayValues(), headers=HEADERS[name];if(values.length<=1)return[];
 return values.slice(1).map((a,i)=>{let o={_row:i+2};headers.forEach((h,j)=>o[h]=String(a[j]||""));return o}).filter(x=>x.id||name==="CONFIG"&&x.chave||name==="SESSOES"&&x.hash_token);
}
function byId_(name,id){return all_(name).find(x=>x.id===String(id))}
function insert_(name,arr){let row=HEADERS[name].map(k=>arr[k]===undefined?"":String(arr[k]));sheet_(name).appendRow(row);return arr}
function patch_(name,row,changes){const headers=HEADERS[name],sh=sheet_(name);Object.keys(changes).forEach(k=>{let j=headers.indexOf(k);if(j!==-1)sh.getRange(row._row,j+1).setValue(String(changes[k]))});Object.assign(row,changes);return row}
function withLock_(fn){const lock=LockService.getScriptLock();require_(lock.tryLock(20000),"Sistema ocupado, tente novamente.");try{return fn()}finally{lock.releaseLock()}}
function clean_(v,max){return String(v||"").trim().slice(0,max||180)}
function mail_(v){return clean_(v,180).toLowerCase()}
function pinHash_(pin,salt){return hash_(salt+"|"+pin+"|"+pepper_())}
function publicUser_(u){return {id:u.id,nome:u.nome,bloco:u.bloco,apartamento:u.apartamento,email:u.email,telefone:u.telefone,placa:u.placa,perfil:u.perfil,ativo:u.ativo}}
function session_(token){
 require_(token&&String(token).length>=30,"Faça login para continuar.");
 const ss=all_("SESSOES").find(x=>x.hash_token===hash_(token));
 require_(ss&&Date.parse(ss.expira_em)>Date.now(),"Sessão expirada. Entre novamente.");
 const u=byId_("MORADORES",ss.morador_id);
 require_(u&&u.ativo==="SIM","Usuário não autorizado.");
 return u;
}
function log_(u,action,entity,id,detail){insert_("HISTORICO",{id:uuid_(),data_hora:timestamp_(),ator_id:u&&u.id||"SYSTEM",acao:action,entidade:entity,entidade_id:id,detalhes:clean_(detail,1500)})}
function push_(uid,title,message){
 const app=property_("ONESIGNAL_APP_ID"),key=property_("ONESIGNAL_REST_API_KEY");
 if(!app||!key)return;
 try{
  UrlFetchApp.fetch("https://api.onesignal.com/notifications",{
   method:"post",contentType:"application/json",muteHttpExceptions:true,
   headers:{Authorization:"Key "+key},
   payload:JSON.stringify({app_id:app,include_aliases:{external_id:[uid]},target_channel:"push",headings:{en:title,pt:title},contents:{en:message,pt:message},url:"https://consultoriarf.net/vagas/"})
  });
 }catch(e){console.warn("Push não enviado: "+e.message)}
}
function notify_(uid,type,title,msg,ref){
 insert_("NOTIFICACOES",{id:uuid_(),morador_id:uid,tipo:type,titulo:title,mensagem:msg,lida:"NAO",criado_em:timestamp_(),referencia_id:ref||""});
 push_(uid,title,msg);
}
function route_(r){
 const a=clean_(r.action,60);
 if(a==="register")return withLock_(()=>register_(r));
 if(a==="login")return withLock_(()=>login_(r));
 const user=session_(r.token);
 if(a==="state")return state_(user);
 if(a==="addSpot")return withLock_(()=>addSpot_(user,r));
 if(a==="publish")return withLock_(()=>publish_(user,r));
 if(a==="reserve")return withLock_(()=>reserve_(user,r));
 if(a==="approve")return withLock_(()=>decide_(user,r,true));
 if(a==="reject")return withLock_(()=>decide_(user,r,false));
 if(a==="cancel")return withLock_(()=>cancel_(user,r));
 if(a==="endAvailability")return withLock_(()=>endAvailability_(user,r));
 if(a==="checkin")return withLock_(()=>checkin_(user,r));
 if(a==="checkout")return withLock_(()=>checkout_(user,r));
 if(a==="activate")return withLock_(()=>activate_(user,r));
 if(a==="readNotices")return withLock_(()=>readNotices_(user));
 if(a==="waitlist")return withLock_(()=>waitlist_(user,r));
 if(a==="extend")return withLock_(()=>extend_(user,r));
 throw Error("Ação desconhecida.");
}
function register_(r){
 const email=mail_(r.email),name=clean_(r.nome,100),bloco=clean_(r.bloco,50),apto=clean_(r.apartamento,25),pin=String(r.pin||"");
 require_(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),"E-mail inválido.");
 require_(name.length>=3&&bloco&&apto&&pin.length>=6,"Preencha todos os dados obrigatórios.");
 require_(!all_("MORADORES").some(x=>x.email===email),"Este e-mail já está cadastrado.");
 const hasAdmin=all_("MORADORES").some(x=>x.perfil==="ADMIN");
 const adminEmail=mail_(property_("ADMIN_EMAIL"));
 const isFirstAdmin=!hasAdmin&&email===adminEmail&&property_("BOOTSTRAP_CODE")&&String(r.codigo)===property_("BOOTSTRAP_CODE");
 const normalCode=property_("REGISTRATION_CODE");
 require_(isFirstAdmin||(normalCode&&String(r.codigo)===normalCode),"Código de cadastro inválido.");
 const id=uuid_(),salt=uuid_()+uuid_(),u={
  id,nome:name,bloco,apartamento:apto,email,telefone:clean_(r.telefone,24),placa:clean_(r.placa,7).toUpperCase(),
  perfil:isFirstAdmin?"ADMIN":"MORADOR",ativo:isFirstAdmin?"SIM":"PENDENTE",
  pin_salt:salt,pin_hash:pinHash_(pin,salt),criado_em:timestamp_()
 };
 insert_("MORADORES",u);log_(u,"CADASTRO","MORADORES",id,isFirstAdmin?"Administrador inicial":"Aguardando aprovação");
 if(!isFirstAdmin)all_("MORADORES").filter(x=>x.perfil==="ADMIN"&&x.ativo==="SIM").forEach(admin=>notify_(admin.id,"CADASTRO","Novo morador aguardando aprovação",name+" · "+bloco+"/"+apto,id));
 return {status:u.ativo};
}
function login_(r){
 const email=mail_(r.email),pin=String(r.pin||"");
 const cache=CacheService.getScriptCache(),key="login:"+hash_(email),tries=Number(cache.get(key)||0);
 require_(tries<6,"Muitas tentativas. Aguarde 15 minutos.");
 const u=all_("MORADORES").find(x=>x.email===email);
 if(!u||u.pin_hash!==pinHash_(pin,u.pin_salt)){cache.put(key,String(tries+1),900);throw Error("E-mail ou senha incorretos.")}
 require_(u.ativo==="SIM","Cadastro aguardando autorização da administração.");
 cache.remove(key);
 const token=uuid_().replace(/-/g,"")+uuid_().replace(/-/g,"");
 insert_("SESSOES",{hash_token:hash_(token),morador_id:u.id,expira_em:new Date(Date.now()+7*86400000).toISOString(),criado_em:timestamp_()});
 return {token,me:publicUser_(u)};
}
function validatePeriod_(start,end,requireFuture){
 const pattern=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
 require_(pattern.test(start)&&pattern.test(end),"Data/hora inválida.");
 require_(start<end,"O fim deve ser posterior ao início.");
 if(requireFuture)require_(start>=clock_(),"Escolha um período futuro.");
 require_(Date.parse(end+"-03:00")-Date.parse(start+"-03:00")<=31*86400000,"Período maior que o limite de 31 dias.");
}
function overlaps_(a,b,c,d){return a<d&&c<b}
function cap_(user){
 const active=all_("RESERVAS").filter(x=>x.solicitante_id===user.id&&["PENDENTE","CONFIRMADA","EM_USO"].includes(x.status)&&x.fim>clock_());
 require_(active.length<2,"Limite de 2 reservas ativas. Finalize uma reserva antes de solicitar outra.");
}
function spotLabel_(x){return "Vaga "+x.numero+" · "+x.bloco}
function addSpot_(u,r){
 const numero=clean_(r.numero,20),bloco=clean_(r.bloco,50),andar=clean_(r.andar,50);
 require_(numero&&bloco,"Informe bloco e número da vaga.");
 require_(!all_("VAGAS").some(s=>s.bloco.toLowerCase()===bloco.toLowerCase()&&s.numero.toLowerCase()===numero.toLowerCase()&&s.ativa==="SIM"),"Esta vaga já está cadastrada.");
 const s=insert_("VAGAS",{id:uuid_(),morador_id:u.id,bloco,numero,andar,observacoes:clean_(r.observacoes,200),ativa:"SIM",criado_em:timestamp_()});log_(u,"CADASTRAR_VAGA","VAGAS",s.id,spotLabel_(s));return {id:s.id};
}
function addDays_(str,days){
 const d=str.slice(0,10).split("-").map(Number);
 const utc=new Date(Date.UTC(d[0],d[1]-1,d[2]+days));return utc.toISOString().slice(0,10)+str.slice(10);
}
function publish_(u,r){
 const s=byId_("VAGAS",r.vaga_id);require_(s&&s.morador_id===u.id&&s.ativa==="SIM","Vaga não localizada.");
 const approval=r.aprovacao==="COM_APROVACAO"?"COM_APROVACAO":"AUTOMATICA";
 const count=r.recorrencia==="SEMANAL_4"?4:1, created=[];
 for(let i=0;i<count;i++){
  const start=addDays_(clean_(r.inicio,16),i*7),end=addDays_(clean_(r.fim,16),i*7);
  validatePeriod_(start,end,true);
  require_(!all_("DISPONIBILIDADES").some(x=>x.vaga_id===s.id&&x.status==="ATIVA"&&overlaps_(x.inicio,x.fim,start,end)),"A vaga já possui disponibilidade sobreposta: "+start);
  created.push({id:uuid_(),vaga_id:s.id,inicio:start,fim:end,aprovacao:approval,recorrencia:count>1?"SEMANAL_4":"NAO",status:"ATIVA",criado_em:timestamp_()});
 }
 created.forEach(x=>insert_("DISPONIBILIDADES",x));
 log_(u,"PUBLICAR_DISPONIBILIDADE","VAGAS",s.id,count+" intervalo(s) · "+approval);notifyWaitlist_();return {ids:created.map(x=>x.id)};
}
function occupancy_(vagaId,start,end,ignore){
 return all_("RESERVAS").find(x=>x.vaga_id===vagaId&&x.id!==ignore&&["CONFIRMADA","EM_USO"].includes(x.status)&&overlaps_(x.inicio,x.fim,start,end));
}
function reserve_(u,r){
 const disp=byId_("DISPONIBILIDADES",r.disponibilidade_id);
 require_(disp&&disp.status==="ATIVA","Esta disponibilidade não existe mais.");
 const spot=byId_("VAGAS",disp.vaga_id);
 require_(spot&&spot.ativa==="SIM","Vaga indisponível.");
 require_(spot.morador_id!==u.id,"Você não pode reservar sua própria vaga.");
 const start=clean_(r.inicio,16),end=clean_(r.fim,16),placa=clean_(r.placa,7).toUpperCase();
 validatePeriod_(start,end,true);
 require_(start>=disp.inicio&&end<=disp.fim,"Horário fora da disponibilidade publicada.");
 require_(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa),"Placa inválida.");
 cap_(u);
 require_(!all_("RESERVAS").some(x=>x.solicitante_id===u.id&&["PENDENTE","CONFIRMADA","EM_USO"].includes(x.status)&&overlaps_(x.inicio,x.fim,start,end)),"Você já possui reserva nesse horário.");
 require_(!occupancy_(spot.id,start,end,null),"A vaga acabou de ser reservada nesse horário.");
 const status=disp.aprovacao==="COM_APROVACAO"?"PENDENTE":"CONFIRMADA";
 const reservation=insert_("RESERVAS",{id:uuid_(),disponibilidade_id:disp.id,vaga_id:spot.id,solicitante_id:u.id,inicio:start,fim:end,placa,status,criado_em:timestamp_(),atualizado_em:timestamp_(),checkin_em:"",checkout_em:""});
 const owner=byId_("MORADORES",spot.morador_id);
 notify_(owner.id,"RESERVA",status==="PENDENTE"?"Nova solicitação de vaga":"Vaga reservada",u.nome+" solicitou "+spotLabel_(spot)+" · "+start+" até "+end,reservation.id);
 notify_(u.id,"RESERVA",status==="PENDENTE"?"Solicitação enviada":"Reserva confirmada",spotLabel_(spot)+" · "+start+" até "+end,reservation.id);
 log_(u,status==="PENDENTE"?"SOLICITAR_RESERVA":"RESERVAR","RESERVAS",reservation.id,spotLabel_(spot));return {id:reservation.id,status};
}
function decide_(u,r,approve){
 const reservation=byId_("RESERVAS",r.id);require_(reservation&&reservation.status==="PENDENTE","Solicitação não está pendente.");
 const spot=byId_("VAGAS",reservation.vaga_id);require_(spot&&spot.morador_id===u.id,"Somente o proprietário pode decidir.");
 const disp=byId_("DISPONIBILIDADES",reservation.disponibilidade_id);require_(disp&&disp.status==="ATIVA","Disponibilidade encerrada.");
 if(approve)require_(!occupancy_(spot.id,reservation.inicio,reservation.fim,reservation.id),"Já existe reserva confirmada neste intervalo.");
 const status=approve?"CONFIRMADA":"REJEITADA";patch_("RESERVAS",reservation,{status,atualizado_em:timestamp_()});
 const guest=byId_("MORADORES",reservation.solicitante_id);
 notify_(guest.id,"APROVACAO",approve?"Reserva aprovada":"Reserva recusada",spotLabel_(spot)+" · "+reservation.inicio+" até "+reservation.fim,reservation.id);
 log_(u,approve?"APROVAR":"REJEITAR","RESERVAS",reservation.id,spotLabel_(spot));return {status};
}
function cancel_(u,r){
 const x=byId_("RESERVAS",r.id);require_(x&&x.solicitante_id===u.id,"Reserva não encontrada.");
 require_(["PENDENTE","CONFIRMADA"].includes(x.status),"Esta reserva não pode ser cancelada.");
 patch_("RESERVAS",x,{status:"CANCELADA",atualizado_em:timestamp_()});
 const spot=byId_("VAGAS",x.vaga_id);notify_(spot.morador_id,"CANCELAMENTO","Reserva cancelada",u.nome+" cancelou "+spotLabel_(spot)+" · "+x.inicio,x.id);
 log_(u,"CANCELAR","RESERVAS",x.id,spotLabel_(spot));notifyWaitlist_();return {status:"CANCELADA"};
}
function endAvailability_(u,r){
 const x=byId_("DISPONIBILIDADES",r.id),spot=x&&byId_("VAGAS",x.vaga_id);
 require_(x&&spot&&spot.morador_id===u.id,"Disponibilidade não encontrada.");
 require_(!all_("RESERVAS").some(z=>z.disponibilidade_id===x.id&&["PENDENTE","CONFIRMADA","EM_USO"].includes(z.status)),"Há solicitações ou reservas em andamento. Resolva-as antes de encerrar.");
 patch_("DISPONIBILIDADES",x,{status:"ENCERRADA"});log_(u,"ENCERRAR","DISPONIBILIDADES",x.id,"");return {};
}
function checkin_(u,r){
 const x=byId_("RESERVAS",r.id);require_(x&&x.solicitante_id===u.id&&x.status==="CONFIRMADA","Reserva não confirmada.");
 const now=clock_(),early=new Date(Date.parse(x.inicio+"-03:00")-30*60000);
 require_(now<=x.fim&&Date.now()>=early.getTime(),"Check-in permitido 30 minutos antes do início até o fim da reserva.");
 patch_("RESERVAS",x,{status:"EM_USO",checkin_em:timestamp_(),atualizado_em:timestamp_()});log_(u,"CHECKIN","RESERVAS",x.id,"");return {};
}
function checkout_(u,r){
 const x=byId_("RESERVAS",r.id);require_(x&&x.solicitante_id===u.id&&x.status==="EM_USO","Reserva não está em uso.");
 patch_("RESERVAS",x,{status:"FINALIZADA",checkout_em:timestamp_(),atualizado_em:timestamp_()});
 const spot=byId_("VAGAS",x.vaga_id);notify_(spot.morador_id,"LIBERACAO","Sua vaga foi liberada",u.nome+" liberou "+spotLabel_(spot),x.id);
 log_(u,"CHECKOUT","RESERVAS",x.id,"");notifyWaitlist_();return {};
}
function activate_(u,r){
 require_(u.perfil==="ADMIN","Ação restrita ao administrador.");
 const target=byId_("MORADORES",r.id);require_(target&&target.ativo==="PENDENTE","Cadastro não está pendente.");
 patch_("MORADORES",target,{ativo:"SIM"});notify_(target.id,"CADASTRO","Cadastro aprovado","Você já pode entrar no Sistema de Vagas.",target.id);
 log_(u,"ATIVAR_MORADOR","MORADORES",target.id,target.email);return {};
}
function readNotices_(u){
 all_("NOTIFICACOES").filter(x=>x.morador_id===u.id&&x.lida!=="SIM").forEach(x=>patch_("NOTIFICACOES",x,{lida:"SIM"}));return {};
}
function waitlist_(u,r){
 const start=clean_(r.inicio,16),end=clean_(r.fim,16),placa=clean_(r.placa,7).toUpperCase();
 validatePeriod_(start,end,true);
 require_(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa),"Placa inválida.");
 require_(!all_("LISTA_ESPERA").some(x=>x.morador_id===u.id&&x.inicio===start&&x.fim===end&&x.status==="AGUARDANDO"),"Você já está na lista de espera desse período.");
 const item=insert_("LISTA_ESPERA",{id:uuid_(),morador_id:u.id,inicio:start,fim:end,placa,status:"AGUARDANDO",criado_em:timestamp_(),notificado_em:""});
 log_(u,"ENTRAR_LISTA_ESPERA","LISTA_ESPERA",item.id,start+" - "+end);
 return {id:item.id};
}
function notifyWaitlist_(){
 const waiting=all_("LISTA_ESPERA").filter(x=>x.status==="AGUARDANDO"&&x.fim>clock_());
 if(!waiting.length)return;
 const avail=all_("DISPONIBILIDADES").filter(x=>x.status==="ATIVA"),spots=all_("VAGAS");
 for(const w of waiting){
  const choice=avail.find(a=>a.inicio<=w.inicio&&a.fim>=w.fim&&spots.some(s=>s.id===a.vaga_id&&s.ativa==="SIM"&&s.morador_id!==w.morador_id)&&!occupancy_(a.vaga_id,w.inicio,w.fim,null));
  if(!choice)continue;
  patch_("LISTA_ESPERA",w,{status:"NOTIFICADA",notificado_em:timestamp_()});
  notify_(w.morador_id,"LISTA_ESPERA","Uma vaga ficou disponível!","Há disponibilidade entre "+w.inicio+" e "+w.fim+". Acesse o sistema para reservar.",w.id);
 }
}
function extend_(u,r){
 const x=byId_("RESERVAS",r.id);require_(x&&x.solicitante_id===u.id,"Reserva não encontrada.");
 require_(["CONFIRMADA","EM_USO"].includes(x.status),"Somente reservas confirmadas ou em uso podem ser prorrogadas.");
 const disp=byId_("DISPONIBILIDADES",x.disponibilidade_id);
 require_(disp&&disp.status==="ATIVA","Disponibilidade encerrada.");
 require_(disp.aprovacao==="AUTOMATICA","Esta vaga exige aprovação; consulte o proprietário para solicitar outro período.");
 const next=clean_(r.fim,16);validatePeriod_(x.inicio,next,false);
 require_(next>x.fim&&next<=disp.fim,"A nova saída deve ser posterior à atual e dentro da disponibilidade.");
 require_(!occupancy_(x.vaga_id,x.inicio,next,x.id),"Há outra reserva neste horário.");
 patch_("RESERVAS",x,{fim:next,atualizado_em:timestamp_()});
 const spot=byId_("VAGAS",x.vaga_id);
 notify_(spot.morador_id,"PRORROGACAO","Reserva prorrogada",u.nome+" prorrogou "+spotLabel_(spot)+" até "+next,x.id);
 log_(u,"PRORROGAR","RESERVAS",x.id,next);return {fim:next};
}
/** Execute esta função uma vez no editor Apps Script para criar lembretes a cada 15 min. */
function setupTriggers(){
 const has=ScriptApp.getProjectTriggers().some(x=>x.getHandlerFunction()==="processReminders");
 if(!has)ScriptApp.newTrigger("processReminders").timeBased().everyMinutes(15).create();
}
/** Envio de lembretes; não confirma saída de veículo automaticamente. */
function processReminders(){
 return withLock_(()=>{
  const now=Date.now(), notices=all_("NOTIFICACOES"),res=all_("RESERVAS");
  for(const x of res){
   if(x.status!=="CONFIRMADA"&&x.status!=="EM_USO")continue;
   const start=Date.parse(x.inicio+"-03:00"),end=Date.parse(x.fim+"-03:00");
   const soon=x.status==="CONFIRMADA"&&start>now&&start-now<=3600000;
   const late=x.status==="EM_USO"&&now>end;
   const type=soon?"LEMBRETE_1H":late?"ATRASO":"";
   if(!type||notices.some(n=>n.referencia_id===x.id&&n.tipo===type))continue;
   const message=soon?"Sua reserva começa em menos de uma hora.":"O período reservado terminou. Libere a vaga e registre a saída.";
   notify_(x.solicitante_id,type,soon?"Sua reserva está próxima":"Horário da vaga encerrado",message,x.id);
  }
  notifyWaitlist_();
  return true;
 });
}
function state_(u){
 const now=clock_(),users=all_("MORADORES"),spots=all_("VAGAS"),av=all_("DISPONIBILIDADES"),res=all_("RESERVAS");
 const label=id=>{let s=spots.find(x=>x.id===id);return s?spotLabel_(s):"Vaga indisponível"};
 const listings=av.filter(a=>a.status==="ATIVA"&&a.fim>now).map(a=>{
  const spot=spots.find(s=>s.id===a.vaga_id),owner=spot&&users.find(x=>x.id===spot.morador_id);
  if(!spot||spot.ativa!=="SIM"||spot.morador_id===u.id)return null;
  const ocupacoes=res.filter(x=>x.vaga_id===spot.id&&["CONFIRMADA","EM_USO"].includes(x.status)).map(x=>({inicio:x.inicio,fim:x.fim}));
  const livreAgora=a.inicio<=now&&a.fim>now&&!ocupacoes.some(x=>x.inicio<=now&&x.fim>now);
  return {id:a.id,vaga_id:spot.id,vagaLabel:spotLabel_(spot),andar:spot.andar,inicio:a.inicio,fim:a.fim,aprovacao:a.aprovacao,disponivelAgora:livreAgora,ocupacoes};
 }).filter(Boolean);
 const mine=spots.filter(s=>s.morador_id===u.id&&s.ativa==="SIM").map(s=>({id:s.id,bloco:s.bloco,numero:s.numero,andar:s.andar}));
 const ownAvail=av.filter(a=>mine.some(x=>x.id===a.vaga_id)).map(a=>({id:a.id,vagaLabel:label(a.vaga_id),inicio:a.inicio,fim:a.fim,aprovacao:a.aprovacao,status:a.status}));
 const mineReservations=res.filter(x=>x.solicitante_id===u.id).map(x=>{
  const spot=spots.find(s=>s.id===x.vaga_id),owner=spot&&users.find(p=>p.id===spot.morador_id);
  return {id:x.id,vagaLabel:label(x.vaga_id),inicio:x.inicio,fim:x.fim,placa:x.placa,status:x.status,ownerLabel:owner?"Disponibilizada por: "+owner.bloco+"/"+owner.apartamento:""};
 }).sort((a,b)=>b.inicio.localeCompare(a.inicio)).slice(0,120);
 const incoming=res.filter(x=>x.status==="PENDENTE"&&mine.some(s=>s.id===x.vaga_id)).map(x=>{
  const guest=users.find(p=>p.id===x.solicitante_id);
  return {id:x.id,vagaLabel:label(x.vaga_id),moradorNome:guest?guest.nome:"Morador",inicio:x.inicio,fim:x.fim,placa:x.placa};
 });
 const notices=all_("NOTIFICACOES").filter(x=>x.morador_id===u.id).sort((a,b)=>b.criado_em.localeCompare(a.criado_em)).slice(0,100);
 return {me:publicUser_(u),listings,spots:mine,availability:ownAvail,reservations:mineReservations,incoming,notices,waiting:all_("LISTA_ESPERA").filter(x=>x.morador_id===u.id&&x.fim>now).map(x=>({id:x.id,inicio:x.inicio,fim:x.fim,status:x.status})),users:u.perfil==="ADMIN"?users.map(publicUser_):[],portaria:u.perfil==="ADMIN"||u.perfil==="PORTARIA"?res.filter(x=>["CONFIRMADA","EM_USO"].includes(x.status)&&x.fim>=now).map(x=>({id:x.id,vagaLabel:label(x.vaga_id),inicio:x.inicio,fim:x.fim,placa:x.placa,status:x.status,morador:((users.find(y=>y.id===x.solicitante_id))||{}).nome||""})):[]};
}