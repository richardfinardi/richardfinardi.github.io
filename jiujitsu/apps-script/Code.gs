const SHEET_ID='1fn-RSRPiq86bG7m84TeMUrhpGyCChaTNtngKL8Majj4';
const TAB_TREINOS='TREINOS',TAB_GRADUACOES='GRADUACOES',TAB_USUARIOS='USUARIOS',TAB_SESSOES='SESSOES';
const SESSION_DAYS=30;
const LEGACY_OWNER_EMAIL='richard@consultoriarf.net';

function doGet(e){
 try{
  const requestId=String((e&&e.parameter&&e.parameter.requestId)||'');
  const callback=String((e&&e.parameter&&e.parameter.callback)||'');
  if(requestId&&callback){
   const safeCb=/^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(callback)?callback:'';
   if(!safeCb)return ContentService.createTextOutput('invalid callback').setMimeType(ContentService.MimeType.TEXT);
   const cache=CacheService.getScriptCache();
   const key='JJ_REQ_'+requestId;
   const raw=cache.get(key);
   const payload=raw?{ready:true,result:JSON.parse(raw)}:{ready:false};
   if(raw)cache.remove(key);
   return ContentService.createTextOutput(safeCb+'('+JSON.stringify(payload)+');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_({ok:true,service:'jiujitsu-api',version:'3.2'});
 }catch(err){return json_({ok:false,error:String(err.message||err)});}
}
function doPost(e){
 try{
  const formPayload=e&&e.parameter&&e.parameter.payload;
  const requestId=String((e&&e.parameter&&e.parameter.requestId)||'');
  if(formPayload&&requestId){
   const result=dispatch_(JSON.parse(formPayload));
   CacheService.getScriptCache().put('JJ_REQ_'+requestId,JSON.stringify(result),120);
   return HtmlService.createHtmlOutput('<!doctype html><html><body>OK</body></html>');
  }
  const b=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
  return json_(dispatch_(b));
 }catch(err){
  const requestId=String((e&&e.parameter&&e.parameter.requestId)||'');
  if(requestId){
   CacheService.getScriptCache().put('JJ_REQ_'+requestId,JSON.stringify({ok:false,error:String(err.message||err)}),120);
   return HtmlService.createHtmlOutput('<!doctype html><html><body>ERRO</body></html>');
  }
  return json_({ok:false,error:String(err.message||err)});
 }
}
function dispatch_(b){
 try{
  const a=String(b.action||'');
  if(a==='register')return registrar_(b);
  if(a==='login')return login_(b);
  const user=auth_(b.token);
  if(a==='logout')return logout_(b.token,user.userId);
  if(a==='me')return {ok:true,user:publicUser_(user)};
  if(a==='bootstrap'){const list=listar_(user.userId);return {ok:true,user:publicUser_(user),data:list.data,graduacoes:list.graduacoes};}
  if(a==='list')return listar_(user.userId);
  if(a==='save')return salvar_(user.userId,b.treino||{});
  if(a==='update')return atualizar_(user.userId,b.treino||{});
  if(a==='delete')return apagar_(user.userId,b.id);
  if(a==='saveGraduacao')return salvarGraduacao_(user.userId,b.graduacao||{});
  if(a==='deleteGraduacao')return apagarGraduacao_(user.userId,b.id||b.row);
  if(a==='setupGraduacao')return setupGraduacao_(user.userId,b);
  if(a==='updateProfile')return updateProfile_(user.userId,b);
  return {ok:false,error:'Ação inválida'};
 }catch(err){return {ok:false,error:String(err.message||err)};}
}
let SS_CACHE=null;
function ss_(){return SS_CACHE||(SS_CACHE=SpreadsheetApp.openById(SHEET_ID));}
function sheets_(){
 const ss=ss_();
 const t=ss.getSheetByName(TAB_TREINOS),g=ss.getSheetByName(TAB_GRADUACOES),u=ss.getSheetByName(TAB_USUARIOS),s=ss.getSheetByName(TAB_SESSOES);
 if(!t||!g||!u||!s)throw new Error('Estrutura do banco incompleta');
 return {t,g,u,s};
}
function registrar_(b){
 const lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  const nome=String(b.nome||'').trim(),email=normalEmail_(b.email),senha=String(b.senha||'');
  if(nome.length<2)throw new Error('Informe seu nome');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw new Error('E-mail inválido');
  if(senha.length<6)throw new Error('A senha precisa ter pelo menos 6 caracteres');
  const {t,g,u,s}=sheets_();
  const uv=u.getDataRange().getValues();
  for(let i=1;i<uv.length;i++)if(normalEmail_(uv[i][2])===email)throw new Error('Este e-mail já está cadastrado');
  const userId=Utilities.getUuid(),salt=Utilities.getUuid(),hash=hash_(salt+'|'+senha),now=new Date();
  u.appendRow([userId,nome,email,hash,salt,'TEGA',1,now,now]);

  let adoptedLegacy=false;
  if(email===LEGACY_OWNER_EMAIL){
   adoptedLegacy=claimLegacy_(t,2,userId)||adoptedLegacy;
   adoptedLegacy=claimLegacy_(g,2,userId)||adoptedLegacy;
  }

  const token=createSession_(s,userId);
  const needsSetup=!hasGraduacao_(g,userId);
  return {ok:true,token,user:{userId,nome,email,academia:'TEGA'},needsSetup,adoptedLegacy};
 }finally{lock.releaseLock();}
}

function login_(b){
 const email=normalEmail_(b.email),senha=String(b.senha||'');
 const {u,s,g}=sheets_();const v=u.getDataRange().getValues();
 for(let i=1;i<v.length;i++){
  if(normalEmail_(v[i][2])===email){
   if(String(v[i][6])==='0'||v[i][6]===false)throw new Error('Usuário inativo');
   if(hash_(String(v[i][4])+'|'+senha)!==String(v[i][3]))throw new Error('E-mail ou senha inválidos');
   const userId=String(v[i][0]);
   u.getRange(i+1,9).setValue(new Date());
   const token=createSession_(s,userId);
   const user=publicUserRow_(v[i]);
   const needsSetup=!hasGraduacao_(g,userId);
   if(needsSetup)return {ok:true,token,user,needsSetup:true};
   const list=listar_(userId);
   return {ok:true,token,user,needsSetup:false,data:list.data,graduacoes:list.graduacoes};
  }
 }
 throw new Error('E-mail ou senha inválidos');
}

function auth_(token){
 if(!token)throw new Error('AUTH_REQUIRED');
 const th=hash_(String(token)),cache=CacheService.getScriptCache(),ck='JJ_AUTH_'+th;
 const cached=cache.get(ck);
 if(cached)return JSON.parse(cached);
 const {u,s}=sheets_(),now=new Date(),sv=s.getDataRange().getValues();
 let userId='';
 for(let i=sv.length-1;i>=1;i--){
  if(String(sv[i][0])!==th)continue;
  const exp=sv[i][3] instanceof Date?sv[i][3]:new Date(sv[i][3]);
  if(exp>=now)userId=String(sv[i][1]);
  break;
 }
 if(!userId)throw new Error('SESSION_EXPIRED');
 const uv=u.getDataRange().getValues();
 for(let i=1;i<uv.length;i++)if(String(uv[i][0])===userId&&String(uv[i][6])!=='0'&&uv[i][6]!==false){
  const user=rowUser_(uv[i]);cache.put(ck,JSON.stringify(user),21600);return user;
 }
 throw new Error('SESSION_EXPIRED');
}

function logout_(token,userId){
 const {s}=sheets_(),th=hash_(String(token)),v=s.getDataRange().getValues();
 for(let i=v.length-1;i>=1;i--)if(String(v[i][0])===th&&String(v[i][1])===userId)s.deleteRow(i+1);
 return {ok:true};
}
function createSession_(s,userId){
 const raw=Utilities.getUuid()+Utilities.getUuid(),now=new Date(),exp=new Date(now.getTime()+SESSION_DAYS*86400000),th=hash_(raw);
 s.appendRow([th,userId,now,exp]);
 return raw;
}

function listar_(userId){
 const {t,g}=sheets_();
 const tv=t.getDataRange().getValues();
 const data=tv.slice(1).filter(r=>r[0]&&r[2]&&String(r[1])===userId).map(r=>({id:String(r[0]),data:dateIso_(r[2]),local:String(r[3]||''),tipo:String(r[4]||'GI').toUpperCase(),observacao:String(r[5]||'')}));
 const gv=g.getDataRange().getValues();
 const graduacoes=gv.slice(1).filter(r=>r[0]&&r[4]&&String(r[1])===userId).map(r=>({id:String(r[0]),faixa:String(r[2]||''),grau:String(r[3]||''),data:dateIso_(r[4])})).filter(x=>x.faixa&&x.data).sort((a,b)=>a.data.localeCompare(b.data));
 return {ok:true,data,graduacoes};
}
function salvar_(userId,x){
 if(!x.data)throw new Error('Data obrigatória');
 const {t}=sheets_();
 t.appendRow([Utilities.getUuid(),userId,new Date(x.data+'T12:00:00'),String(x.local||'TEGA').trim()||'TEGA',String(x.tipo||'GI').toUpperCase(),x.observacao||'',new Date()]);
 return {ok:true};
}
function atualizar_(userId,x){
 if(!x.id)throw new Error('ID obrigatório');
 const {t}=sheets_(),v=t.getDataRange().getValues();
 for(let i=1;i<v.length;i++)if(String(v[i][0])===String(x.id)&&String(v[i][1])===userId){
  t.getRange(i+1,3,1,4).setValues([[new Date(x.data+'T12:00:00'),String(x.local||'TEGA').trim()||'TEGA',String(x.tipo||'GI').toUpperCase(),x.observacao||'']]);return {ok:true};
 }
 throw new Error('Treino não encontrado');
}
function apagar_(userId,id){
 const {t}=sheets_(),v=t.getDataRange().getValues();
 for(let i=v.length-1;i>=1;i--)if(String(v[i][0])===String(id)&&String(v[i][1])===userId){t.deleteRow(i+1);return {ok:true};}
 throw new Error('Treino não encontrado');
}
function salvarGraduacao_(userId,x){
 if(!x.faixa||!x.grau||!x.data)throw new Error('Faixa, marco e data são obrigatórios');
 const {g}=sheets_(),id=String(x.id||'');
 const vals=[String(x.faixa).toUpperCase(),String(x.grau).toUpperCase(),new Date(x.data+'T12:00:00')];
 if(id){
  const v=g.getDataRange().getValues();
  for(let i=1;i<v.length;i++)if(String(v[i][0])===id&&String(v[i][1])===userId){
   g.getRange(i+1,3,1,3).setValues([vals]);return {ok:true,id};
  }
  throw new Error('Graduação não encontrada');
 }
 const newId=Utilities.getUuid();g.appendRow([newId,userId,vals[0],vals[1],vals[2],new Date()]);return {ok:true,id:newId};
}
function apagarGraduacao_(userId,id){
 const {g}=sheets_(),v=g.getDataRange().getValues();
 for(let i=v.length-1;i>=1;i--)if(String(v[i][0])===String(id)&&String(v[i][1])===userId){g.deleteRow(i+1);return {ok:true};}
 throw new Error('Graduação não encontrada');
}
function setupGraduacao_(userId,b){
 const faixa=String(b.faixa||'').toUpperCase(),grau=String(b.grau||'INÍCIO').toUpperCase(),dataFaixa=String(b.dataFaixa||''),dataGrau=String(b.dataGrau||dataFaixa);
 if(!faixa||!dataFaixa)throw new Error('Informe faixa e data');
 const {g}=sheets_();
 if(hasGraduacao_(g,userId))return {ok:true};
 g.appendRow([Utilities.getUuid(),userId,faixa,'INÍCIO',new Date(dataFaixa+'T12:00:00'),new Date()]);
 if(normal_(grau)!=='INICIO')g.appendRow([Utilities.getUuid(),userId,faixa,grau,new Date(dataGrau+'T12:00:00'),new Date()]);
 return {ok:true};
}
function updateProfile_(userId,b){
 const nome=String(b.nome||'').trim();if(nome.length<2)throw new Error('Informe seu nome');
 const {u}=sheets_(),v=u.getDataRange().getValues();
 for(let i=1;i<v.length;i++)if(String(v[i][0])===userId){u.getRange(i+1,2).setValue(nome);return {ok:true,user:publicUserRow_(Object.assign([],v[i],{1:nome}))};}
 throw new Error('Usuário não encontrado');
}

function claimLegacy_(sheet,userCol,userId){
 const lr=sheet.getLastRow();if(lr<2)return false;
 const range=sheet.getRange(2,userCol,lr-1,1),vals=range.getValues();let changed=false;
 vals.forEach(r=>{if(!String(r[0]||'').trim()){r[0]=userId;changed=true;}});
 if(changed)range.setValues(vals);return changed;
}
function hasGraduacao_(g,userId){
 if(g.getLastRow()<2)return false;
 return g.getRange(2,1,g.getLastRow()-1,5).getValues().some(r=>String(r[1])===userId&&r[2]&&r[4]);
}
function rowUser_(r){return {userId:String(r[0]),nome:String(r[1]||''),email:String(r[2]||''),academia:String(r[5]||'TEGA')};}
function publicUserRow_(r){return rowUser_(r);}
function publicUser_(u){return {userId:u.userId,nome:u.nome,email:u.email,academia:u.academia||'TEGA'};}
function normalEmail_(s){return String(s||'').trim().toLowerCase();}
function hash_(s){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8)).replace(/=+$/,'');}
function dateIso_(v){
 if(v===null||v===undefined||v==='')return '';
 if(typeof v==='string'){const s=v.trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);if(m)return m[3]+'-'+m[2]+'-'+m[1];}
 if(Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v.getTime()))return Utilities.formatDate(v,Session.getScriptTimeZone(),'yyyy-MM-dd');
 const d=new Date(v);return isNaN(d.getTime())?String(v):Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM-dd');
}
function normal_(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
// deploy-trigger performance-v19
