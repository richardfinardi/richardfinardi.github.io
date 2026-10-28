/* CPS JoinLab — Consultas por objetivo v3.0 (28/10/2026)
   Gerador local baseado no catalogo de JOINs extraidos de 172 SQLs.
   Nao usa API privada, nao executa instrucoes e nao inventa relacionamentos.
*/
(function () {
  'use strict';
  var DB = JSON.parse(document.querySelector('#data-json').textContent);
  var SCHEMA=window.CPSSchema||{meta:{tables:0,cols:0},tables:{},core:[],automatic:[]};
  var allTables = new Set([...DB.tables.map(t=>t.name),...Object.keys(SCHEMA.tables)]);
  var RR = DB.relationships.filter(r=>r.keys&&r.keys.length&&!r.needs_review&&(!r.derived||r.id==='R0154'))
    .map(r=>({...r,origin:'SQL historico',files:r.files||[]}));
  function sigRel(r){
    const names=[r.a,r.b].sort(),pairs=(r.a===names[0]?r.keys:r.keys.map(([a,b])=>[b,a]));
    return names.join('/')+'/'+pairs.map(([a,b])=>a+'='+b).sort().join('/');
  }
  const seen=new Set(RR.map(sigRel));
  function addSchemaJoin(r,source,id){
    const a=r.origem,b=r.destino;
    if(!allTables.has(a)||!allTables.has(b))return;
    let keys=[];
    if(source==='Estrutura CPS')keys=(r.join||'').split(';').map(x=>x.split('=')).filter(x=>x.length===2&&x.every(Boolean));
    else {const re=/a\.([a-z_][a-z0-9_]*)\s*=\s*b\.([a-z_][a-z0-9_]*)/gi;let m;
      while((m=re.exec(r.join||''))!==null)keys.push([m[1].toLowerCase(),m[2].toLowerCase()]);}
    if(!keys.length)return;
    const af=(SCHEMA.tables[a]?.fields||[]).map(c=>c[0]),bf=(SCHEMA.tables[b]?.fields||[]).map(c=>c[0]);
    if(!keys.every(([x,y])=>af.includes(x)&&bf.includes(y)))return;
    const edge={a,b,keys,origin:source,files:[],file_count:0,id};
    const sig=sigRel(edge);if(seen.has(sig))return;
    seen.add(sig);RR.push(edge);
  }
  (SCHEMA.core||[]).forEach((r,i)=>addSchemaJoin(r,'Estrutura CPS','CORE_'+(i+1)));
  (SCHEMA.automatic||[]).forEach((r,i)=>addSchemaJoin(r,'Sugestao automatica','AUTO_'+(i+1)));
  var adj = new Map();
  RR.forEach(r => {
    for (const t of [r.a,r.b]) {
      if (!adj.has(t)) adj.set(t,[]);
      adj.get(t).push(r);
    }
  });
  function norm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
  function html(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function firstText(raw, rx) { const m = rx.exec(raw); return m ? m.index : Infinity; }

  const concepts = [
    {id:'torcamento',name:'Orçamentos',pattern:/\borcamentos?\b|\bpropostas? comerciais?\b/g},
    {id:'tnota_fiscal',name:'Notas fiscais',pattern:/\bnotas? fisca(?:l|is)\b|\bnf[-s]?(?:e)?\b|\bnfs[- ]?e\b|\bfaturad[oa]s?\b|\bfaturament[oa]\b/g},
    {id:'treceber',name:'Contas a receber',pattern:/\b(?:a receber|falta(?:m)? (?:valor(?:es)? )?(?:a )?receber|contas? a receber|recebiment[oa]s?|recebidos?|recebidas?|recebid[oa]s?|nao (?:foi|foram|estao|esta|foi totalmente)? ?(?:recebid[oa]s?|pag[oa]s?)|nao pag[oa]s?|pagamentos? de clientes?)\b|\b(?:inadimplencia|inadimplentes?)\b/g},
    {id:'tos',name:'Ordens de serviço',pattern:/\b(?:ordens? de servico|ordem de producao)\b/g},
    {id:'tlis_mat',name:'Lista de materiais',pattern:/\b(?:listas? de materiais|materiais?|materias? primas?|componentes?)\b/g},
    {id:'tsol_max_os',name:'Solicitações de materiais',pattern:/\b(?:solicitac(?:ao|oes) de (?:material|compra)|materiais? solicitados?|solicitacoes? da os)\b/g},
    {id:'tord_com',name:'Ordens de compra',pattern:/\b(?:ordens? de compras?|pedidos? de compras?|\boc\b)\b/g},
    {id:'tpagar',name:'Contas a pagar',pattern:/\b(?:contas? a pagar|pagamentos? a fornecedores?|titulos? a pagar|despesas? a pagar)\b/g},
    {id:'tcom_aux',name:'Itens de compras',pattern:/\b(?:itens? de compras?|materiais? comprados?)\b/g},
    {id:'tcompras',name:'Compras / recebimento',pattern:/\b(?:recebimento de materiais?|entrada de compras?|notas? de entrada|compras? realizadas?)\b/g},
    {id:'tcliente',name:'Clientes',pattern:/\b(?:clientes?|contatos? de clientes?)\b/g},
    {id:'tfornece',name:'Fornecedores',pattern:/\b(?:fornecedores?)\b/g},
    {id:'tproduto',name:'Produtos',pattern:/\b(?:produtos?|cadastro de produtos?|pecas?)\b/g},
    {id:'tpro_pro',name:'Apontamentos de produção',pattern:/\b(?:apontamentos?|horas? apontadas?|horas? trabalhadas?)\b/g},
    {id:'tctrl_ph',name:'Controle de produção',pattern:/\b(?:controle de producao|percentual produzido|etapas? de producao)\b/g},
    {id:'tos_aux',name:'Sub-OS / etapas',pattern:/\b(?:sub[- ]?os|etapas? da os|operacoes? da os)\b/g},
    {id:'tproduto_deposito',name:'Estoque / depósitos',pattern:/\b(?:estoque|depositos?|saldo em estoque)\b/g}
  ];
  const specificity = ['tsol_max_os','tord_com','tpagar','tcom_aux','tcompras','tcliente','treceber','tpro_pro','tctrl_ph','tproduto_deposito'];
  const vagueTerms = /\b(com|que tenham|que tem|que tiveram|que foram|que estao|mostrar|trazer|quero|todos|todas|listar)\b/g;
  const fields = {
    tos:['codigo','produto','qtde'],
    tos_aux:['cod_os','codigo'],
    torcamento:['codigo','n_orcamento','cliente'],
    torcamento_itens:['cod_orcamento','cod_produto'],
    tnota_fiscal:['numero','modelo','dt_emissao','razao_social'],
    tnota_fiscal_item:['cod_orcamento','cod_produto'],
    tnota_fiscal_servico:['cod_orcamento'],
    treceber:['n_nf','dt_vencimento','valor','valor_pago','pago'],
    tcliente:['codigo','nome'],
    tfornece:['codigo','nome'],
    tord_com:['codigo','cod_fornecedor'],
    tord_aux:['cod_ord_compra','cod_produto'],
    tpagar:['aut_','parcela','dt_vencimento','valor','valor_pago','pago'],
    tlis_mat:['cod_os','cod_os_aux','cod_produto','qtde'],
    tsol_max_os:['cod_os','cod_os_aux','guid_lm'],
    tsol_max:['guid_linha','cod_produto'],
    tcom_aux:['cod_produto'],
    tcompras:['codigo'],
    tproduto:['codigo','nome'],
    tpro_pro:['cod_os'],
    tctrl_ph:['cod_os'],
    tproduto_deposito:['cod_produto']
  };
  function actualFields(table){return (SCHEMA.tables[table]?.fields||[]).map(c=>c[0]);}
  function wantedFields(table,q){
    const all=actualFields(table),matched=[];
    const blacklist=new Set(['codigo','nome','cod_empresa','descricao','status','tipo','valor','data','dt_hora','dt_cadastro','usuario','cod_orcamento','cod_os','cod_produto','cod_cliente','cod_fornecedor','cod_deposito']);
    for(const field of all){
      if(blacklist.has(field)||field.length<5)continue;
      const token=field.replace(/_/g,' ');
      const rx=new RegExp('\\b'+token.replace(/ /g,'[ _]')+'\\b','i');
      if(rx.test(q))matched.push(field);
    }
    return matched.sort((a,b)=>b.length-a.length).slice(0,12);
  }
  const genericTransits = new Set(['tempresa','tproduto','tcliente','tfornece','treceber','tpagar','tcc','ttp_movi','tdeposito','tproduto_deposito','tproduto_dep_loteserie','tproduto_dep_reserva']);
  // Relacionamentos extraidos com GUID e empresa sao preferidos.
  function edgeCost(r) {
    const hasEmp = r.keys.some(([a,b])=>a==='cod_empresa' && b==='cod_empresa');
    const weak = r.keys.length < 2 ? 5 : 0;
    return 9 + 9/(1+Math.log2(1+(r.file_count||1))) + (hasEmp ? 0 : 7) + weak + (r.derived?13:0) + ((r.a==='tord_serv'||r.b==='tord_serv')?55:0) + (r.origin==='Estrutura CPS'?25:0) + (r.origin==='Sugestao automatica'?65:0);
  }
  // Dijkstra em grafo pequeno. Nunca atravessa cadastro genérico como atalho.
  function route(fromSet, dest, occupied) {
    if (fromSet.has(dest)) return {nodes:[dest],steps:[],cost:0};
    const pq = [],best = new Map();
    [...fromSet].forEach(a=> {pq.push({at:a,nodes:[a],steps:[],cost:0}); best.set(a,0);});
    let iterations=0;
    while(pq.length && ++iterations<1500) {
      pq.sort((a,b)=>a.cost-b.cost);
      const cur=pq.shift();
      if (cur.at===dest) return cur;
      if(cur.steps.length>=7) continue;
      for(const r of adj.get(cur.at)||[]) {
        const next = r.a===cur.at ? r.b : r.a;
        if(cur.nodes.includes(next))continue;
        if (occupied.has(next) && next!==dest)continue;
        if(genericTransits.has(next) && next!==dest)continue;
        const c = cur.cost+edgeCost(r);
        if(c >= (best.get(next)||Infinity))continue;
        best.set(next,c);
        pq.push({at:next,nodes:[...cur.nodes,next],steps:[...cur.steps,{from:cur.at,to:next,rel:r}],cost:c});
      }
    }
    return null;
  }
  function parseRequest(raw, manual) {
    let q=norm(raw);
    const found=[];
    for(const c of concepts) {
      const ix=(c.id==='tos') ? Math.min(firstText(q,new RegExp(c.pattern.source,'g')),firstText(raw,/\bOS\b/g)) : firstText(q,new RegExp(c.pattern.source,'g'));
      if(Number.isFinite(ix)&&allTables.has(c.id))found.push({...c,ix,via:'texto'});
    }
    for(const name of allTables) {
      const rx=new RegExp('\\b'+name+'\\b','g'),ix=firstText(q,rx);
      if(Number.isFinite(ix) && !found.some(x=>x.id===name))found.push({id:name,name:name.toUpperCase(),ix,via:'tabela explicita'});
    }
    if(manual.trim()) {
      for(const t of manual.split(/[,;\s]+/).map(x=>x.toLowerCase().trim()).filter(Boolean)) {
        if(allTables.has(t) && !found.some(x=>x.id===t))found.push({id:t,name:t.toUpperCase(),ix:0,via:'manual'});
      }
    }
    // Vencimentos/parcelas de orçamento ou NF implicam TRECEBER.
    if (/\b(?:parcelas?|titulos?)\b/.test(q) && /\b(?:vencid[oa]s?|atrasad[oa]s?|em atraso)\b/.test(q) && found.some(x=>x.id==='torcamento'||x.id==='tnota_fiscal') && !found.some(x=>x.id==='treceber')) {
      found.push({id:'treceber',name:'Contas a receber',ix:q.indexOf('parcela')>=0?q.indexOf('parcela'):q.length,via:'inferência por parcelas'});
    }
    // 'Ordens de compra não recebidas' descreve entrada física, não títulos a receber.
    if(found.some(x=>x.id==='tord_com') && /\bnao recebid[oa]s?\b/.test(q) && !/\b(?:a receber|contas? a receber|valor(?:es)? a receber|financeir[oa]|recebimento de clientes)\b/.test(q)) {
      for(let k=found.length-1;k>=0;k--)if(found[k].id==='treceber' && found[k].via==='texto')found.splice(k,1);
    }
    found.sort((a,b)=>a.ix-b.ix || specificity.indexOf(b.id)-specificity.indexOf(a.id));
    const explicitRoot = found.find(x=>x.via==='manual') || found[0];
    const emp=q.match(/\bempresa\s*(?:n(?:ro|umero|\.)?\s*)?(\d{1,5})\b/);
    const missing=/\bsem\s+(?:notas?|nfs?|ordens?|apontamentos?|pedidos?|solicitacoes?|itens?|compras?|registro)|\bnao (?:possui|tem|tiveram|tiver|temos|geraram|emitiram|existe)\b/.test(q);
    const unpaid=/\b(?:a receber|falta(?:m)? (?:valor(?:es)? )?(?:a )?receber|ainda falta(?:m)? (?:valor(?:es)? )?(?:a )?receber|nao recebid[oa]s?|nao pag[oa]s?|nao (?:foi|foram|estao|esta) (?:totalmente )?(?:recebid[oa]s?|pag[oa]s?)|ainda nao (?:foi|foram|estao|esta) (?:totalmente )?(?:recebid[oa]s?|pag[oa]s?)|em aberto|pendentes?|inadimplentes?|saldo a receber|valor a receber)\b/.test(q);
    const late=/\b(?:vencid[oa]s?|atrasad[oa]s?|em atraso)\b/.test(q);
    const paid=/\b(?:quitad[oa]s?|totalmente recebid[oa]s?|ja pag[oa]s?|integralmente pag[oa]s?)\b/.test(q);
    const period=/\b(?:mes passado|mes atual|mes de|ano de|ultimos? \d+ dias|entre \d|periodo de|\d\d\/\d\d\/\d\d\d\d)\b/.test(q);
    const expectsReceipt=/\b(?:nao (?:(?:foi|foram) )?recebid[oa]s?|ainda nao (?:(?:foi|foram) )?recebid[oa]s?|sem recebimento|nao entregues?|pendente de entrega)\b/.test(q)&&found.some(x=>x.id==='tord_com'||x.id==='tcompras') && !/\b(?:contas? a receber|a receber|financeiro|valor a receber)\b/.test(q);
    return {q, found,root:explicitRoot, company:emp?Number(emp[1]):null, missing, unpaid, late, paid, period, expectsReceipt};
  }
  function isFinanceRecipe(intent) {
    const ids=new Set(intent.found.map(x=>x.id));
    return ids.has('torcamento') && ids.has('tnota_fiscal') && ids.has('treceber') && (intent.unpaid || intent.late || intent.paid);
  }
  // SQL financeiro baseado em:
  // COMISSÃO.txt: TRECEBER -> TORCAMENTO (cod_empresa,cod_orcamento)
  // CAPITAL_FINANCEIRO.SQL: TRECEBER.valor_corrigido/valor_pago/pago/previsao e chave da NF
  // COMISSAO ANFEER (POR EMISSÃO DE NOTA FISCAL).txt: NFS-e.
  function buildFinanceSQL(i) {
    const where=[];
    if(i.unpaid || i.late) where.push('f.saldo_a_receber > 0');
    if(i.late)where.push('f.parcelas_vencidas > 0');
    if(i.paid && !i.unpaid && !i.late)where.push('f.saldo_a_receber <= 0');
    if(i.company!==null)where.push('o.cod_empresa = '+i.company);
    let sql=`/* CPS JoinLab · PostgreSQL · consulta de orçamentos faturados + financeiro.
   1 linha por orçamento, sem multiplicar parcelas pelos itens das NFs.
   Verifique as ressalvas abaixo do SQL antes de usar em produção. */
WITH notas AS (
    -- NF-e de produtos: relaciona o item ao orçamento.
    SELECT DISTINCT i.cod_empresa, i.cod_orcamento,
           'NF-e ' || nf.numero::text AS nota, nf.dt_emissao
    FROM tnota_fiscal_item i
    JOIN tnota_fiscal nf
      ON nf.cod_empresa = i.cod_empresa
     AND nf.modelo = i.modelo
     AND nf.serie = i.serie
     AND nf.sub_serie = i.sub_serie
     AND nf.numero = i.numero_nf
    WHERE nf.modelo = '55'
      AND nf.cancelada = 0
      AND nf.nfe_cod_status = '100'
      AND i.cod_orcamento IS NOT NULL
    UNION
    -- NFS-e: confirma emissao pelo numero municipal preenchido.
    SELECT DISTINCT s.cod_empresa, s.cod_orcamento,
           'NFS-e ' || nf.numero_nfse::text AS nota, nf.dt_emissao
    FROM tnota_fiscal_servico s
    JOIN tnota_fiscal nf
      ON nf.cod_empresa = s.cod_empresa
     AND nf.modelo = s.modelo
     AND nf.serie = s.serie
     AND nf.sub_serie = s.sub_serie
     AND nf.numero = s.numero_nf
    WHERE nf.modelo = '1'
      AND nf.cancelada = 0
      AND NULLIF(TRIM(nf.numero_nfse::text), '') IS NOT NULL
      AND s.cod_orcamento IS NOT NULL
),
notas_orcamento AS (
    SELECT cod_empresa, cod_orcamento,
           STRING_AGG(DISTINCT nota, ', ' ORDER BY nota) AS notas_emitidas,
           COUNT(*) AS qtd_notas,
           MAX(dt_emissao) AS ultima_emissao
    FROM notas
    GROUP BY cod_empresa, cod_orcamento
),
financeiro_orcamento AS (
    SELECT r.cod_empresa, r.cod_orcamento,
           SUM(COALESCE(r.valor_corrigido, r.valor, 0)) AS valor_financeiro,
           SUM(COALESCE(r.valor_pago, 0)) AS valor_recebido,
           SUM(CASE WHEN COALESCE(r.pago,0)=1 THEN 0
                    ELSE GREATEST(COALESCE(r.valor_corrigido,r.valor,0)
                                  -COALESCE(r.valor_pago,0),0) END) AS saldo_a_receber,
           MIN(CASE WHEN COALESCE(r.pago,0)<>1
                         AND COALESCE(r.valor_corrigido,r.valor,0)>COALESCE(r.valor_pago,0)
                    THEN r.dt_vencimento END) AS proximo_vencimento,
           COUNT(*) FILTER (WHERE COALESCE(r.pago,0)<>1
                             AND r.dt_vencimento::date<CURRENT_DATE
                             AND COALESCE(r.valor_corrigido,r.valor,0)>COALESCE(r.valor_pago,0)) AS parcelas_vencidas
    FROM treceber r
    WHERE COALESCE(r.previsao,0)=0
      AND r.n_nf > 0 -- titulo vinculado a numero de NF
      AND r.cod_orcamento IS NOT NULL
    GROUP BY r.cod_empresa, r.cod_orcamento
)
SELECT o.cod_empresa, o.codigo AS cod_orcamento,
       o.n_orcamento, o.cliente,
       n.notas_emitidas, n.qtd_notas, n.ultima_emissao,
       f.valor_financeiro, f.valor_recebido, f.saldo_a_receber,
       f.proximo_vencimento, f.parcelas_vencidas
FROM torcamento o
JOIN notas_orcamento n
  ON n.cod_empresa=o.cod_empresa AND n.cod_orcamento=o.codigo
JOIN financeiro_orcamento f
  ON f.cod_empresa=o.cod_empresa AND f.cod_orcamento=o.codigo`;
    if(where.length)sql+='\nWHERE '+where.join('\n  AND ');
    sql+='\nORDER BY f.proximo_vencimento NULLS LAST, o.cod_empresa, o.n_orcamento;';
    return {sql, tableRoute:['TORCAMENTO','TNOTA_FISCAL_ITEM','TNOTA_FISCAL','TNOTA_FISCAL_SERVICO','TRECEBER'],
      evidence:['COMISSÃO.txt','CAPITAL_FINANCEIRO.SQL','COMISSAO ANFEER (POR EMISSÃO DE NOTA FISCAL).txt'],
      warnings:[
        'Saldo financeiro agregado por orçamento, não vinculado individualmente a cada NF. Para vincular títulos à NF, é preciso validar também N_NF + empresa + série/modelo e evitar colisões.',
        'NF-e filtrada por status 100 e CANCELADA = 0; NFS-e exige numero municipal e CANCELADA = 0. Confira excecoes no CPS.',
        'TRECEBER considera PREVISAO = 0 e N_NF > 0. Confira a regra para valores corrigidos e titulos vinculados a COD_ORCAMENTO.',
        ...(i.period?['Há um período na solicitação que não foi aplicado automaticamente; acrescente os limites em DT_EMISSAO ou DT_VENCIMENTO.']:[])
      ],kind:'Consulta financeira estruturada'};
  }
  function buildJoinSQL(i) {
    const requested=i.found.map(x=>x.id);
    const root=i.root?.id;
    if(!root)return {error:'Não identifiquei tabelas do CPS na pergunta. Mencione orçamento, nota fiscal, OS, compras, cliente ou o nome das tabelas.'};
    const nodes=new Set([root]);
    const joins=[];
    const disconnected=[];
    const pending=requested.filter(t=>t!==root);
    while(pending.length) {
      let best=null;
      for(const dest of pending) {
        const r=route(nodes,dest,nodes);
        if(r && (!best || r.cost<best.cost))best={dest,...r};
      }
      if(!best){disconnected.push(...pending);break;}
      for(const s of best.steps){if(!nodes.has(s.to)){joins.push(s);nodes.add(s.to);}}
      pending.splice(pending.indexOf(best.dest),1);
    }
    const aliases=new Map([...nodes].map((x,n)=>[x,'t'+n]));
    const cols=[];
    const picked=new Set();
    function addcol(table,field) {
      const alias=aliases.get(table);if(!alias)return;
      if(SCHEMA.tables[table] && !actualFields(table).includes(field))return;
      let key=table+'.'+field;if(picked.has(key))return;picked.add(key);
      cols.push('    '+alias+'.'+field+' AS '+table+'_'+field);
    }
    if(aliases.has(root)){
      let basics=(fields[root]||[]).filter(f=>!SCHEMA.tables[root]||actualFields(root).includes(f)).slice(0,3);
      if(!basics.length)basics=['cod_empresa','codigo','nome','descricao'].filter(f=>actualFields(root).includes(f)).slice(0,3);
      if(basics.length)basics.forEach(f=>addcol(root,f));
      else cols.push('    '+aliases.get(root)+'.*');
      wantedFields(root,i.q).forEach(f=>addcol(root,f));
    }
    for(const c of i.found)if(c.id!==root && aliases.has(c.id)){
      let basic=(fields[c.id]||[]).filter(f=>!SCHEMA.tables[c.id]||actualFields(c.id).includes(f)).slice(0,5);
      if(!basic.length)basic=['codigo','nome','descricao','cod_empresa'].filter(f=>actualFields(c.id).includes(f)).slice(0,3);
      basic.forEach(f=>addcol(c.id,f));
      wantedFields(c.id,i.q).forEach(f=>addcol(c.id,f));
    }
    if(cols.length===0)cols.push('    '+aliases.get(root)+'.*');
    let sql='/* CPS JoinLab · caminho extraido das queries.\n   Modelo relacional de referência: revise filtros e cardinalidade. */\n';
    sql+='SELECT\n'+cols.join(',\n')+'\nFROM '+root+' '+aliases.get(root);
    for(const s of joins){
      const r=s.rel,from=aliases.get(s.from),to=aliases.get(s.to);
      const direction=s.from===r.a;
      const cond=r.keys.map(k=>'    '+from+'.'+(direction?k[0]:k[1])+' = '+to+'.'+(direction?k[1]:k[0])).join('\nAND ');
      sql+='\n'+(i.missing?'LEFT JOIN':'INNER JOIN')+' '+s.to+' '+to+'\n  ON '+cond;
    }
    const isAnti=i.missing && requested.length===2 && joins.length===1 && !i.expectsReceipt;
    if(isAnti){
      const s=joins[0],r=s.rel,rev=s.from===r.a;
      const rootAlias=aliases.get(root);
      const childAlias=aliases.get(s.to);
      const predicate=r.keys.map(k=>rootAlias+'.'+(rev?k[0]:k[1])+' = '+childAlias+'.'+(rev?k[1]:k[0])).join(' AND ');
      sql='/* CPS JoinLab - ausencia validada pela chave do JOIN. */\nSELECT '+rootAlias+'.*\nFROM '+root+' '+rootAlias+'\nWHERE NOT EXISTS (SELECT 1 FROM '+s.to+' '+childAlias+' WHERE '+predicate+')';
      if(i.company!==null)sql+='\n  AND '+rootAlias+'.cod_empresa = '+i.company;
      sql+='\nORDER BY 1;';
      return {sql,tableRoute:[root.toUpperCase(),s.to.toUpperCase()],warnings:['Filtro NOT EXISTS aplicado usando as chaves identificadas nas queries. Revise definição de ausência (sem filhos, sem movimentações etc.).'],evidence:s.rel.files.slice(0,3),joins,kind:'Consulta de ausência (NOT EXISTS)'};
    }
    const conditions=[];
    const hasNF=aliases.has('tnota_fiscal'), nfAlias=aliases.get('tnota_fiscal');
    // Nota emitida tem regra de emissao: nao basta a tabela TNOTA_FISCAL aparecer no JOIN.
    if(hasNF && /\b(?:emitid[oa]s?|faturad[oa]s?|emitiram|emissao)\b/.test(i.q)) {
      conditions.push(nfAlias+'.cancelada = 0');
      conditions.push('('+nfAlias+".modelo = '55' AND "+nfAlias+".nfe_cod_status = '100' OR "+nfAlias+".modelo = '1' AND NULLIF(TRIM("+nfAlias+".numero_nfse::text), '') IS NOT NULL)");
    }
    if(i.company!==null) {
      if(root==='tempresa')conditions.push(aliases.get(root)+'.codigo = '+i.company);
      else if(root==='treceber'||root==='tpagar'||i.root.id!=='tempresa'){
        if(['cod_empresa'].some(x=>[...RR].some(r=>r.keys.some(p=>p.includes(x))&&(r.a===root||r.b===root))))conditions.push(aliases.get(root)+'.cod_empresa = '+i.company);
      }
    }
    if(i.unpaid && !i.expectsReceipt) {
      const table=['treceber','tpagar'].find(x=>aliases.has(x));
      if(table) {
        const a=aliases.get(table);
        conditions.push('COALESCE('+a+'.pago,0) = 0');
        if(table==='treceber') {
          conditions.push('COALESCE('+a+'.previsao,0) = 0');
          if(hasNF)conditions.push(a+'.n_nf > 0');
          conditions.push('COALESCE('+a+'.valor_corrigido,'+a+'.valor,0) > COALESCE('+a+'.valor_pago,0)');
        }
      }
    }
    if(i.late) {
      const table=['treceber','tpagar'].find(x=>aliases.has(x));
      if(table)conditions.push(aliases.get(table)+'.dt_vencimento::date < CURRENT_DATE');
    }
    if(conditions.length)sql+='\nWHERE '+conditions.join('\n  AND ');
    sql+='\nORDER BY 1;';
    const warnings=['Consulta relacional: revise duplicacoes e cardinalidade antes de totalizar valores.'];
    const structural=joins.filter(x=>x.rel.origin==='Estrutura CPS');
    const suggestions=joins.filter(x=>x.rel.origin==='Sugestao automatica');
    if(structural.length)warnings.push('Relacionamento(s) estruturais do mapa CPS, sem validacao em registros: '+structural.map(x=>x.rel.id).join(', ')+'.');
    if(suggestions.length)warnings.unshift('ATENCAO: '+suggestions.length+' JOIN(s) sao sugestoes por nome de campo, NAO confirmadas no banco: '+suggestions.map(x=>x.rel.id).join(', ')+'.');
    if(disconnected.length)warnings.unshift('Não foi possível conectar: '+disconnected.join(', ')+'. Essas tabelas ficaram fora do SQL.');
    if(i.expectsReceipt)warnings.unshift('Pedido ainda não recebido: falta regra validada para recebimento físico/entrada em estoque. SQL mostra os vínculos, mas NÃO filtra pedidos sem recebimento.');
    if(i.unpaid && !i.expectsReceipt && !aliases.has('treceber') && !aliases.has('tpagar'))warnings.unshift('Saldo pendente solicitado, mas nenhuma tabela financeira no caminho: filtro de saldo NÃO aplicado.');
    if(/\b(?:emitid[oa]s?|faturad[oa]s?|emitiram|emissao)\b/.test(i.q) && !hasNF)warnings.unshift('Nota emitida solicitada, mas TNOTA_FISCAL nao entrou no caminho: filtro de emissao NÃO aplicado.');
    if(i.missing)warnings.push('Condição de ausência (SEM/NÃO TEM) com múltiplas tabelas: revise o filtro NOT EXISTS; não foi aplicado automaticamente.');
    if(i.period)warnings.push('Período mencionado, mas nenhum filtro temporal foi aplicado. Defina a coluna e datas exatas.');
    if(i.paid && !i.unpaid)warnings.push('Pedido de valores já pagos detectado; confira o filtro PAGO, que não foi aplicado nesta consulta relacional.');
    const risky=joins.filter(s=>!s.rel.keys.some(([a,b])=>a==='cod_empresa'&&b==='cod_empresa'));
    if(risky.length)warnings.push('Há JOIN(s) sem COD_EMPRESA nas condições extraídas: '+risky.map(s=>s.rel.id).join(', ')+'. Confira isolamento entre empresas.');
    const evidence=[...new Set(joins.flatMap(s=>s.rel.files.slice(0,2)))].slice(0,8);
    if(!evidence.length)evidence.push('Mapa estrutural CPS: '+SCHEMA.meta.tables+' tabelas / '+SCHEMA.meta.cols+' campos');
    return {sql,tableRoute:[...nodes].map(t=>t.toUpperCase()),warnings,evidence,joins,disconnected,kind:'Caminho dinâmico por relacionamentos'};
  }
  function generate(q,manual) {
    const i=parseRequest(q,manual||'');
    if(!i.root)return {intent:i,error:'Não identifiquei um assunto do CPS. Escreva "orçamentos com notas fiscais e saldo a receber", "OS com ordens de compra e pagamentos" ou informe as tabelas.'};
    if(i.found.length<2 && !wantedFields(i.root.id,i.q).length && !/\b(?:tabela|campos?|colunas?|todos|todas|listar|mostrar|trazer|quero)\b/.test(i.q))
      return {intent:i,error:'Encontrei '+i.root.name+', mas nao identifiquei campos ou outras tabelas para consultar.'};
    if(isFinanceRecipe(i))return {intent:i,...buildFinanceSQL(i)};
    return {intent:i,...buildJoinSQL(i)};
  }

  const css=document.createElement('style');css.textContent=`
    .nl-lab{display:grid;gap:13px}.nl-text{font:14px/1.6 Inter,system-ui,sans-serif;width:100%;min-height:118px;resize:vertical;background:#091827;border:1px solid #36506a;color:#ecf5ff;border-radius:11px;padding:15px;outline:none}.nl-text:focus{border-color:#46d5cb}.nl-inputs{display:grid;grid-template-columns:1fr 180px;gap:12px}.nl-action{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.nl-chiprow{display:flex;flex-wrap:wrap;gap:7px;padding:3px 0}.nl-chip{border:1px solid #33736b;color:#bdf5ed;background:#14333a;border-radius:24px;font-size:12px;padding:7px 11px}.nl-chip.muted{color:#b9cfe4;border-color:#33536a;background:#1b2c3f}.nl-alert{padding:14px 16px;margin:12px 0;background:#30291d;border:1px solid #685635;border-radius:10px;color:#f4d9a8;font-size:12px;line-height:1.7}.nl-ok{padding:15px;background:#122e34;border:1px solid #28716b;border-radius:11px;color:#c0ece4;line-height:1.6}.nl-query{max-height:700px;white-space:pre;overflow:auto;font-size:12px}.nl-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:13px}.nl-head h3{margin:0}.nl-sources{font-size:12px;color:#9fb9cf;line-height:1.6}.nl-sources b{color:#d4e4f1}.nl-sub{font-size:12px;color:var(--muted);line-height:1.65}.nl-mini-btn{background:#102b3a;border:1px solid #375c6e;color:#c7e8ec;border-radius:8px;padding:9px 12px}.nl-node{font-family:Consolas,monospace}.nl-example{cursor:pointer}
    @media(max-width:790px){.nl-inputs{grid-template-columns:1fr}.nl-action .primary{width:100%}}
  `;document.head.appendChild(css);
  // Replaces v1 programmatically without touching other tabs.
  document.querySelectorAll('[data-view="natural"]').forEach(x=>x.remove());
  const prev=document.getElementById('view-natural');if(prev)prev.remove();
  const nav=document.createElement('button');nav.className='nav';nav.dataset.view='natural';nav.innerHTML='<span class="ico">✳</span> Consulta em português';
  const side=document.querySelector('.sidebar .sidenote');side.parentNode.insertBefore(nav,side);
  const mob=document.createElement('button');mob.dataset.view='natural';mob.textContent='Por objetivo';document.querySelector('.mobile-nav').prepend(mob);
  [nav,mob].forEach(b=>b.addEventListener('click',()=>openTab('natural')));
  const view=document.createElement('section');view.className='view';view.id='view-natural';
  view.innerHTML=`<div class="panel nl-lab"><div><div class="eyebrow">CPS JOINLAB · CONSULTAS POR OBJETIVO</div><h2 style="margin:10px 0 7px">Descreva o que você quer buscar</h2><p class="sub" style="margin:0">Uso ${SCHEMA.meta.tables||963} tabelas e ${SCHEMA.meta.cols||18031} campos do CPS, priorizando os JOINs das suas 172 queries. O site é online; o SQL é gerado no seu navegador, sem IA externa e sem consultar o banco.</p></div><div><label for="nl-ask">Sua solicitação</label><textarea id="nl-ask" class="nl-text" placeholder="Ex.: Quero orçamentos com notas fiscais emitidas e valores que ainda falta receber"></textarea></div><div class="nl-inputs"><div><label for="nl-extra">Tabelas obrigatórias (opcional)</label><input id="nl-extra" placeholder="Ex.: TOS,TORD_COM,TPAGAR" spellcheck="false"></div><div><label for="nl-type">Banco</label><select id="nl-type"><option value="pg">PostgreSQL</option><option value="sqlserver">SQL Server (estrutura)</option></select></div></div><div class="nl-action"><button class="primary" id="nl-build">Montar SQL →</button><button class="secondary" id="nl-reset">Limpar</button><span class="mini">Ctrl + Enter para gerar</span></div><div class="nl-chiprow"><button class="chip nl-example" data-q="Quero orçamentos que emitiram notas fiscais e ainda falta receber">Orçamentos · NF · a receber</button><button class="chip nl-example" data-q="Quero orçamentos com notas fiscais e parcelas vencidas da empresa 1">Vencidos · empresa 1</button><button class="chip nl-example" data-q="Quero OS com ordens de compra e contas a pagar">OS · OC · financeiro</button><button class="chip nl-example" data-q="Quero produtos com codigo interno, referencia e peso da tabela TPRODUTO">Clientes · notas fiscais</button><button class="chip nl-example" data-q="Quero OS com solicitações de material e ordens de compra não recebidas">OS · solicitação · OC</button></div><div id="nl-output"></div></div><div class="hint"><strong>Importante:</strong> O site fica hospedado no GitHub Pages, mas o processamento roda no navegador. Não é IA generativa e não acessa o banco. JOINs do mapa estrutural são sinalizados como ainda não validados. Quando uma regra de negócio não estiver confirmada, mostra a pendência em vez de inventar filtros.</div>`;
  document.querySelector('#view-builder').before(view);
  const $=sel=>document.querySelector(sel);const output=$('#nl-output');
  function render(res){
    output.replaceChildren();
    if(res.error){output.innerHTML='<div class="nl-alert"><b>Preciso de mais informações.</b><br>'+html(res.error)+'</div>';return;}
    const head=document.createElement('div');head.className='nl-head';head.innerHTML='<h3>'+html(res.kind)+'</h3><div class="nl-action"><button id="nl-copy" class="copy">Copiar SQL</button><button id="nl-download" class="nl-mini-btn">Baixar .sql</button></div>';output.append(head);
    const chips=document.createElement('div');chips.className='nl-chiprow';
    const all=[...res.intent.found.map(c=>c.name+' → '+c.id.toUpperCase()),...((res.intent.company!==null)?['Empresa '+res.intent.company]:[])];
    for(const text of all){const s=document.createElement('span');s.className='nl-chip';s.textContent=text;chips.append(s);}output.append(chips);
    let msg=document.createElement('div');msg.className='nl-ok';
    msg.innerHTML='<b>Caminho interpretado:</b><br><span class="nl-node">'+res.tableRoute.map(html).join(' → ')+'</span><br><span class="nl-sub">'+(res.joins?'JOINs físicos recuperados: '+res.joins.length+'.':'Agregação controlada por orçamento e emissão de nota fiscal.')+'</span>';
    output.append(msg);
    const source=document.createElement('p');source.className='nl-sources';source.innerHTML='<b>Fontes / evidências:</b> '+(res.evidence.map(html).join(' · ')||'Consulte a biblioteca de relacionamentos.');output.append(source);
    for(const warning of res.warnings){const item=document.createElement('div');item.className='nl-alert';item.textContent=warning;output.append(item);}
    const pre=document.createElement('pre');pre.className='nl-query';pre.textContent=res.sql;output.append(pre);
    $('#nl-copy').addEventListener('click',e=>copyText(res.sql,e.currentTarget));
    $('#nl-download').addEventListener('click',()=>downloadFile('cps_consulta_'+new Date().toISOString().slice(0,10)+'.sql',res.sql,'text/plain;charset=utf-8'));
  }
  function run(){
    const q=$('#nl-ask').value.trim(), extra=$('#nl-extra').value;
    if(!q && !extra.trim()){output.innerHTML='<div class="empty">Descreva a consulta ou informe as tabelas.</div>';return;}
    const res=generate(q,extra);
    if(res.sql && $('#nl-type').value==='sqlserver') {
      if(res.kind==='Consulta financeira estruturada'){
        res.warnings.unshift('Essa consulta financeira usa operadores PostgreSQL (STRING_AGG ORDER BY, FILTER, ::date). Mude para PostgreSQL ou adapte manualmente; não será apresentada como SQL Server pronto.');
      }else{
        res.sql=res.sql.replaceAll('::date','');
        res.warnings.unshift('Estrutura dos JOINs compatível com SQL Server; valide nomes de campos e tipos no banco do cliente.');
      }
    }
    render(res);
    try{localStorage.setItem('cps-joinlab-ask',q);localStorage.setItem('cps-joinlab-manual',extra);}catch(e){}
  }
  $('#nl-build').addEventListener('click',run);
  $('#nl-reset').addEventListener('click',()=>{ $('#nl-ask').value='';$('#nl-extra').value='';output.replaceChildren();$('#nl-ask').focus();try{localStorage.removeItem('cps-joinlab-ask');localStorage.removeItem('cps-joinlab-manual');}catch(e){} });
  $$('.nl-example').forEach(b=>b.addEventListener('click',()=>{$('#nl-ask').value=b.dataset.q;$('#nl-extra').value='';run();}));
  $('#nl-ask').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();run();}});
  try{$('#nl-ask').value=localStorage.getItem('cps-joinlab-ask')||'';$('#nl-extra').value=localStorage.getItem('cps-joinlab-manual')||'';}catch(e){}
  const origMenu=window.location.hash; if(origMenu==='#natural')openTab('natural');
  window.CPSJoinLabNL={generate,parseRequest,route,schema:SCHEMA,version:'3.0'}; // diagnostic/testing only
  function $$(sel){return Array.from(document.querySelectorAll(sel));}
})();