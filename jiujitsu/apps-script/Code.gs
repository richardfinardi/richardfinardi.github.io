const SHEET_ID='1fn-RSRPiq86bG7m84TeMUrhpGyCChaTNtngKL8Majj4';
const TAB_TREINOS='TREINOS',TAB_GRADUACOES='GRADUACOES';

function doGet(){return json_({ok:true,service:'jiujitsu-api',version:'2.0'});}
function doPost(e){
 try{
  const b=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
  if(b.action==='list')return json_(listar_());
  if(b.action==='save')return json_(salvar_(b.treino||{}));
  if(b.action==='update')return json_(atualizar_(b.treino||{}));
  if(b.action==='delete')return json_(apagar_(b.id));
  if(b.action==='saveGraduacao')return json_(salvarGraduacao_(b.graduacao||{}));
  if(b.action==='deleteGraduacao')return json_(apagarGraduacao_(Number(b.row)));
  return json_({ok:false,error:'Ação inválida'});
 }catch(err){return json_({ok:false,error:String(err.message||err)});}
}
function ss_(){return SpreadsheetApp.openById(SHEET_ID);}
function ensure_(){
 const ss=ss_();let t=ss.getSheetByName(TAB_TREINOS),g=ss.getSheetByName(TAB_GRADUACOES);
 if(!t){t=ss.insertSheet(TAB_TREINOS);t.appendRow(['ID','DATA','LOCAL','TIPO','OBSERVACAO','CRIADO_EM']);}
 if(!g){g=ss.insertSheet(TAB_GRADUACOES);g.appendRow(['FAIXA','GRAU','DATA_INICIO']);}
 return {t,g};
}
function dateIso_(v){
 if(v===null||v===undefined||v==='')return '';
 if(typeof v==='string'){
  const s=v.trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if(m)return m[3]+'-'+m[2]+'-'+m[1];
 }
 if(Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v.getTime())){
  return Utilities.formatDate(v,Session.getScriptTimeZone(),'yyyy-MM-dd');
 }
 const d=new Date(v);
 if(isNaN(d.getTime()))return String(v);
 return Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM-dd');
}
function listar_(){
 const {t,g}=ensure_();
 const tv=t.getDataRange().getValues();
 const data=tv.slice(1).filter(r=>r[0]&&r[1]).map(r=>({id:String(r[0]),data:dateIso_(r[1]),local:String(r[2]||''),tipo:String(r[3]||'GI').toUpperCase(),observacao:String(r[4]||'')}));
 const gv=g.getDataRange().getValues();
 const graduacoes=gv.slice(1).map((r,i)=>({row:i+2,faixa:String(r[0]||''),grau:String(r[1]||''),data:r[2]?dateIso_(r[2]):''})).filter(x=>x.faixa&&x.data).sort((a,b)=>a.data.localeCompare(b.data));
 const starts=graduacoes.filter(x=>normal_(x.grau)==='INICIO');
 const faixaStart=starts.length?starts[starts.length-1]:graduacoes[0];
 let grauAtual=faixaStart;
 if(faixaStart){graduacoes.forEach(x=>{if(x.faixa===faixaStart.faixa&&x.data>=faixaStart.data)grauAtual=x;});}
 const profile=faixaStart?{faixaAtual:faixaStart.faixa,dataFaixa:faixaStart.data,diasNaFaixa:dias_(faixaStart.data),grau:grauAtual?grauAtual.grau:'INÍCIO',dataGrau:grauAtual?grauAtual.data:faixaStart.data,diasNoGrau:grauAtual?dias_(grauAtual.data):0}:{};
 return {ok:true,data,graduacoes,profile};
}
function salvar_(x){
 if(!x.data)throw new Error('Data obrigatória');
 const {t}=ensure_();
 t.appendRow([Utilities.getUuid(),new Date(x.data+'T12:00:00'),String(x.local||'TEGA').trim()||'TEGA',String(x.tipo||'GI').toUpperCase(),x.observacao||'',new Date()]);
 return {ok:true};
}
function atualizar_(x){
 if(!x.id)throw new Error('ID obrigatório');
 const {t}=ensure_();const v=t.getDataRange().getValues();
 for(let i=1;i<v.length;i++)if(String(v[i][0])===String(x.id)){t.getRange(i+1,2,1,4).setValues([[new Date(x.data+'T12:00:00'),String(x.local||'TEGA').trim()||'TEGA',String(x.tipo||'GI').toUpperCase(),x.observacao||'']]);return {ok:true};}
 throw new Error('Treino não encontrado');
}
function apagar_(id){
 const {t}=ensure_();const v=t.getDataRange().getValues();
 for(let i=v.length-1;i>=1;i--)if(String(v[i][0])===String(id)){t.deleteRow(i+1);return {ok:true};}
 throw new Error('Treino não encontrado');
}
function salvarGraduacao_(x){
 if(!x.faixa||!x.grau||!x.data)throw new Error('Faixa, marco e data são obrigatórios');
 const {g}=ensure_();const row=Number(x.row||0),vals=[[String(x.faixa).toUpperCase(),String(x.grau).toUpperCase(),new Date(x.data+'T12:00:00')]];
 if(row>=2&&row<=g.getLastRow())g.getRange(row,1,1,3).setValues(vals);else g.appendRow(vals[0]);
 return {ok:true};
}
function apagarGraduacao_(row){
 const {g}=ensure_();
 if(!row||row<2||row>g.getLastRow())throw new Error('Graduação não encontrada');
 g.deleteRow(row);return {ok:true};
}
function normal_(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();}
function dias_(iso){return Math.max(0,Math.floor((new Date()-new Date(iso+'T12:00:00'))/86400000));}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}