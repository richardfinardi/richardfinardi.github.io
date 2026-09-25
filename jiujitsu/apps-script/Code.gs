const SHEET_ID = '1fn-RSRPiq86bG7m84TeMUrhpGyCChaTNtngKL8Majj4';
const TAB_TREINOS = 'TREINOS';
const TAB_GRADUACOES = 'GRADUACOES';

function doGet(){ return json_({ok:true,service:'jiujitsu-api'}); }
function doPost(e){
 try{
  const body=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
  if(body.action==='list') return json_(listar_());
  if(body.action==='save') return json_(salvar_(body.treino||{}));
  return json_({ok:false,error:'Ação inválida'});
 }catch(err){return json_({ok:false,error:String(err.message||err)});}
}
function ss_(){return SpreadsheetApp.openById(SHEET_ID);}
function ensure_(){
 const ss=ss_();
 let t=ss.getSheetByName(TAB_TREINOS);
 if(!t){t=ss.insertSheet(TAB_TREINOS);t.appendRow(['ID','DATA','LOCAL','TIPO','OBSERVACAO','CRIADO_EM']);}
 let g=ss.getSheetByName(TAB_GRADUACOES);
 if(!g){g=ss.insertSheet(TAB_GRADUACOES);g.appendRow(['FAIXA','GRAU','DATA_INICIO']);}
 return {t,g};
}
function listar_(){
 const {t,g}=ensure_();
 const v=t.getDataRange().getValues();
 const data=v.slice(1).filter(r=>r[1]).map(r=>({id:r[0],data:Utilities.formatDate(new Date(r[1]),Session.getScriptTimeZone(),'yyyy-MM-dd'),local:r[2],tipo:r[3],observacao:r[4]}));
 const gv=g.getDataRange().getValues().slice(1).filter(r=>r[0]&&r[2]).sort((a,b)=>new Date(a[2])-new Date(b[2]));
 const atual=gv.length?gv[gv.length-1]:null;
 return {ok:true,data,profile:atual?{faixaAtual:atual[0],grau:atual[1],diasNaFaixa:Math.floor((new Date()-new Date(atual[2]))/86400000)}:{}};
}
function salvar_(x){
 if(!x.data||!x.local) throw new Error('Data e local são obrigatórios');
 const {t}=ensure_();
 t.appendRow([Utilities.getUuid(),new Date(x.data+'T12:00:00'),x.local,String(x.tipo||'GI').toUpperCase(),x.observacao||'',new Date()]);
 return {ok:true};
}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}