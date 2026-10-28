/* CPS JoinLab: consulta em português — regras v1, sem acesso ao banco */
(function(){
'use strict';
var style=document.createElement('style');
style.textContent='.nlbox{width:100%;min-height:112px;background:#0a1829;border:1px solid #36506a;border-radius:10px;color:#e8f0fa;padding:14px;font:14px/1.65 Inter,system-ui,sans-serif;resize:vertical}.nlbox:focus{outline:1px solid #46d5cb}.nl-tags{display:flex;flex-wrap:wrap;gap:8px;margin:13px 0}.nl-tags span{border:1px solid #35636b;background:#14313d;border-radius:8px;padding:8px 11px;color:#b6efe5;font-size:12px}.nl-warning{padding:12px 15px;background:#30281e;border:1px solid #695433;color:#eed4a3;border-radius:9px;line-height:1.65;margin:15px 0;font-size:12px}.nl-code{margin-top:14px}.nl-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:12px}';
document.head.appendChild(style);
var nav=document.createElement('button');
nav.className='nav';nav.dataset.view='natural';nav.innerHTML='<span class="ico">✳</span> Consulta em português';
document.querySelector('.sidebar .sidenote').before(nav);
var mobile=document.createElement('button');mobile.dataset.view='natural';mobile.textContent='Por objetivo';document.querySelector('.mobile-nav').prepend(mobile);
[nav,mobile].forEach(function(b){b.addEventListener('click',function(){openTab('natural')})});
var view=document.createElement('section');view.className='view';view.id='view-natural';
view.innerHTML='<div class="panel"><div class="eyebrow">NOVO · CONSULTA EM LINGUAGEM NATURAL</div><h2>O que você quer buscar no CPS?</h2><p class="sub">Descreva sua necessidade. Esta versão interpreta com segurança o cenário <b>orçamentos com notas fiscais emitidas e saldo a receber</b>, incluindo parcelas vencidas e filtro de empresa. Gera SQL PostgreSQL para você revisar; não executa no banco.</p><label for="nl-question">Descreva o resultado desejado</label><textarea id="nl-question" class="nlbox" placeholder="Ex.: Quero trazer orçamentos que emitiram nota fiscal e ainda falta receber"></textarea><div class="nl-toolbar"><button class="primary" id="nl-run">Interpretar e montar SQL →</button><button class="secondary" id="nl-clear">Limpar</button></div><div class="samples"><button class="chip nl-example" data-example="Orçamentos que emitiram nota fiscal e ainda falta receber">Notas + a receber</button><button class="chip nl-example" data-example="Orçamentos faturados com parcelas vencidas">Parcelas vencidas</button><button class="chip nl-example" data-example="Orçamentos com nota fiscal e saldo a receber da empresa 1">Empresa 1</button></div><p class="mini" style="margin-top:16px;line-height:1.7">Interpretação local baseada nas suas queries, sem serviço externo de IA. Pedidos não reconhecidos não geram SQL inventado.</p><div id="nl-result" style="margin-top:18px"></div></div>';
document.querySelector('#view-builder').before(view);
var ask=document.querySelector('#nl-question'),output=document.querySelector('#nl-result');
function norm(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim()}
function interpret(q){
 q=norm(q);
 var orc=/orcament|orcado|orcada/.test(q),nf=/nota(s)? fiscal|notas|\bnf\b|\bnfe\b|nfse|faturad|faturament|emitid/.test(q);
 var rec=/receb|pagament|vencid|atrasad|inadimpl|em aberto/.test(q);
 var pend=/a receber|falta receber|nao receb|nao pag|pendente|em aberto|vencid|atrasad|inadimpl|saldo/.test(q);
 var empresa=q.match(/\bempresa\s*(?:n[ºo.]?\s*)?(\d{1,5})\b/);
 var vencido=/vencid|atrasad|inadimpl/.test(q);
 var periodo=/\b(202\d|20[01]\d|\d{2}\/\d{2}|ultimo(s)? \d+ dia(s)?|mes passado|mes atual|mes de|entre \d|periodo)\b/.test(q);
 var quitado=/\b(ja foram recebidos|totalmente recebidos|totalmente pagos|quitados|ja pagos)\b/.test(q);
 return {ok:orc&&nf&&rec&&pend&&!periodo&&!quitado,empresa:empresa?Number(empresa[1]):null,vencido:vencido,periodo:periodo,quitado:quitado};
}
function sql(i){
var s=[
'/* CPS JoinLab - Consulta de referência (PostgreSQL).',
'   Orçamentos COM nota fiscal emitida E saldo a receber.',
'   1 linha por orçamento. Valores financeiros POR ORÇAMENTO, não por NF.',
'   Fontes: CAPITAL_FINANCEIRO.SQL, COMISSÃO.txt, COMISSAO ANFEER (POR EMISSÃO DE NOTA FISCAL). */',
'WITH notas_emitidas AS (',
'    SELECT DISTINCT nf.cod_empresa, p.cod_orcamento, nf.modelo, nf.serie,',
'           nf.sub_serie, nf.numero, nf.numero::text AS numero_exibicao, nf.dt_emissao',
'    FROM tnota_fiscal_item p',
'    JOIN tnota_fiscal nf ON nf.cod_empresa = p.cod_empresa',
'     AND nf.modelo = p.modelo AND nf.serie = p.serie',
'     AND nf.sub_serie = p.sub_serie AND nf.numero = p.numero_nf',
"    WHERE nf.modelo = '55' AND nf.nfe_cod_status = '100'",
'      AND p.cod_orcamento IS NOT NULL',
'    UNION',
'    SELECT DISTINCT nf.cod_empresa, s.cod_orcamento, nf.modelo, nf.serie,',
'           nf.sub_serie, nf.numero, nf.numero_nfse::text AS numero_exibicao, nf.dt_emissao',
'    FROM tnota_fiscal_servico s',
'    JOIN tnota_fiscal nf ON nf.cod_empresa = s.cod_empresa',
'     AND nf.modelo = s.modelo AND nf.serie = s.serie',
'     AND nf.sub_serie = s.sub_serie AND nf.numero = s.numero_nf',
"    WHERE nf.modelo = '1' AND NULLIF(TRIM(nf.numero_nfse::text), '') IS NOT NULL",
'      AND s.cod_orcamento IS NOT NULL',
'),',
'notas_por_orcamento AS (',
'    SELECT cod_empresa, cod_orcamento,',
"           STRING_AGG(DISTINCT CASE WHEN modelo = '1' THEN 'NFS-e ' || numero_exibicao",
"                            ELSE 'NF-e ' || numero_exibicao END, ', ') AS notas_emitidas,",
'           COUNT(*) AS qtd_notas, MAX(dt_emissao) AS ultima_emissao',
'    FROM notas_emitidas',
'    GROUP BY cod_empresa, cod_orcamento',
'),',
'financeiro_por_orcamento AS (',
'    /* Agregação anterior ao JOIN evita multiplicar parcelas pelas notas/itens. */',
'    SELECT r.cod_empresa, r.cod_orcamento,',
'           SUM(COALESCE(r.valor_corrigido, r.valor, 0)) AS valor_financeiro,',
'           SUM(COALESCE(r.valor_pago, 0)) AS valor_recebido,',
'           SUM(CASE WHEN COALESCE(r.pago, 0) = 1 THEN 0',
'                    ELSE GREATEST(COALESCE(r.valor_corrigido, r.valor, 0) -',
'                                  COALESCE(r.valor_pago, 0), 0) END) AS saldo_a_receber,',
'           MIN(CASE WHEN COALESCE(r.pago, 0) <> 1',
'                     AND GREATEST(COALESCE(r.valor_corrigido,r.valor,0) - COALESCE(r.valor_pago,0),0) > 0',
'                    THEN r.dt_vencimento END) AS proximo_vencimento_aberto,',
'           COUNT(*) FILTER (WHERE COALESCE(r.pago,0) <> 1',
'                  AND r.dt_vencimento < CURRENT_DATE',
'                  AND GREATEST(COALESCE(r.valor_corrigido,r.valor,0) - COALESCE(r.valor_pago,0),0) > 0) AS parcelas_vencidas',
'    FROM treceber r',
'    WHERE COALESCE(r.previsao, 0) = 0 AND r.cod_orcamento IS NOT NULL',
'    GROUP BY r.cod_empresa, r.cod_orcamento',
')',
'SELECT o.cod_empresa, o.codigo AS cod_orcamento, o.n_orcamento AS orcamento,',
'       o.cliente, n.notas_emitidas, n.qtd_notas, n.ultima_emissao,',
'       f.valor_financeiro, f.valor_recebido, f.saldo_a_receber,',
'       f.proximo_vencimento_aberto, f.parcelas_vencidas',
'FROM torcamento o',
'JOIN notas_por_orcamento n',
'  ON n.cod_empresa = o.cod_empresa AND n.cod_orcamento = o.codigo',
'JOIN financeiro_por_orcamento f',
'  ON f.cod_empresa = o.cod_empresa AND f.cod_orcamento = o.codigo',
'WHERE f.saldo_a_receber > 0'
];
if(i.empresa!==null)s[s.length-1]+='\n  AND o.cod_empresa = '+i.empresa;
if(i.vencido)s[s.length-1]+='\n  AND f.parcelas_vencidas > 0';
s.push('ORDER BY f.proximo_vencimento_aberto NULLS LAST, o.cod_empresa, o.n_orcamento;');
return s.join('\n');
}
function go(){
 var txt=ask.value.trim();if(!txt){output.innerHTML='<div class="empty">Escreva sua pergunta acima.</div>';return}
 var i=interpret(txt);
 if(!i.ok){
 var reason=i.periodo?'Filtro de período ainda não implementado.':i.quitado?'Este protótipo trata de saldos a receber, não títulos quitados.':'Essa combinação ainda não está mapeada com segurança.';
 output.innerHTML='<div class="empty"><b>Não vou inventar JOINs.</b><br>'+reason+'<br>Experimente: <b>Orçamentos com nota fiscal emitida e saldo a receber</b>.</div>';return;
 }
 var code=sql(i);output.replaceChildren();
 var bar=document.createElement('div');bar.className='route-header';
 bar.innerHTML='<h3>Consulta reconhecida</h3><button class="copy" id="nl-copy">Copiar SQL</button>';output.appendChild(bar);
 var tags=document.createElement('div');tags.className='nl-tags';
 var arr=['ORÇAMENTO → NF-e / NFS-e','ORÇAMENTO → TRECEBER','Saldo pendente > 0','1 linha por orçamento'];
 if(i.vencido)arr.push('Somente parcelas vencidas');
 if(i.empresa!==null)arr.push('Empresa '+i.empresa);
 arr.forEach(function(t){var x=document.createElement('span');x.textContent=t;tags.appendChild(x)});output.appendChild(tags);
 var proof=document.createElement('p');proof.className='mini';proof.textContent='Evidências: COMISSÃO.txt (TRECEBER ↔ TORCAMENTO), CAPITAL_FINANCEIRO.SQL (NF e financeiro), COMISSAO ANFEER (POR EMISSÃO DE NOTA FISCAL).txt (NFS-e).';output.appendChild(proof);
 var warn=document.createElement('div');warn.className='nl-warning';
 warn.textContent='SQL de referência; não foi executado nem validado no banco. O saldo é por orçamento, não por NF individual. Validar o status/cancelamento de NFS-e, VALOR_CORRIGIDO, VALOR_PAGO e títulos sem COD_ORCAMENTO. Número de nota isolado não é usado como chave de contas a receber.';
 output.appendChild(warn);
 var pre=document.createElement('pre');pre.className='nl-code';pre.textContent=code;output.appendChild(pre);
 document.querySelector('#nl-copy').addEventListener('click',function(ev){copyText(code,ev.currentTarget)});
}
document.querySelector('#nl-run').addEventListener('click',go);
document.querySelector('#nl-clear').addEventListener('click',function(){ask.value='';output.replaceChildren();ask.focus()});
document.querySelectorAll('.nl-example').forEach(function(b){b.addEventListener('click',function(){ask.value=b.dataset.example;go()})});
ask.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key==='Enter')go()});
})();