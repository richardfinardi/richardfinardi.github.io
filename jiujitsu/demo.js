let DATA=[],GRADS=[],PAGE=40,visible=40;
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const fmt=d=>{const m=String(d||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+"/"+m[2]+"/"+m[1]:String(d||"—")};
function iso(y,m,d){return y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0")}
function addDemoYear(year,count,maxMonth){
 let made=0,seq=0;
 while(made<count){
  const month=(seq%maxMonth)+1;
  const day=((seq*3+5)%24)+1;
  DATA.push({id:"D"+year+"-"+seq,data:iso(year,month,day),local:seq%11===0?"TEGA • OPEN MAT":"TEGA",tipo:seq%4===0?"NOGI":"GI",observacao:seq%13===0?"Treino forte":""});
  made++;seq++;
 }
}
addDemoYear(2024,72,12);addDemoYear(2025,96,12);addDemoYear(2026,62,9);
DATA.sort((a,b)=>a.data.localeCompare(b.data));
GRADS=[
 {id:"g1",faixa:"BRANCA",grau:"INÍCIO",data:"2024-01-15"},
 {id:"g2",faixa:"BRANCA",grau:"1º GRAU",data:"2024-04-10"},
 {id:"g3",faixa:"BRANCA",grau:"2º GRAU",data:"2024-07-20"},
 {id:"g4",faixa:"BRANCA",grau:"3º GRAU",data:"2024-10-10"},
 {id:"g5",faixa:"BRANCA",grau:"4º GRAU",data:"2024-12-05"},
 {id:"g6",faixa:"AZUL",grau:"INÍCIO",data:"2025-02-01"},
 {id:"g7",faixa:"AZUL",grau:"1º GRAU",data:"2025-08-20"},
 {id:"g8",faixa:"AZUL",grau:"2º GRAU",data:"2026-01-25"},
 {id:"g9",faixa:"AZUL",grau:"3º GRAU",data:"2026-05-18"},
 {id:"g10",faixa:"AZUL",grau:"4º GRAU",data:"2026-09-10"}
];
function normTxt(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase()}
function grauNumero(grau){const g=normTxt(grau);if(g==="INICIO"||g==="SEM GRAU")return 0;const m=g.match(/([1-4])/);return m?Number(m[1]):0}
function calcProfile(grads){
 const sorted=grads.slice().sort((a,b)=>a.data.localeCompare(b.data));
 const starts=sorted.filter(g=>normTxt(g.grau)==="INICIO"),faixaStart=starts[starts.length-1]||sorted[0];
 let grau=faixaStart;sorted.forEach(g=>{if(g.faixa===faixaStart.faixa&&g.data>=faixaStart.data)grau=g});
 return {faixa:faixaStart.faixa,faixaData:faixaStart.data,grau:grau.grau,grauData:grau.data};
}
function tempoCompacto(isoDate){
 const start=new Date(isoDate+"T12:00:00"),end=new Date();
 let months=(end.getFullYear()-start.getFullYear())*12+(end.getMonth()-start.getMonth());if(end.getDate()<start.getDate())months--;months=Math.max(0,months);
 if(months>=12){const a=Math.floor(months/12),m=months%12;return a+"a"+(m?m+"m":"")}
 if(months>=1)return months+"m";
 const days=Math.max(0,Math.floor((new Date(end.getFullYear(),end.getMonth(),end.getDate())-new Date(start.getFullYear(),start.getMonth(),start.getDate()))/86400000));
 return days+" "+(days===1?"dia":"dias");
}
function renderBeltIcon(target,faixa,grau){
 const el=$(target);if(!el)return;const f=normTxt(faixa),g=grauNumero(grau);
 const colors={BRANCA:"#f4f4f4",AZUL:"#2b78ff",ROXA:"#7a3db8",MARROM:"#6b3f22",PRETA:"#111111"};
 el.style.setProperty("--belt",colors[f]||"#2b78ff");el.style.setProperty("--rank",f==="PRETA"?"#d8171f":"#090a0c");el.innerHTML="";
 for(let i=1;i<=g;i++){const s=document.createElement("i");s.className="stripe s"+i;el.appendChild(s)}
}
function countMap(arr,keyFn){const m={};arr.forEach(x=>{const k=keyFn(x);if(k)m[k]=(m[k]||0)+1});return m}
function renderStats(sel,map,desc){
 const entries=Object.entries(map).sort((a,b)=>desc?b[0].localeCompare(a[0]):b[1]-a[1]),max=Math.max(1,...entries.map(x=>x[1]));
 $(sel).innerHTML=entries.map(x=>'<div class="stat-line"><span>'+esc(x[0])+'</span><div class="track"><div class="fill" style="width:'+(x[1]/max*100)+'%"></div></div><strong>'+x[1]+'</strong></div>').join("");
}
function renderFaixas(){
 const starts=GRADS.filter(g=>normTxt(g.grau)==="INICIO").sort((a,b)=>a.data.localeCompare(b.data)),map={};
 DATA.forEach(t=>{let belt=starts[0].faixa;starts.forEach(s=>{if(t.data>=s.data)belt=s.faixa});map[belt]=(map[belt]||0)+1});renderStats("#faixasResumo",map,false);
}
function renderResumo(){
 const now=new Date(),year=String(now.getFullYear()),ym=year+"-"+String(now.getMonth()+1).padStart(2,"0"),anoData=DATA.filter(x=>x.data.startsWith(year)),nogi=DATA.filter(x=>x.tipo==="NOGI").length,p=calcProfile(GRADS);
 $("#kpiTotal").textContent=DATA.length;$("#kpiMes").textContent=DATA.filter(x=>x.data.startsWith(ym)).length;$("#kpiAno").textContent=anoData.length;
 $("#kpiGiAno").textContent=anoData.filter(x=>x.tipo==="GI").length;$("#kpiNogiAno").textContent=anoData.filter(x=>x.tipo==="NOGI").length;
 $("#kpiFaixa").textContent=p.faixa;$("#kpiGrau").textContent=p.grau;renderBeltIcon("#kpiBeltIcon",p.faixa,p.grau);
 $("#kpiDiasFaixa").textContent=p.faixa+" DESDE "+fmt(p.faixaData)+" ("+tempoCompacto(p.faixaData)+")";
 $("#kpiDiasGrau").textContent=p.grau+" DESDE "+fmt(p.grauData)+" ("+tempoCompacto(p.grauData)+")";
 const months=[];for(let i=1;i<=12;i++)months.push(year+"-"+String(i).padStart(2,"0"));
 const mc=countMap(anoData,x=>x.data.slice(0,7)),max=Math.max(1,...months.map(m=>mc[m]||0)),labels=["J","F","M","A","M","J","J","A","S","O","N","D"];
 $("#anoGrafico").textContent=year;$("#graficoMes").innerHTML=months.map((m,i)=>'<div class="bar-wrap"><div class="bar" style="height:'+Math.max(3,(mc[m]||0)/max*130)+'px"><b>'+(mc[m]||0)+'</b></div><div class="bar-label">'+labels[i]+'</div></div>').join("");
 const gi=DATA.length-nogi;$("#tipoResumo").innerHTML='<div class="type-box"><div class="type-card"><strong>'+gi+'</strong><span>GI • '+Math.round(gi/DATA.length*100)+'%</span></div><div class="type-card"><strong>'+nogi+'</strong><span>NOGI • '+Math.round(nogi/DATA.length*100)+'%</span></div></div>';
 renderStats("#locaisResumo",countMap(DATA,x=>x.local),false);renderStats("#anosResumo",countMap(DATA,x=>x.data.slice(0,4)),true);renderFaixas();
}
function renderGrads(){
 const p=calcProfile(GRADS);$("#evoFaixa").textContent=p.faixa;$("#evoGrau").textContent=p.grau;renderBeltIcon("#evoBeltIcon",p.faixa,p.grau);
 $("#evoFaixaDesde").textContent=p.faixa+" DESDE "+fmt(p.faixaData)+" ("+tempoCompacto(p.faixaData)+")";$("#evoGrauDesde").textContent=p.grau+" DESDE "+fmt(p.grauData)+" ("+tempoCompacto(p.grauData)+")";
 $("#graduacoes").innerHTML=GRADS.slice().sort((a,b)=>b.data.localeCompare(a.data)).map(g=>'<div class="time-item"><span class="dot"></span><div class="time-main"><strong>'+g.faixa+' • '+g.grau+'</strong><small>'+fmt(g.data)+'</small></div><span class="tag">DEMO</span></div>').join("");
}
function preencherFiltros(){
 const anos=[...new Set(DATA.map(x=>x.data.slice(0,4)))].sort().reverse();$("#filtroAno").innerHTML='<option value="">Todos</option>'+anos.map(a=>'<option>'+a+'</option>').join("");
 const locais=[...new Set(DATA.map(x=>x.local))].sort();$("#filtroLocal").innerHTML='<option value="">Todos</option>'+locais.map(l=>'<option>'+l+'</option>').join("");
}
function renderHistorico(){
 const ano=$("#filtroAno").value,mes=$("#filtroMes").value,tipo=$("#filtroTipo").value,local=$("#filtroLocal").value,busca=$("#filtroBusca").value.trim().toLowerCase();
 const rows=DATA.filter(x=>(!ano||x.data.slice(0,4)===ano)&&(!mes||x.data.slice(5,7)===mes)&&(!tipo||x.tipo===tipo)&&(!local||x.local===local)&&(!busca||[x.data,fmt(x.data),x.local,x.tipo,x.observacao].join(" ").toLowerCase().includes(busca))).sort((a,b)=>b.data.localeCompare(a.data));
 $("#qtdFiltrada").textContent=rows.length+" treino"+(rows.length===1?"":"s");
 $("#historico").innerHTML=rows.slice(0,visible).map(x=>'<div class="row"><strong>'+fmt(x.data)+'</strong><div><b>'+esc(x.local)+'</b><br><small>'+x.tipo+(x.observacao?" • "+esc(x.observacao):"")+'</small></div><span class="tag">DEMO</span></div>').join("");
 $("#btnMais").hidden=visible>=rows.length;
}
function showView(name){document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));document.querySelectorAll(".bottom button").forEach(v=>v.classList.remove("active"));$("#view"+name).classList.add("active");document.querySelector('[data-view="'+name+'"]').classList.add("active");window.scrollTo({top:0,behavior:"smooth"})}
document.querySelectorAll(".bottom button").forEach(b=>b.onclick=()=>showView(b.dataset.view));
["#filtroAno","#filtroMes","#filtroTipo","#filtroLocal"].forEach(s=>$(s).onchange=()=>{visible=PAGE;renderHistorico()});$("#filtroBusca").oninput=()=>{visible=PAGE;renderHistorico()};$("#btnLimparFiltros").onclick=()=>{$("#filtroBusca").value="";$("#filtroAno").value="";$("#filtroMes").value="";$("#filtroTipo").value="";$("#filtroLocal").value="";visible=PAGE;renderHistorico()};$("#btnMais").onclick=()=>{visible+=PAGE;renderHistorico()};
function showDemoModal(){const m=$("#demoModal");if(m)m.hidden=false}function hideDemoModal(){const m=$("#demoModal");if(m)m.hidden=true}
$("#btnQueroConta").onclick=showDemoModal;$("#btnFecharDemo").onclick=hideDemoModal;$("#btnNovoTreino").onclick=e=>{e.preventDefault();showDemoModal()};
$("#formTreino").onsubmit=e=>{e.preventDefault();showDemoModal()};$("#formGrad").onsubmit=e=>{e.preventDefault();showDemoModal()};
$("#btnCancelarEdicao").onclick=()=>{};$("#btnCancelarGrad").onclick=()=>{};
preencherFiltros();renderResumo();renderHistorico();renderGrads();