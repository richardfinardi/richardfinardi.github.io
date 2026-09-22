/**
 * CONSULTORIA.RF | GESTÃO DE CUSTOS
 * BACKEND V5.2.28
 *
 * NOVO:
 * - TPERIODO_DESCONSIDERAR_DEPRECIACAO na coluna K (índice 10): SIM / NAO
 * - Quando SIM:
 *      • mantém os valores cadastrados em TRECURSO e TPERIODO
 *      • não utiliza depreciação de recursos nos cálculos
 *      • não utiliza depreciação predial nos cálculos
 * - Considerar Mínimo no Centro de Custo:
 *      • TCENTRO_CUSTO_CONSIDERAR_MINIMO = SIM
 *      • PRODUTIVIDADE = 100%
 *      • TIPO RATEIO = MINIMO
 *      • HORAS FINAIS = 130h
 *
 * V5.2.12:
 * - UPDATE agora localiza o registro por ID + CLIENTE + PERÍODO quando aplicável.
 * - Isso corrige edições em períodos clonados, onde os IDs podem se repetir entre períodos.
 * - Evita alterar o período de origem quando o usuário edita o período clonado.
 *
 * V5.2.21:
 * - Diagnóstico Automático versionado por cliente/período.
 * - Configuração administrável pelo painel, com aplicação por escopo.
 * - PERIODO_BUNDLE passa a devolver também DIAGNOSTICO_CONFIG.
 *
 *
 * V5.2.28:
 * - Conclusão da análise por cliente/período com registro em TPERIODO_FINALIZACAO.
 * - Envio do PDF da análise por e-mail para richard@consultoriarf.net, usuário e cópias opcionais.
 * - Suporte ao envio de Estudos de Caso temporários, sem gravação das simulações no banco.
 * V5.2.24:
 * - Exclusão de Centro de Custo protegida contra vínculos órfãos.
 * - Transferência segura de Recursos, Funcionários exclusivos e Contas EXCLUSIVAS antes da exclusão do CC.
 * - Rateios percentuais e custo fixo próprio bloqueiam a exclusão até revisão explícita.
 * - Exclusões em BATCH_MUTATE exigem confirmação textual SIM do frontend.
 *
 * V5.2.23:
 * - Cadastro/edição direto na grade com efetivação em lote.
 * - Nova ação BATCH_MUTATE para CREATE/UPDATE/DELETE em uma única gravação e um único recálculo.
 * - TFUNCIONARIO passa a suportar TFUNCIONARIO_BENEFICIOS_IDS na coluna N para preservar a seleção de benefícios.
 *
 * V5.2.22:
 * - Toda configuração nova do Diagnóstico vira o padrão oficial para TODOS os novos clientes/períodos.
 * - O escopo escolhido passa a definir somente a retroatividade sobre períodos já existentes.
 * - Mantida a trava física do backend para qualquer escrita em período FECHADO.
 *
 * IMPORTANTE:
 * - Não apaga nem altera valores patrimoniais/depreciações cadastrados.
 * - Corrige a gravação calculada da TCENTRO_CUSTO para não sobrescrever
 *   campos de configuração.
 */


// ======================================================
// RESPOSTAS JSON
// ======================================================

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ======================================================
// CONVERSÕES
// ======================================================

function numeroSeguro(valor, padrao) {
  if (padrao === undefined) padrao = 0;

  if (valor === null || valor === undefined || valor === "") {
    return padrao;
  }

  if (typeof valor === "number") {
    return isFinite(valor) ? valor : padrao;
  }

  let txt = String(valor).trim();

  if (!txt) return padrao;

  txt = txt.replace(/[^\d,.-]/g, "");

  // Formato brasileiro: 1.234,56
  if (txt.indexOf(",") >= 0) {
    txt = txt.replace(/\./g, "").replace(",", ".");
  }

  const n = parseFloat(txt);
  return isFinite(n) ? n : padrao;
}


function valorSim(valor) {
  const v = String(valor ?? "")
    .trim()
    .toUpperCase();

  return (
    v === "SIM" ||
    v === "S" ||
    v === "TRUE" ||
    v === "1"
  );
}



// ======================================================
// V5.2.21 — DIAGNÓSTICO AUTOMÁTICO VERSIONADO
// ======================================================

function diagnosticoConfigPadrao() {
  return {"schema":1,"regras":[{"id":"ML_NEG","codigo":"MARGEM_LIQUIDA","indicador":"Margem Líquida","nivel":"PRIORIDADE","condicao":"Margem líquida < 0%","titulo":"Resultado líquido negativo","texto":"O DRE fecha com prejuízo no período.","acao":"A principal tomada de decisão neste momento é aumentar receita e reduzir gastos.","tituloOriginal":"Resultado líquido negativo"},{"id":"ML_LOW_BELOW","codigo":"MARGEM_LIQUIDA","indicador":"Margem Líquida","nivel":"CRITICO","condicao":"0% a 10% e rentabilidade abaixo da meta","titulo":"Lucratividade baixa e rentabilidade abaixo da meta","texto":"A margem líquida é de até 10% e o retorno sobre o investimento também está abaixo da meta do período.","acao":"Para esse momento, deve-se buscar aumento de receita e/ou reduzir gastos.","tituloOriginal":"Lucratividade baixa e rentabilidade abaixo da meta"},{"id":"ML_HIGH_BELOW","codigo":"MARGEM_LIQUIDA","indicador":"Margem Líquida","nivel":"CRITICO","condicao":"> 10% e rentabilidade abaixo da meta","titulo":"Boa margem sobre vendas, mas rentabilidade insuficiente","texto":"A lucratividade supera 10%, porém ainda não remunera o investimento no nível esperado.","acao":"Para esse momento, deve-se buscar aumento de receita e/ou reduzir gastos.","tituloOriginal":"Boa margem sobre vendas, mas rentabilidade insuficiente"},{"id":"ML_LOW_META","codigo":"MARGEM_LIQUIDA","indicador":"Margem Líquida","nivel":"ATENCAO","condicao":"0% a 10% e rentabilidade >= meta","titulo":"Meta de rentabilidade atingida, mas lucratividade baixa","texto":"A rentabilidade esperada foi alcançada, porém a margem líquida ainda é de até 10% do faturamento.","acao":"Se for possivel, aumente a receita e/ou reduza gastos.","tituloOriginal":"Meta de rentabilidade atingida, mas lucratividade baixa"},{"id":"ML_HIGH_META","codigo":"MARGEM_LIQUIDA","indicador":"Margem Líquida","nivel":"SAUDAVEL","condicao":"> 10% e rentabilidade >= meta","titulo":"Lucratividade e rentabilidade saudáveis","texto":"A margem líquida supera 10% e a rentabilidade atual atinge ou supera a meta configurada.","acao":"Preservar margem, resultado e disciplina de investimento.","tituloOriginal":"Lucratividade e rentabilidade saudáveis"},{"id":"PE_NOBASE","codigo":"PONTO_EQUILIBRIO","indicador":"Ponto de Equilíbrio Econômico","nivel":"ATENCAO","condicao":"Sem base suficiente para cálculo","titulo":"Ponto de equilíbrio sem base suficiente","texto":"Não há base suficiente para medir a folga econômica.","acao":"Revisar faturamento, custos variáveis e parâmetros do período.","tituloOriginal":"Ponto de equilíbrio sem base suficiente"},{"id":"PE_NEG","codigo":"PONTO_EQUILIBRIO","indicador":"Ponto de Equilíbrio Econômico","nivel":"PRIORIDADE","condicao":"Folga < 0%","titulo":"Faturamento abaixo do ponto de equilíbrio econômico","texto":"O faturamento atual não cobre a estrutura mais a rentabilidade esperada.","acao":"Atuar em faturamento, buscar aumento da margem de contribuição, para isso, atuar nos gastos variáveis e fixos.","tituloOriginal":"Faturamento abaixo do ponto de equilíbrio econômico"},{"id":"PE_0_5","codigo":"PONTO_EQUILIBRIO","indicador":"Ponto de Equilíbrio Econômico","nivel":"CRITICO","condicao":"0% a < 5% de folga","titulo":"Folga mínima sobre o ponto de equilíbrio econômico","texto":"A empresa está muito próxima do limite econômico do período.","acao":"Criar margem de segurança aumentando contribuição ou reduzindo gastos fixos.","tituloOriginal":"Folga mínima sobre o ponto de equilíbrio econômico"},{"id":"PE_5_15","codigo":"PONTO_EQUILIBRIO","indicador":"Ponto de Equilíbrio Econômico","nivel":"ATENCAO","condicao":"5% a < 15% de folga","titulo":"Folga reduzida sobre o ponto de equilíbrio econômico","texto":"Existe cobertura da estrutura e meta, mas a margem de segurança ainda é curta.","acao":"Acompanhar faturamento e despesas fixas com prioridade.","tituloOriginal":"Folga reduzida sobre o ponto de equilíbrio econômico"},{"id":"PE_15_PLUS","codigo":"PONTO_EQUILIBRIO","indicador":"Ponto de Equilíbrio Econômico","nivel":"SAUDAVEL","condicao":">= 15% de folga","titulo":"Boa folga sobre o ponto de equilíbrio econômico","texto":"O faturamento apresenta margem de segurança sobre o nível necessário para cobrir estrutura e meta.","acao":"Preservar a margem de contribuição e evitar crescimento desproporcional da estrutura fixa.","tituloOriginal":"Boa folga sobre o ponto de equilíbrio econômico"},{"id":"MC_LT10","codigo":"MARGEM_CONTRIB","indicador":"Margem de Contribuição","nivel":"PRIORIDADE","condicao":"< 10%","titulo":"Margem de contribuição muito baixa","texto":"Após impostos, deduções e custos variáveis sobra muito pouco para pagar a estrutura fixa.","acao":"Revisar preços, custos variáveis e deduções sobre vendas.","tituloOriginal":"Margem de contribuição muito baixa"},{"id":"MC_10_45","codigo":"MARGEM_CONTRIB","indicador":"Margem de Contribuição","nivel":"CRITICO","condicao":"10% a < 45%","titulo":"Margem de contribuição baixa","texto":"A capacidade de absorção dos custos e despesas fixas está pressionada.","acao":"Priorizar ações sobre preço, impostos/deduções e custos variáveis.","tituloOriginal":"Margem de contribuição baixa"},{"id":"MC_45_60","codigo":"MARGEM_CONTRIB","indicador":"Margem de Contribuição","nivel":"ATENCAO","condicao":"45% a < 60%","titulo":"Margem de contribuição em atenção","texto":"A margem está entre 45% e 60% e deve ser acompanhada para sustentar a estrutura e o resultado.","acao":"Buscar ganho de margem antes de ampliar compromissos fixos.","tituloOriginal":"Margem de contribuição em atenção"},{"id":"MC_60_PLUS","codigo":"MARGEM_CONTRIB","indicador":"Margem de Contribuição","nivel":"SAUDAVEL","condicao":">= 60%","titulo":"Margem de contribuição saudável","texto":"Pelo menos 60% do faturamento permanece após impostos, deduções e custos variáveis para absorver a estrutura e formar resultado.","acao":"Preservar preços e controle dos gastos variáveis.","tituloOriginal":"Margem de contribuição saudável"},{"id":"DO_GT25","codigo":"DESP_OPER","indicador":"Despesas Fixas Operacionais","nivel":"PRIORIDADE","condicao":"> 25% do faturamento","titulo":"Despesas fixas operacionais muito elevadas","texto":"A estrutura fixa operacional consome mais de 25% do faturamento.","acao":"Avaliar os centros de custos administrativos, agir sobre os que tem maior gasto primeiro.","tituloOriginal":"Despesas fixas operacionais muito elevadas"},{"id":"DO_15_25","codigo":"DESP_OPER","indicador":"Despesas Fixas Operacionais","nivel":"CRITICO","condicao":"> 15% até 25% do faturamento","titulo":"Despesas fixas operacionais elevadas","texto":"A estrutura administrativa, comercial e financeira está pressionando o resultado.","acao":"Avaliar os centros de custos administrativos, agir sobre os que tem maior gasto primeiro.","tituloOriginal":"Despesas fixas operacionais elevadas"},{"id":"DO_12_15","codigo":"DESP_OPER","indicador":"Despesas Fixas Operacionais","nivel":"ATENCAO","condicao":"> 12% até 15% do faturamento","titulo":"Despesas fixas operacionais em atenção","texto":"O peso das despesas fixas operacionais está entre 12% e 15% do faturamento.","acao":"Acompanhar as principais contas e evitar crescimento estrutural sem contrapartida de faturamento.","tituloOriginal":"Despesas fixas operacionais em atenção"},{"id":"DO_LE12","codigo":"DESP_OPER","indicador":"Despesas Fixas Operacionais","nivel":"SAUDAVEL","condicao":"<= 12% do faturamento","titulo":"Despesas fixas operacionais controladas","texto":"As despesas fixas operacionais representam até 12% do faturamento.","acao":"Manter revisão periódica das principais contas.","tituloOriginal":"Despesas fixas operacionais controladas"},{"id":"CF_GT50","codigo":"FIXO_INDUSTRIAL","indicador":"Custos Fixos Industriais","nivel":"PRIORIDADE","condicao":"> 50% do faturamento","titulo":"Estrutura industrial muito pesada","texto":"Os custos fixos industriais superam 50% do faturamento.","acao":"Revisar capacidade, estrutura fixa e volume necessário para diluição dos custos.","tituloOriginal":"Estrutura industrial muito pesada"},{"id":"CF_40_50","codigo":"FIXO_INDUSTRIAL","indicador":"Custos Fixos Industriais","nivel":"CRITICO","condicao":"> 40% até 50% do faturamento","titulo":"Custos fixos industriais elevados","texto":"A fábrica exige forte faturamento para sustentar sua estrutura fixa.","acao":"Avaliar ocupação, horas produtivas e itens fixos de maior peso.","tituloOriginal":"Custos fixos industriais elevados"},{"id":"CF_30_40","codigo":"FIXO_INDUSTRIAL","indicador":"Custos Fixos Industriais","nivel":"ATENCAO","condicao":"> 30% até 40% do faturamento","titulo":"Custos fixos industriais em atenção","texto":"Os custos fixos industriais representam entre 30% e 40% do faturamento.","acao":"Monitorar utilização da capacidade e crescimento da estrutura.","tituloOriginal":"Custos fixos industriais em atenção"},{"id":"CF_LE30","codigo":"FIXO_INDUSTRIAL","indicador":"Custos Fixos Industriais","nivel":"SAUDAVEL","condicao":"<= 30% do faturamento","titulo":"Custos fixos industriais controlados","texto":"Os custos fixos industriais representam até 30% do faturamento.","acao":"Manter acompanhamento de capacidade e produtividade.","tituloOriginal":"Custos fixos industriais controlados"},{"id":"MO_GT10","codigo":"SOBRA_MO","indicador":"Mão de Obra Não Alocada","nivel":"PRIORIDADE","condicao":"> 10% do faturamento","titulo":"Mão de obra não alocada muito elevada","texto":"Há valor relevante de mão de obra que não está sendo absorvido pelos centros de custo.","acao":"Revisar rateios, alocação dos funcionários e dimensionamento da equipe.","tituloOriginal":"Mão de obra não alocada muito elevada"},{"id":"MO_5_10","codigo":"SOBRA_MO","indicador":"Mão de Obra Não Alocada","nivel":"CRITICO","condicao":"> 5% até 10% do faturamento","titulo":"Mão de obra não alocada elevada","texto":"A sobra de mão de obra está reduzindo diretamente o resultado.","acao":"Revisar cadastro/rateio dos funcionários e utilização da equipe.","tituloOriginal":"Mão de obra não alocada elevada"},{"id":"MO_2_5","codigo":"SOBRA_MO","indicador":"Mão de Obra Não Alocada","nivel":"ATENCAO","condicao":"> 2% até 5% do faturamento","titulo":"Existe mão de obra não alocada","texto":"Parte do custo de pessoal não está sendo absorvida na estrutura dos centros de custo.","acao":"Validar percentuais de rateio e alocação dos funcionários.","tituloOriginal":"Existe mão de obra não alocada"},{"id":"MO_0_2","codigo":"SOBRA_MO","indicador":"Mão de Obra Não Alocada","nivel":"SAUDAVEL","condicao":"> 0% até 2% do faturamento","titulo":"Mão de obra bem alocada","texto":"A perda/sobra de mão de obra não alocada está baixa.","acao":"Manter os rateios e cadastros atualizados.","tituloOriginal":"Mão de obra bem alocada"},{"id":"MO_ZERO","codigo":"SOBRA_MO","indicador":"Mão de Obra Não Alocada","nivel":"SAUDAVEL","condicao":"= 0% do faturamento","titulo":"Mão de obra totalmente alocada","texto":"Não há custo de mão de obra pendente de alocação entre os centros de custo.","acao":"Manter a estrutura de alocação atualizada sempre que houver alterações na equipe.","tituloOriginal":"Mão de obra totalmente alocada"},{"id":"RS_NORESULT","codigo":"RETIRADA","indicador":"Retirada dos Sócios","nivel":"PRIORIDADE","condicao":"Resultado antes da retirada <= 0","titulo":"Retirada sem resultado operacional suficiente","texto":"A operação já não gera resultado positivo antes das retiradas.","acao":"Reavaliar temporariamente a retirada e atuar primeiro na recuperação do resultado operacional.","tituloOriginal":"Retirada sem resultado operacional suficiente"},{"id":"RS_GT100","codigo":"RETIRADA","indicador":"Retirada dos Sócios","nivel":"PRIORIDADE","condicao":"Retirada > 100% do resultado antes da retirada","titulo":"Retirada supera o resultado antes da retirada","texto":"A retirada consome mais do que o resultado disponível antes dela.","acao":"Readequar retirada ao resultado gerado pela operação.","tituloOriginal":"Retirada supera o resultado antes da retirada"},{"id":"RS_70_100","codigo":"RETIRADA","indicador":"Retirada dos Sócios","nivel":"CRITICO","condicao":"> 70% até 100% do resultado antes da retirada","titulo":"Retirada consome grande parte do resultado","texto":"Pouco resultado permanece na empresa após a retirada.","acao":"Avaliar redução da retirada ou aumento do resultado operacional.","tituloOriginal":"Retirada consome grande parte do resultado"},{"id":"RS_40_70","codigo":"RETIRADA","indicador":"Retirada dos Sócios","nivel":"ATENCAO","condicao":"> 40% até 70% do resultado antes da retirada","titulo":"Retirada com peso relevante","texto":"A retirada representa parcela importante do resultado antes dela.","acao":"Acompanhar o impacto da retirada sobre caixa, investimento e crescimento.","tituloOriginal":"Retirada com peso relevante"},{"id":"RS_0_40","codigo":"RETIRADA","indicador":"Retirada dos Sócios","nivel":"SAUDAVEL","condicao":"> 0% até 40% do resultado antes da retirada","titulo":"Retirada compatível com o resultado","texto":"A retirada não consome parcela excessiva do resultado gerado no período.","acao":"Manter a retirada alinhada à geração de resultado.","tituloOriginal":"Retirada compatível com o resultado"},{"id":"RS_ZERO","codigo":"RETIRADA","indicador":"Retirada dos Sócios","nivel":"SAUDAVEL","condicao":"Retirada = R$ 0,00","titulo":"Sem retirada dos sócios no período","texto":"Não há retirada dos sócios considerada neste período.","acao":"Nenhuma ação necessária para este indicador.","tituloOriginal":"Sem retirada dos sócios no período"},{"id":"ROI_NEG","codigo":"RETORNO_META","indicador":"Retorno sobre Investimento x Meta","nivel":"PRIORIDADE","condicao":"ROI < 0%","titulo":"Retorno sobre investimento negativo","texto":"O resultado atual não remunera o capital investido.","acao":"Priorizar recuperação do resultado antes de ampliar investimentos.","tituloOriginal":"Retorno sobre investimento negativo"},{"id":"ROI_LT25","codigo":"RETORNO_META","indicador":"Retorno sobre Investimento x Meta","nivel":"CRITICO","condicao":"Atingimento < 25% da meta","titulo":"Retorno muito abaixo da meta","texto":"Menos de 25% da meta de retorno configurada está sendo atingida.","acao":"Revisar resultado operacional, faturamento e estrutura necessária para alcançar a meta.","tituloOriginal":"Retorno muito abaixo da meta"},{"id":"ROI_25_100","codigo":"RETORNO_META","indicador":"Retorno sobre Investimento x Meta","nivel":"ATENCAO","condicao":"Atingimento de 25% a < 100% da meta","titulo":"Retorno abaixo da meta","texto":"A operação gera retorno positivo e atingiu pelo menos 25% da meta, porém ainda está abaixo do objetivo.","acao":"Quantificar o gap de resultado necessário para atingir a meta.","tituloOriginal":"Retorno abaixo da meta"},{"id":"ROI_GTE100","codigo":"RETORNO_META","indicador":"Retorno sobre Investimento x Meta","nivel":"SAUDAVEL","condicao":"Atingimento >= 100% da meta","titulo":"Meta de retorno atingida","texto":"O retorno mensal sobre o investimento alcança ou supera a meta configurada.","acao":"Preservar resultado e acompanhar a sustentabilidade nos próximos períodos.","tituloOriginal":"Meta de retorno atingida"},{"id":"EV_GT10","codigo":"EVOLUCAO","indicador":"Evolução entre Períodos","nivel":"CRITICO","condicao":"Pressão de gastos > 10 p.p.","titulo":"Gastos cresceram bem acima do faturamento","texto":"Contra o período anterior mais recente, os gastos avançaram mais rapidamente que a receita.","acao":"Abrir as linhas do DRE que mais cresceram e atacar os aumentos que não foram acompanhados por receita.","tituloOriginal":"Gastos cresceram bem acima do faturamento"},{"id":"EV_5_10","codigo":"EVOLUCAO","indicador":"Evolução entre Períodos","nivel":"ATENCAO","condicao":"Pressão de gastos > 5 p.p. até 10 p.p.","titulo":"Crescimento dos gastos acima da receita","texto":"A evolução do período mostra pressão de gastos sobre o faturamento.","acao":"Monitorar as linhas do DRE com maior crescimento antes que comprimam o resultado.","tituloOriginal":"Crescimento dos gastos acima da receita"},{"id":"EV_RESULT_DOWN","codigo":"EVOLUCAO","indicador":"Evolução entre Períodos","nivel":"ATENCAO","condicao":"Resultado caiu mais de 10% sem forte pressão de gastos","titulo":"Resultado piorou no comparativo","texto":"Mesmo sem forte descolamento entre gastos e faturamento, o resultado caiu em relação ao período anterior.","acao":"Identificar no DRE quais linhas explicam a redução do resultado.","tituloOriginal":"Resultado piorou no comparativo"},{"id":"EV_OK","codigo":"EVOLUCAO","indicador":"Evolução entre Períodos","nivel":"SAUDAVEL","condicao":"Demais casos","titulo":"Evolução econômica equilibrada","texto":"Contra o período anterior mais recente, os gastos não cresceram de forma significativamente superior ao faturamento.","acao":"Continuar acompanhando a evolução período a período.","tituloOriginal":"Evolução econômica equilibrada"}],"pontuacao":{"indicadores":[{"codigo":"MARGEM_LIQUIDA","nome":"Margem Líquida","peso":20.0},{"codigo":"DESP_OPER","nome":"Despesas Fixas Operacionais","peso":20.0},{"codigo":"RETORNO_META","nome":"Retorno x Meta","peso":20.0},{"codigo":"PONTO_EQUILIBRIO","nome":"Ponto de Equilíbrio Econômico","peso":15.0},{"codigo":"MARGEM_CONTRIB","nome":"Margem de Contribuição","peso":15.0},{"codigo":"FIXO_INDUSTRIAL","nome":"Custos Fixos Industriais","peso":10.0},{"codigo":"SOBRA_MO","nome":"M.O. não alocada","peso":10.0},{"codigo":"RETIRADA","nome":"Retirada dos Sócios","peso":10.0}],"fatores":{"SAUDAVEL":1.0,"ATENCAO":0.8,"CRITICO":0.4,"PRIORIDADE":0.0},"classificacoes":[{"min":0,"max":24,"label":"MUITO CRÍTICO"},{"min":25,"max":50,"label":"CRÍTICO"},{"min":51,"max":70,"label":"ATENÇÃO"},{"min":71,"max":85,"label":"SAUDÁVEL"},{"min":86,"max":100,"label":"EXCELENTE"}]}};
}

function garantirAbaComCabecalhos(ss, nome, cabecalhos) {
  let sheet = ss.getSheetByName(nome);
  if (!sheet) {
    sheet = ss.insertSheet(nome);
    sheet.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
    try { sheet.hideSheet(); } catch (e) {}
    return sheet;
  }

  const atual = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), cabecalhos.length)).getValues()[0]
    : [];

  let precisa = sheet.getLastColumn() < cabecalhos.length;
  if (!precisa) {
    for (let i = 0; i < cabecalhos.length; i++) {
      if (String(atual[i] || "").trim() !== cabecalhos[i]) {
        precisa = true;
        break;
      }
    }
  }
  if (precisa) {
    sheet.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
  }
  return sheet;
}

function gerarNovaVersaoDiagnosticoId(sheetVersao) {
  const data = sheetVersao.getDataRange().getValues();
  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const m = String(data[i][0] || "").match(/(\d+)$/);
    const n = m ? parseInt(m[1], 10) : 0;
    if (n > maxNum) maxNum = n;
  }
  return "DGV-" + String(maxNum + 1).padStart(4, "0");
}

function upsertAplicacaoDiagnostico(sheetAplicacao, clienteId, periodoId, versaoId) {
  const cli = String(clienteId || "").trim();
  const per = String(periodoId || "").trim();
  const ver = String(versaoId || "").trim();
  if (!cli || !per || !ver) return false;

  const data = sheetAplicacao.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (
      String(data[i][0] || "") === cli &&
      String(data[i][1] || "") === per
    ) {
      sheetAplicacao.getRange(i + 1, 1, 1, 4).setValues([[
        cli, per, ver, new Date()
      ]]);
      return true;
    }
  }

  sheetAplicacao.appendRow([cli, per, ver, new Date()]);
  return true;
}

function ultimaVersaoDiagnostico(ss) {
  const sheetVersao = ss.getSheetByName("TDIAGNOSTICO_VERSAO");
  if (!sheetVersao || sheetVersao.getLastRow() <= 1) return null;

  const data = sheetVersao.getDataRange().getValues();
  const row = data[data.length - 1];
  try {
    return {
      versaoId: String(row[0] || ""),
      criadoEm: row[1] || "",
      usuarioId: row[2] || "",
      config: JSON.parse(String(row[3] || "{}"))
    };
  } catch (e) {
    return null;
  }
}

function garantirEstruturaDiagnostico(ss) {
  const sheetVersao = garantirAbaComCabecalhos(
    ss,
    "TDIAGNOSTICO_VERSAO",
    ["TDIAGNOSTICO_VERSAO_ID","TDIAGNOSTICO_CRIADO_EM","TUSUARIO_ID","TDIAGNOSTICO_CONFIG_JSON"]
  );

  const sheetAplicacao = garantirAbaComCabecalhos(
    ss,
    "TDIAGNOSTICO_APLICACAO",
    ["TCLIENTE_ID","TPERIODO_ID","TDIAGNOSTICO_VERSAO_ID","TDIAGNOSTICO_APLICADO_EM"]
  );

  let ultima = ultimaVersaoDiagnostico(ss);
  if (!ultima) {
    const versaoId = gerarNovaVersaoDiagnosticoId(sheetVersao);
    const cfg = diagnosticoConfigPadrao();
    sheetVersao.appendRow([
      versaoId,
      new Date(),
      "SISTEMA",
      JSON.stringify(cfg)
    ]);
    ultima = {
      versaoId: versaoId,
      criadoEm: new Date(),
      usuarioId: "SISTEMA",
      config: cfg
    };
  }

  // Primeiro uso da V5.2.21: congela a configuração inicial em todos os
  // períodos já existentes e define o mesmo padrão para novos períodos.
  if (sheetAplicacao.getLastRow() <= 1) {
    const sCli = ss.getSheetByName("TCLIENTE");
    const sPer = ss.getSheetByName("TPERIODO");
    const clientes = sCli ? sCli.getDataRange().getValues() : [];
    const periodos = sPer ? sPer.getDataRange().getValues() : [];

    upsertAplicacaoDiagnostico(sheetAplicacao, "*", "NOVOS", ultima.versaoId);

    for (let i = 1; i < clientes.length; i++) {
      const cli = String(clientes[i][0] || "").trim();
      if (cli) upsertAplicacaoDiagnostico(sheetAplicacao, cli, "NOVOS", ultima.versaoId);
    }

    for (let i = 1; i < periodos.length; i++) {
      const cli = String(periodos[i][0] || "").trim();
      const per = String(periodos[i][1] || "").trim();
      if (cli && per) upsertAplicacaoDiagnostico(sheetAplicacao, cli, per, ultima.versaoId);
    }
  }

  SpreadsheetApp.flush();
  return {
    sheetVersao: sheetVersao,
    sheetAplicacao: sheetAplicacao
  };
}

function resolverVersaoDiagnostico(ss, clienteId, periodoId) {
  garantirEstruturaDiagnostico(ss);

  const sheetAplicacao = ss.getSheetByName("TDIAGNOSTICO_APLICACAO");
  const data = sheetAplicacao.getDataRange().getValues();
  const cli = String(clienteId || "").trim();
  const per = String(periodoId || "").trim();

  let versaoId = "";

  for (let i = 1; i < data.length; i++) {
    if (
      String(data[i][0] || "") === cli &&
      String(data[i][1] || "") === per
    ) {
      versaoId = String(data[i][2] || "");
      break;
    }
  }

  if (!versaoId) {
    for (let i = 1; i < data.length; i++) {
      if (
        String(data[i][0] || "") === cli &&
        String(data[i][1] || "") === "NOVOS"
      ) {
        versaoId = String(data[i][2] || "");
        break;
      }
    }
  }

  if (!versaoId) {
    for (let i = 1; i < data.length; i++) {
      if (
        String(data[i][0] || "") === "*" &&
        String(data[i][1] || "") === "NOVOS"
      ) {
        versaoId = String(data[i][2] || "");
        break;
      }
    }
  }

  const sheetVersao = ss.getSheetByName("TDIAGNOSTICO_VERSAO");
  const versoes = sheetVersao.getDataRange().getValues();

  if (versaoId) {
    for (let i = 1; i < versoes.length; i++) {
      if (String(versoes[i][0] || "") === versaoId) {
        try {
          return {
            versaoId: versaoId,
            config: JSON.parse(String(versoes[i][3] || "{}"))
          };
        } catch (e) {}
      }
    }
  }

  const ultima = ultimaVersaoDiagnostico(ss);
  return ultima
    ? { versaoId: ultima.versaoId, config: ultima.config }
    : { versaoId: "PADRAO", config: diagnosticoConfigPadrao() };
}

function atribuirDiagnosticoNovoPeriodo(ss, clienteId, periodoId) {
  const estrutura = garantirEstruturaDiagnostico(ss);
  const sheetAplicacao = estrutura.sheetAplicacao;
  const data = sheetAplicacao.getDataRange().getValues();
  const cli = String(clienteId || "").trim();

  let versaoId = "";

  // V5.2.22 — o padrão global é a fonte oficial para qualquer novo período.
  for (let i = 1; i < data.length; i++) {
    if (
      String(data[i][0] || "") === "*" &&
      String(data[i][1] || "") === "NOVOS"
    ) {
      versaoId = String(data[i][2] || "");
      break;
    }
  }

  // Compatibilidade com bases antigas que ainda não tenham o registro global.
  if (!versaoId) {
    for (let i = 1; i < data.length; i++) {
      if (
        String(data[i][0] || "") === cli &&
        String(data[i][1] || "") === "NOVOS"
      ) {
        versaoId = String(data[i][2] || "");
        break;
      }
    }
  }

  if (!versaoId) {
    const ultima = ultimaVersaoDiagnostico(ss);
    versaoId = ultima ? ultima.versaoId : "";
  }

  if (versaoId) {
    upsertAplicacaoDiagnostico(sheetAplicacao, cli, String(periodoId || ""), versaoId);
    SpreadsheetApp.flush();
  }
}

function aplicarConfigDiagnostico(ss, params) {
  const estrutura = garantirEstruturaDiagnostico(ss);
  const sheetVersao = estrutura.sheetVersao;
  const sheetAplicacao = estrutura.sheetAplicacao;

  if (!params.config || typeof params.config !== "object") {
    throw new Error("Configuração do diagnóstico não informada.");
  }

  const scope = String(params.scope || "").trim().toUpperCase();
  const scopesValidos = [
    "ALL_ALL","ALL_OPEN","ALL_NEW",
    "SELECTED_ALL","SELECTED_OPEN","SELECTED_NEW"
  ];
  if (scopesValidos.indexOf(scope) === -1) {
    throw new Error("Escopo de aplicação inválido.");
  }

  const versaoId = gerarNovaVersaoDiagnosticoId(sheetVersao);
  sheetVersao.appendRow([
    versaoId,
    new Date(),
    String(params.usuarioId || ""),
    JSON.stringify(params.config)
  ]);

  const sCli = ss.getSheetByName("TCLIENTE");
  const sPer = ss.getSheetByName("TPERIODO");
  const clientesData = sCli ? sCli.getDataRange().getValues() : [];
  const periodosData = sPer ? sPer.getDataRange().getValues() : [];

  let clientesAlvo = [];
  if (scope.indexOf("ALL_") === 0) {
    for (let i = 1; i < clientesData.length; i++) {
      const id = String(clientesData[i][0] || "").trim();
      if (id) clientesAlvo.push(id);
    }
  } else {
    clientesAlvo = Array.isArray(params.clientIds)
      ? params.clientIds.map(x => String(x || "").trim()).filter(Boolean)
      : [];
  }

  const setClientes = {};
  clientesAlvo.forEach(id => setClientes[id] = true);

  let periodosAtualizados = 0;
  let defaultsAtualizados = 0;

  // V5.2.22 — REGRA OFICIAL PARA O FUTURO:
  // qualquer configuração nova passa a valer automaticamente para TODOS
  // os novos clientes e TODOS os novos períodos, independentemente do
  // alcance escolhido para os períodos já existentes.
  if (upsertAplicacaoDiagnostico(sheetAplicacao, "*", "NOVOS", versaoId)) {
    defaultsAtualizados++;
  }
  for (let i = 1; i < clientesData.length; i++) {
    const cliPadrao = String(clientesData[i][0] || "").trim();
    if (!cliPadrao) continue;
    if (upsertAplicacaoDiagnostico(sheetAplicacao, cliPadrao, "NOVOS", versaoId)) {
      defaultsAtualizados++;
    }
  }

  // O escopo agora controla APENAS a retroatividade.
  if (!scope.endsWith("_NEW")) {
    const somenteAbertos = scope.endsWith("_OPEN");

    for (let i = 1; i < periodosData.length; i++) {
      const cli = String(periodosData[i][0] || "").trim();
      const per = String(periodosData[i][1] || "").trim();
      const status = String(periodosData[i][3] || "").trim().toUpperCase();

      if (!setClientes[cli] || !per) continue;
      if (somenteAbertos && status !== "ABERTO") continue;

      if (upsertAplicacaoDiagnostico(sheetAplicacao, cli, per, versaoId)) {
        periodosAtualizados++;
      }
    }
  }

  SpreadsheetApp.flush();

  return {
    versaoId: versaoId,
    periodosAtualizados: periodosAtualizados,
    defaultsAtualizados: defaultsAtualizados,
    clientesAlvo: clientesAlvo.length
  };
}


// ======================================================
// DO GET
// ======================================================

function converterSheetParaObjetos(sheet) {
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= 1 || lastCol <= 0) {
    return [];
  }

  const data = sheet
    .getRange(1, 1, lastRow, lastCol)
    .getValues();

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    const obj = {};

    headers.forEach((header, index) => {
      if (header) {
        obj[header] = row[index];
      }
    });

    return obj;
  });
}


function filtrarClientePeriodo(rows, clienteId, periodoId) {
  return rows.filter(row =>
    String(row.TCLIENTE_ID || "") === String(clienteId || "") &&
    String(row.TPERIODO_ID || "") === String(periodoId || "")
  );
}


function doGet(e) {
  /*
   * V5.2.6 — LEITURAS NÃO USAM MAIS ScriptLock.
   *
   * O backend anterior aplicava um lock global também em GET.
   * O frontend fazia várias leituras ao mesmo tempo e cada chamada
   * ficava esperando a anterior liberar o lock, chegando a dezenas
   * de segundos e deixando a interface presa em "Sincronizando".
   *
   * Lock continua existindo no doPost, onde realmente é necessário.
   */

  try {
    const actionParam =
      e && e.parameter && e.parameter.action
        ? String(e.parameter.action).trim().toUpperCase()
        : "TPERIODO";

    const ss = SpreadsheetApp.getActiveSpreadsheet();


    // ==================================================
    // DIAGNÓSTICO AUTOMÁTICO — MODELO MAIS RECENTE
    // ==================================================
    if (actionParam === "DIAGNOSTICO_MODELO") {
      garantirEstruturaDiagnostico(ss);
      const ultima = ultimaVersaoDiagnostico(ss);
      return jsonResponse({
        status: "success",
        versaoId: ultima ? ultima.versaoId : "PADRAO",
        config: ultima ? ultima.config : diagnosticoConfigPadrao()
      });
    }

    // ==================================================
    // DIAGNÓSTICO AUTOMÁTICO — CONFIGURAÇÃO DO PERÍODO
    // ==================================================
    if (actionParam === "DIAGNOSTICO_CONFIG") {
      const clienteId =
        e && e.parameter
          ? String(e.parameter.clienteId || "").trim()
          : "";
      const periodoId =
        e && e.parameter
          ? String(e.parameter.periodoId || "").trim()
          : "";

      if (!clienteId || !periodoId) {
        return jsonResponse({
          status: "error",
          message: "clienteId e periodoId são obrigatórios."
        });
      }

      const diag = resolverVersaoDiagnostico(ss, clienteId, periodoId);
      return jsonResponse({
        status: "success",
        clienteId: clienteId,
        periodoId: periodoId,
        versaoId: diag.versaoId,
        config: diag.config
      });
    }


    // ==================================================
    // PACOTE COMPLETO DO PERÍODO
    // ==================================================
    if (actionParam === "PERIODO_BUNDLE") {

      const clienteId =
        e && e.parameter
          ? String(e.parameter.clienteId || "").trim()
          : "";

      const periodoId =
        e && e.parameter
          ? String(e.parameter.periodoId || "").trim()
          : "";

      if (!clienteId || !periodoId) {
        return jsonResponse({
          status: "error",
          message: "clienteId e periodoId são obrigatórios."
        });
      }

      const nomes = [
        "TINVESTIMENTOS",
        "TCENTRO_CUSTO",
        "TRECURSO",
        "TBENEFICIOS",
        "TFUNCIONARIO",
        "TPLANO_CONTAS"
      ];

      const pacote = {};

      nomes.forEach(nome => {
        const sheet = ss.getSheetByName(nome);
        const rows = converterSheetParaObjetos(sheet);

        pacote[nome] =
          filtrarClientePeriodo(
            rows,
            clienteId,
            periodoId
          );
      });

      const diag = resolverVersaoDiagnostico(
        ss,
        clienteId,
        periodoId
      );

      pacote.DIAGNOSTICO_CONFIG = {
        versaoId: diag.versaoId,
        config: diag.config
      };

      pacote.FINALIZACAO_ANALISE = obterFinalizacaoPeriodo(
        ss,
        clienteId,
        periodoId
      );

      return jsonResponse({
        status: "success",
        clienteId: clienteId,
        periodoId: periodoId,
        data: pacote
      });
    }


    // ==================================================
    // LEITURA NORMAL DE UMA ABA
    // ==================================================
    const sheet = ss.getSheetByName(actionParam);

    if (!sheet) {
      return jsonResponse({
        status: "error",
        message: "Aba não encontrada: " + actionParam
      });
    }

    return jsonResponse(
      converterSheetParaObjetos(sheet)
    );

  } catch (err) {

    return jsonResponse({
      status: "error",
      message: err.toString()
    });
  }
}

// ======================================================
// NORMALIZAÇÃO TCENTRO_CUSTO
// ======================================================

function normalizarCentroCusto(data) {

  if (!Array.isArray(data)) {
    throw new Error("Dados do Centro de Custo inválidos.");
  }

  /*
   * ESTRUTURA REAL TCENTRO_CUSTO — V5.2.1
   *
   * índice  coluna
   * 0       A  TCLIENTE_ID
   * 1       B  TPERIODO_ID
   * 2       C  TCENTRO_CUSTO_ID
   * 3       D  TCENTRO_CUSTO_NOME
   * 4       E  TCENTRO_CUSTO_TIPO
   * 5       F  TCENTRO_CUSTO_QTDE_RECURSOS
   * 6       G  TCENTRO_CUSTO_AREA
   * 7       H  TCENTRO_CUSTO_CUSTO_FIXO_DIRETO
   * 8       I  TCENTRO_CUSTO_PRODUTIVIDADE
   * 9       J  TCENTRO_CUSTO_TIPO_RATEIO_HORAS
   * 10      K  TCENTRO_CUSTO_CONSIDERAR_MINIMO
   * 11      L  TCENTRO_CUSTO_CUSTO_MENSAL
   * 12      M  TCENTRO_CUSTO_CUSTO_FUNCIONARIO
   * 13      N  TCENTRO_CUSTO_HORAS
   * 14      O  TCENTRO_CUSTO_CUSTO_PLANO_CONTAS
   * 15      P  TCENTRO_CUSTO_PREDIO
   * 16      Q  TCENTRO_CUSTO_INDIRETOS
   */

  while (data.length < 17) {
    data.push(0);
  }

  const tipo = String(data[4] || "").trim().toUpperCase();
  let rateio = String(data[9] || "").trim().toUpperCase();
  const considerarMinimo = valorSim(data[10]);

  // Quantidade de recursos é calculada pelo backend.
  data[5] = numeroSeguro(data[5], 0);

  // Regra prioritária do mínimo para produtivo direto.
  if (considerarMinimo && tipo === "PRODUTIVO DIRETO") {
    data[10] = "SIM";
    data[8] = 100;
    data[9] = "MINIMO";
    return data;
  }

  data[10] = "NAO";

  // V5.2.2:
  // FUNCIONARIO define somente a base das HORAS do Centro de Custo.
  // Custo Fixo Direto e Produtividade continuam válidos e NÃO são zerados.
  data[7] = numeroSeguro(data[7], 0);
  data[8] = numeroSeguro(data[8], 100);

  return data;
}


// ======================================================
// NORMALIZAÇÃO TPERIODO
// ======================================================

function normalizarPeriodo(data) {

  if (!Array.isArray(data)) {
    throw new Error(
      "Dados do Período inválidos."
    );
  }

  /*
   * ESTRUTURA TPERIODO V5.1
   *
   * 0  TCLIENTE_ID
   * 1  TPERIODO_ID
   * 2  TPERIODO_NOME
   * 3  TPERIODO_STATUS
   * 4  TPERIODO_ATUAL
   * 5  TPERIODO_FATURAMENTO
   * 6  TPERIODO_ALIQUOTA
   * 7  TPERIODO_PREDIO
   * 8  TPERIODO_RENTABILIDADE
   * 9  TPERIODO_RETIRADA
   * 10 TPERIODO_DESCONSIDERAR_DEPRECIACAO
   */

  while (data.length < 11) {
    data.push("");
  }

  data[10] = valorSim(data[10])
    ? "SIM"
    : "NAO";

  return data;
}



// ======================================================
// V5.2.28 — FINALIZAÇÃO DA ANÁLISE + ENVIO POR E-MAIL
// ======================================================

function garantirEstruturaFinalizacao(ss) {
  return garantirAbaComCabecalhos(
    ss,
    "TPERIODO_FINALIZACAO",
    [
      "TCLIENTE_ID",
      "TPERIODO_ID",
      "TFINALIZACAO_CONCLUIDO",
      "TFINALIZACAO_DATA",
      "TUSUARIO_ID",
      "TUSUARIO_EMAIL",
      "TFINALIZACAO_ULTIMO_ENVIO"
    ]
  );
}

function obterFinalizacaoPeriodo(ss, clienteId, periodoId) {
  const sh = garantirEstruturaFinalizacao(ss);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (
      String(data[i][0] || "") === String(clienteId || "") &&
      String(data[i][1] || "") === String(periodoId || "")
    ) {
      return {
        TCLIENTE_ID: data[i][0] || "",
        TPERIODO_ID: data[i][1] || "",
        TFINALIZACAO_CONCLUIDO: data[i][2] || "NAO",
        TFINALIZACAO_DATA: data[i][3] || "",
        TUSUARIO_ID: data[i][4] || "",
        TUSUARIO_EMAIL: data[i][5] || "",
        TFINALIZACAO_ULTIMO_ENVIO: data[i][6] || ""
      };
    }
  }
  return {
    TCLIENTE_ID: String(clienteId || ""),
    TPERIODO_ID: String(periodoId || ""),
    TFINALIZACAO_CONCLUIDO: "NAO",
    TFINALIZACAO_DATA: "",
    TUSUARIO_ID: "",
    TUSUARIO_EMAIL: "",
    TFINALIZACAO_ULTIMO_ENVIO: ""
  };
}

function registrarFinalizacaoPeriodo(ss, params) {
  const sh = garantirEstruturaFinalizacao(ss);
  const cli = String(params.clienteId || "").trim();
  const per = String(params.periodoId || "").trim();
  if (!cli || !per) throw new Error("Cliente e período são obrigatórios para concluir a análise.");
  const data = sh.getDataRange().getValues();
  const agora = new Date();
  const row = [
    cli,
    per,
    "SIM",
    agora,
    String(params.usuarioId || "").trim(),
    String(params.usuarioEmail || "").trim().toLowerCase(),
    agora
  ];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || "") === cli && String(data[i][1] || "") === per) {
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sh.appendRow(row);
}

function atualizarUltimoEnvioFinalizacao(ss, params) {
  const sh = garantirEstruturaFinalizacao(ss);
  const cli = String(params.clienteId || "").trim();
  const per = String(params.periodoId || "").trim();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || "") === cli && String(data[i][1] || "") === per) {
      sh.getRange(i + 1, 7).setValue(new Date());
      return;
    }
  }
}

function htmlSeguroEmail_(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function listaEmailsSegura_(valor) {
  const arr = Array.isArray(valor) ? valor : String(valor || "").split(/[;,\n]+/);
  const out = [];
  arr.forEach(function(v) {
    const e = String(v || "").trim().toLowerCase();
    if (!e) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    if (out.indexOf(e) === -1) out.push(e);
  });
  return out;
}

function nomeClientePeriodo_(ss, clienteId, periodoId) {
  let cliente = String(clienteId || "");
  let periodo = String(periodoId || "");
  const shCli = ss.getSheetByName("TCLIENTE");
  if (shCli) {
    const d = converterSheetParaObjetos(shCli);
    const c = d.find(function(x){ return String(x.TCLIENTE_ID || "") === String(clienteId || ""); });
    if (c) cliente = String(c.TCLIENTE_NOME || c.TCLIENTE_RAZAO_SOCIAL || cliente);
  }
  const shPer = ss.getSheetByName("TPERIODO");
  if (shPer) {
    const d = converterSheetParaObjetos(shPer);
    const p = d.find(function(x){ return String(x.TCLIENTE_ID || "") === String(clienteId || "") && String(x.TPERIODO_ID || "") === String(periodoId || ""); });
    if (p) periodo = String(p.TPERIODO_NOME || periodo);
  }
  return { cliente: cliente, periodo: periodo };
}

function enviarAnaliseEmail_(ss, params) {
  const tipo = String(params.tipo || "FINALIZACAO").trim().toUpperCase();
  const nomes = nomeClientePeriodo_(ss, params.clienteId, params.periodoId);
  const emailUsuario = String(params.usuarioEmail || "").trim().toLowerCase();

  const to = ["richard@consultoriarf.net"];
  if (tipo === "ESTUDO_CASO" || valorSim(params.enviarProprio)) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailUsuario) && to.indexOf(emailUsuario) === -1) to.push(emailUsuario);
  }

  let cc = listaEmailsSegura_(params.ccEmails).concat(listaEmailsSegura_(params.manualEmails));
  cc = cc.filter(function(e, i, a){ return a.indexOf(e) === i && to.indexOf(e) === -1; });

  let b64 = String(params.pdfBase64 || "").trim();
  if (b64.indexOf(",") >= 0) b64 = b64.split(",").pop();
  if (!b64) throw new Error("PDF não recebido para envio.");
  const bytes = Utilities.base64Decode(b64);
  const filename = String(params.pdfFilename || "CONSULTORIA_RF_ANALISE.pdf").replace(/[^a-zA-Z0-9._-]+/g, "_");
  const pdfBlob = Utilities.newBlob(bytes, "application/pdf", filename);

  const alteracoes = Array.isArray(params.alteracoes) ? params.alteracoes : [];
  let alteracoesHtml = "";
  if (tipo === "ESTUDO_CASO") {
    const linhas = alteracoes.length
      ? alteracoes.map(function(a){
          return "<tr><td style='padding:7px;border:1px solid #ddd'>" + htmlSeguroEmail_(a.item || a.campo || "Alteração") + "</td>" +
                 "<td style='padding:7px;border:1px solid #ddd'>" + htmlSeguroEmail_(a.original || "-") + "</td>" +
                 "<td style='padding:7px;border:1px solid #ddd'><strong>" + htmlSeguroEmail_(a.simulado || "-") + "</strong></td></tr>";
        }).join("")
      : "<tr><td colspan='3' style='padding:7px;border:1px solid #ddd'>Nenhuma alteração identificada.</td></tr>";
    alteracoesHtml = "<h3 style='margin:20px 0 8px'>Alterações simuladas</h3><table style='border-collapse:collapse;width:100%;font-size:13px'><thead><tr><th style='padding:7px;border:1px solid #ddd;text-align:left'>Item</th><th style='padding:7px;border:1px solid #ddd;text-align:left'>Original</th><th style='padding:7px;border:1px solid #ddd;text-align:left'>Simulado</th></tr></thead><tbody>" + linhas + "</tbody></table>";
  }

  const assunto = tipo === "ESTUDO_CASO"
    ? "CONSULTORIA.RF | Estudo de Caso | " + nomes.cliente + " | " + nomes.periodo
    : "CONSULTORIA.RF | Análise concluída | " + nomes.cliente + " | " + nomes.periodo;

  const titulo = tipo === "ESTUDO_CASO" ? "Estudo de Caso — Simulação" : "Cadastro concluído — Análise gerencial";
  const observacao = tipo === "ESTUDO_CASO"
    ? "Este relatório representa uma simulação temporária. As alterações do estudo não foram gravadas nos cadastros oficiais."
    : "O cliente informou que concluiu os cadastros deste período e enviou a análise gerencial para revisão.";

  const htmlBody = "<div style='font-family:Arial,sans-serif;color:#1f2937;line-height:1.5'>" +
    "<h2 style='margin-bottom:6px'>" + htmlSeguroEmail_(titulo) + "</h2>" +
    "<p><strong>Empresa:</strong> " + htmlSeguroEmail_(nomes.cliente) + "<br>" +
    "<strong>Período:</strong> " + htmlSeguroEmail_(nomes.periodo) + "<br>" +
    "<strong>Enviado por:</strong> " + htmlSeguroEmail_(params.usuarioNome || params.usuarioEmail || "-") + "</p>" +
    "<p>" + htmlSeguroEmail_(observacao) + "</p>" + alteracoesHtml +
    "<p style='margin-top:20px;color:#6b7280;font-size:12px'>PDF da análise anexado automaticamente pela plataforma CONSULTORIA.RF.</p></div>";

  MailApp.sendEmail({
    to: to.join(","),
    cc: cc.join(","),
    subject: assunto,
    body: titulo + "\nEmpresa: " + nomes.cliente + "\nPeríodo: " + nomes.periodo + "\n\n" + observacao,
    htmlBody: htmlBody,
    attachments: [pdfBlob],
    name: "CONSULTORIA.RF"
  });

  if (tipo === "FINALIZACAO") registrarFinalizacaoPeriodo(ss, params);
  else atualizarUltimoEnvioFinalizacao(ss, params);

  return { to: to, cc: cc, tipo: tipo };
}

// ======================================================
// DO POST
// ======================================================

function doPost(e) {

  const lock = LockService.getScriptLock();
  let hasLock = false;

  try {

    hasLock = lock.tryLock(30000);

    if (!hasLock) {
      throw new Error(
        "Servidor ocupado ao tentar salvar. Tente novamente."
      );
    }

    if (
      !e ||
      !e.postData ||
      !e.postData.contents
    ) {
      throw new Error(
        "Nenhum conteúdo recebido no POST."
      );
    }

    const params = JSON.parse(
      e.postData.contents
    );

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const nomeSheet = String(
      params.sheet || ""
    )
      .trim()
      .toUpperCase();

    const action = String(
      params.action || ""
    )
      .trim()
      .toUpperCase();


    // ==================================================
    // CLONAR PERÍODO
    // ==================================================

    if (action === "CLONE_PERIOD") {

      return clonarEstruturaPeriodo(
        ss,
        params.clienteId,
        params.periodoOrigemId,
        params.novoNomePeriodo
      );
    }


    // ==================================================
    // APLICAR CONFIGURAÇÃO DO DIAGNÓSTICO
    // ==================================================

    if (action === "APLICAR_DIAGNOSTICO_CONFIG") {
      const resultado = aplicarConfigDiagnostico(ss, params);
      return jsonResponse({
        status: "success",
        versaoId: resultado.versaoId,
        periodosAtualizados: resultado.periodosAtualizados,
        defaultsAtualizados: resultado.defaultsAtualizados,
        clientesAlvo: resultado.clientesAlvo
      });
    }

    // ==================================================
    // V5.2.28 — CONCLUSÃO / ESTUDO DE CASO POR E-MAIL
    // ==================================================
    if (action === "ENVIAR_ANALISE_EMAIL") {
      const resultado = enviarAnaliseEmail_(ss, params);
      return jsonResponse({
        status: "success",
        tipo: resultado.tipo,
        to: resultado.to,
        cc: resultado.cc
      });
    }


    // ==================================================
    // TRAVA DE PERÍODO FECHADO
    // ==================================================

    if (
      nomeSheet !== "TCLIENTE" &&
      nomeSheet !== "TUSUARIO"
    ) {

      const perIdVerificar =
        params.periodoId ||
        (
          params.data &&
          params.data[1]
        ) ||
        "";

      const cliIdVerificar =
        params.clienteId ||
        (
          params.data &&
          params.data[0]
        ) ||
        "";

      if (
        perIdVerificar &&
        isPeriodoFechado(
          ss,
          cliIdVerificar,
          perIdVerificar
        ) &&
        action !== "UPDATE_STATUS_PERIODO" &&
        action !== "ENVIAR_ANALISE_EMAIL"
      ) {
        throw new Error(
          "🔒 PERÍODO FECHADO: Não é permitido criar, editar ou excluir registros neste período."
        );
      }
    }


    // ==================================================
    // CREATE_BATCH
    // ==================================================

    if (action === "CREATE_BATCH") {

      const sheetBatch =
        ss.getSheetByName(params.sheet);

      if (!sheetBatch) {
        throw new Error(
          "Aba não encontrada: " +
          params.sheet
        );
      }

      if (
        !Array.isArray(params.batchData) ||
        params.batchData.length === 0
      ) {
        throw new Error(
          "Nenhum dado válido para gravação em lote."
        );
      }

      let prefixo = "REC-";
      let colIndex = 3;

      if (nomeSheet === "TCENTRO_CUSTO") {
        prefixo = "CC-";
        colIndex = 2;
      } else if (nomeSheet === "TBENEFICIOS") {
        prefixo = "BEN-";
        colIndex = 2;
      } else if (nomeSheet === "TFUNCIONARIO") {
        prefixo = "FUNC-";
        colIndex = 3;
      } else if (nomeSheet === "TPLANO_CONTAS") {
        prefixo = "PLC-";
        colIndex = 3;
      }

      const dataExistente =
        sheetBatch
          .getDataRange()
          .getValues();

      let maxNum = 0;

      if (dataExistente.length > 1) {

        for (
          let i = 1;
          i < dataExistente.length;
          i++
        ) {

          const idAtual = String(
            dataExistente[i][colIndex] || ""
          );

          const num = parseInt(
            idAtual.replace(/\D/g, ""),
            10
          );

          if (
            !isNaN(num) &&
            num > maxNum
          ) {
            maxNum = num;
          }
        }
      }

      const linhasParaInserir =
        params.batchData.map(
          (linhaOriginal, idx) => {

            const linha =
              Array.from(linhaOriginal);

            const proximoNum =
              maxNum + idx + 1;

            const novoID =
              prefixo +
              String(proximoNum)
                .padStart(3, "0");

            linha[colIndex] = novoID;

            if (
              nomeSheet ===
              "TCENTRO_CUSTO"
            ) {
              return normalizarCentroCusto(
                linha
              );
            }

            return linha;
          }
        );

      sheetBatch
        .getRange(
          sheetBatch.getLastRow() + 1,
          1,
          linhasParaInserir.length,
          linhasParaInserir[0].length
        )
        .setValues(
          linhasParaInserir
        );

      SpreadsheetApp.flush();

      recalcularTodosCentrosDeCusto(
        ss,
        params.clienteId,
        params.periodoId
      );

      SpreadsheetApp.flush();

      return jsonResponse({
        status: "success",
        count: linhasParaInserir.length
      });
    }



    // ==================================================
    // V5.2.24 — BATCH_MUTATE
    // CREATE + UPDATE + DELETE EM UMA ÚNICA EFETIVAÇÃO
    // ==================================================

    if (action === "BATCH_MUTATE") {

      const sheetBatch =
        ss.getSheetByName(params.sheet);

      if (!sheetBatch) {
        throw new Error(
          "Aba não encontrada: " +
          params.sheet
        );
      }

      const creates =
        Array.isArray(params.creates)
          ? params.creates
          : [];

      const updates =
        Array.isArray(params.updates)
          ? params.updates
          : [];

      const deletes =
        Array.isArray(params.deletes)
          ? params.deletes
          : [];

      if (
        deletes.length > 0 &&
        String(params.confirmDelete || "")
          .trim()
          .toUpperCase() !== "SIM"
      ) {
        throw new Error(
          "Exclusão bloqueada: confirmação textual SIM é obrigatória."
        );
      }

      if (
        creates.length === 0 &&
        updates.length === 0 &&
        deletes.length === 0
      ) {
        throw new Error(
          "Nenhuma alteração recebida para efetivação."
        );
      }

      // ----------------------------------------------
      // TFUNCIONARIO — guarda também quais benefícios
      // foram selecionados na linha (coluna N).
      // ----------------------------------------------
      if (nomeSheet === "TFUNCIONARIO") {
        const headerAtual =
          sheetBatch
            .getRange(
              1,
              1,
              1,
              Math.max(sheetBatch.getLastColumn(), 14)
            )
            .getValues()[0];

        const nomeBeneficios =
          "TFUNCIONARIO_BENEFICIOS_IDS";

        if (
          String(headerAtual[13] || "")
            .trim()
            .toUpperCase() !==
          nomeBeneficios
        ) {
          // A estrutura oficial tinha A:M.
          // Se N já estiver ocupada por outro campo,
          // insere uma nova coluna N para não sobrescrever.
          if (
            headerAtual[13] &&
            String(headerAtual[13]).trim() !== ""
          ) {
            sheetBatch.insertColumnAfter(13);
          }

          sheetBatch
            .getRange(1, 14)
            .setValue(nomeBeneficios);
        }
      }

      const mapaBatch = {
        TCENTRO_CUSTO: {
          idHeader: "TCENTRO_CUSTO_ID",
          idIndex: 2,
          prefixo: "CC-"
        },
        TRECURSO: {
          idHeader: "TRECURSO_ID",
          idIndex: 3,
          prefixo: "REC-"
        },
        TBENEFICIOS: {
          idHeader: "TBENEFICIO_ID",
          idIndex: 2,
          prefixo: "BEN-"
        },
        TFUNCIONARIO: {
          idHeader: "TFUNCIONARIO_ID",
          idIndex: 3,
          prefixo: "FUNC-"
        },
        TPLANO_CONTAS: {
          idHeader: "TPLANO_CONTA_ID",
          idIndex: 3,
          prefixo: "PLC-"
        }
      };

      const cfgBatch =
        mapaBatch[nomeSheet];

      if (!cfgBatch) {
        throw new Error(
          "BATCH_MUTATE não configurado para a aba " +
          params.sheet
        );
      }

      const clienteTarget =
        String(params.clienteId || "")
          .trim();

      const periodoTarget =
        String(params.periodoId || "")
          .trim();

      if (!clienteTarget || !periodoTarget) {
        throw new Error(
          "clienteId e periodoId são obrigatórios para efetivação em lote."
        );
      }

      let dadosBatch =
        sheetBatch
          .getDataRange()
          .getValues();

      const acharLinhaBatch =
        function(idBusca) {
          const idUpper =
            String(idBusca || "")
              .trim()
              .toUpperCase();

          for (
            let i = 1;
            i < dadosBatch.length;
            i++
          ) {
            if (
              String(dadosBatch[i][0] || "") === clienteTarget &&
              String(dadosBatch[i][1] || "") === periodoTarget &&
              String(dadosBatch[i][cfgBatch.idIndex] || "")
                .trim()
                .toUpperCase() === idUpper
            ) {
              return i + 1;
            }
          }

          return -1;
        };

      // ----------------------------------------------
      // 1. UPDATES — antes das exclusões para preservar
      // os números das linhas originais.
      // ----------------------------------------------
      let atualizados = 0;

      updates.forEach(function(item) {
        if (
          !item ||
          !item.id ||
          !Array.isArray(item.data)
        ) {
          throw new Error(
            "UPDATE em lote inválido em " +
            params.sheet
          );
        }

        const linha =
          acharLinhaBatch(item.id);

        if (linha === -1) {
          throw new Error(
            "Registro não encontrado para atualização em lote: " +
            item.id
          );
        }

        let novaLinha =
          Array.from(item.data);

        if (nomeSheet === "TCENTRO_CUSTO") {
          // Para UPDATE da grade recebemos apenas os campos
          // cadastrais A:K. Não devemos zerar L:Q.
          const existente =
            sheetBatch
              .getRange(
                linha,
                1,
                1,
                Math.max(sheetBatch.getLastColumn(), 17)
              )
              .getValues()[0];

          const base =
            Array.from(existente);

          for (
            let c = 0;
            c < novaLinha.length;
            c++
          ) {
            base[c] = novaLinha[c];
          }

          novaLinha =
            normalizarCentroCusto(base);
        }

        sheetBatch
          .getRange(
            linha,
            1,
            1,
            novaLinha.length
          )
          .setValues([
            novaLinha
          ]);

        atualizados++;
      });

      SpreadsheetApp.flush();

      // Atualiza a fotografia usada para localizar exclusões.
      dadosBatch =
        sheetBatch
          .getDataRange()
          .getValues();

      // ----------------------------------------------
      // V5.2.24 — PROTEÇÃO DE EXCLUSÃO DE CENTRO DE CUSTO
      // Nunca deixa Recursos, Funcionários ou Contas órfãos.
      // Rateios percentuais precisam ser revisados explicitamente.
      // ----------------------------------------------
      if (
        nomeSheet === "TCENTRO_CUSTO" &&
        deletes.length > 0
      ) {
        const ccTransfers =
          Array.isArray(params.ccTransfers)
            ? params.ccTransfers
            : [];

        const transferMap = {};
        ccTransfers.forEach(function(x) {
          if (x && x.fromId && x.toId) {
            transferMap[String(x.fromId)] = String(x.toId);
          }
        });

        const deleteSet = {};
        deletes.forEach(function(id) {
          deleteSet[String(id)] = true;
        });

        const shRec = ss.getSheetByName("TRECURSO");
        const shFunc = ss.getSheetByName("TFUNCIONARIO");
        const shPlano = ss.getSheetByName("TPLANO_CONTAS");
        const dataRec = shRec ? shRec.getDataRange().getValues() : [];
        const dataFunc = shFunc ? shFunc.getDataRange().getValues() : [];
        const dataPlano = shPlano ? shPlano.getDataRange().getValues() : [];
        let recMudou = false;
        let funcMudou = false;
        let planoMudou = false;

        function parseRateioSeguro_(raw) {
          let t = String(raw || "").trim();
          if (!t) return [];
          try {
            if (t.startsWith('"') && t.endsWith('"')) {
              t = t.substring(1, t.length - 1);
            }
            t = t.replace(/""/g, '"').replace(/;/g, ",");
            const a = JSON.parse(t);
            return Array.isArray(a) ? a : [];
          } catch (e) {
            return [];
          }
        }

        function ccExisteDestino_(id) {
          if (!id || deleteSet[id]) return false;
          for (let i = 1; i < dadosBatch.length; i++) {
            if (
              String(dadosBatch[i][0] || "") === clienteTarget &&
              String(dadosBatch[i][1] || "") === periodoTarget &&
              String(dadosBatch[i][2] || "") === String(id)
            ) return true;
          }
          return false;
        }

        deletes.forEach(function(ccIdRaw) {
          const ccId = String(ccIdRaw || "");
          const linhaCC = acharLinhaBatch(ccId);
          if (linhaCC === -1) {
            throw new Error("Centro de Custo não encontrado: " + ccId);
          }

          const ccPersistido = sheetBatch
            .getRange(linhaCC, 1, 1, Math.max(sheetBatch.getLastColumn(), 17))
            .getValues()[0];

          const custoFixoProprio = numeroSeguro(ccPersistido[7], 0);
          if (Math.abs(custoFixoProprio) > 0.0001) {
            throw new Error(
              "Exclusão bloqueada para " + ccId +
              ": existe Custo Fixo Direto próprio de " + custoFixoProprio +
              ". Zere/transfira o valor e efetive antes de excluir."
            );
          }

          let qtdRec = 0;
          let qtdFuncDireto = 0;
          let qtdPlanoExclusivo = 0;

          for (let i = 1; i < dataFunc.length; i++) {
            if (
              String(dataFunc[i][0] || "") !== clienteTarget ||
              String(dataFunc[i][1] || "") !== periodoTarget
            ) continue;
            const isRateio = String(dataFunc[i][10] || "").trim().toUpperCase() === "SIM";
            const info = String(dataFunc[i][2] || "").trim();
            if (isRateio) {
              const arr = parseRateioSeguro_(info);
              const usaCC = arr.some(function(item) {
                return String(item && (item.id || item.ID) || "") === ccId;
              });
              if (usaCC) {
                throw new Error(
                  "Exclusão bloqueada para " + ccId +
                  ": funcionário com rateio percentual ainda utiliza este CC. Revise e efetive o rateio primeiro."
                );
              }
            } else if (info === ccId) {
              qtdFuncDireto++;
            }
          }

          for (let i = 1; i < dataPlano.length; i++) {
            if (
              String(dataPlano[i][0] || "") !== clienteTarget ||
              String(dataPlano[i][1] || "") !== periodoTarget
            ) continue;
            const criterio = String(dataPlano[i][5] || "").trim().toUpperCase();
            const info = String(dataPlano[i][2] || "").trim();
            if (criterio === "SELETIVO_PERCENTUAL") {
              const arr = parseRateioSeguro_(info);
              const usaCC = arr.some(function(item) {
                return String(item && (item.id || item.ID) || "") === ccId;
              });
              if (usaCC) {
                throw new Error(
                  "Exclusão bloqueada para " + ccId +
                  ": conta do Plano de Contas com rateio seletivo ainda utiliza este CC. Revise e efetive o rateio primeiro."
                );
              }
            } else if (criterio === "EXCLUSIVO" && info === ccId) {
              qtdPlanoExclusivo++;
            }
          }

          for (let i = 1; i < dataRec.length; i++) {
            if (
              String(dataRec[i][0] || "") === clienteTarget &&
              String(dataRec[i][1] || "") === periodoTarget &&
              String(dataRec[i][2] || "") === ccId
            ) qtdRec++;
          }

          const qtdDiretos = qtdRec + qtdFuncDireto + qtdPlanoExclusivo;
          const destino = String(transferMap[ccId] || "");
          if (qtdDiretos > 0 && !ccExisteDestino_(destino)) {
            throw new Error(
              "Exclusão bloqueada para " + ccId +
              ": existem " + qtdDiretos +
              " vínculo(s) diretos. Informe um Centro de Custo destino válido."
            );
          }

          if (qtdDiretos > 0) {
            for (let i = 1; i < dataRec.length; i++) {
              if (
                String(dataRec[i][0] || "") === clienteTarget &&
                String(dataRec[i][1] || "") === periodoTarget &&
                String(dataRec[i][2] || "") === ccId
              ) {
                dataRec[i][2] = destino;
                recMudou = true;
              }
            }
            for (let i = 1; i < dataFunc.length; i++) {
              if (
                String(dataFunc[i][0] || "") === clienteTarget &&
                String(dataFunc[i][1] || "") === periodoTarget &&
                String(dataFunc[i][10] || "").trim().toUpperCase() !== "SIM" &&
                String(dataFunc[i][2] || "") === ccId
              ) {
                dataFunc[i][2] = destino;
                funcMudou = true;
              }
            }
            for (let i = 1; i < dataPlano.length; i++) {
              if (
                String(dataPlano[i][0] || "") === clienteTarget &&
                String(dataPlano[i][1] || "") === periodoTarget &&
                String(dataPlano[i][5] || "").trim().toUpperCase() === "EXCLUSIVO" &&
                String(dataPlano[i][2] || "") === ccId
              ) {
                dataPlano[i][2] = destino;
                planoMudou = true;
              }
            }
          }
        });

        if (recMudou && shRec && dataRec.length) {
          shRec.getRange(1, 1, dataRec.length, dataRec[0].length).setValues(dataRec);
        }
        if (funcMudou && shFunc && dataFunc.length) {
          shFunc.getRange(1, 1, dataFunc.length, dataFunc[0].length).setValues(dataFunc);
        }
        if (planoMudou && shPlano && dataPlano.length) {
          shPlano.getRange(1, 1, dataPlano.length, dataPlano[0].length).setValues(dataPlano);
        }
        SpreadsheetApp.flush();
      }

      // ----------------------------------------------
      // 2. DELETE — de baixo para cima.
      // ----------------------------------------------
      const linhasExcluir = [];

      deletes.forEach(function(id) {
        const linha =
          acharLinhaBatch(id);

        if (linha === -1) {
          throw new Error(
            "Registro não encontrado para exclusão em lote: " +
            id
          );
        }

        linhasExcluir.push(linha);
      });

      linhasExcluir
        .sort(function(a, b) {
          return b - a;
        })
        .forEach(function(linha) {
          sheetBatch.deleteRow(linha);
        });

      // ----------------------------------------------
      // 3. CREATES — IDs sequenciais únicos.
      // ----------------------------------------------
      const dadosDepoisDelete =
        sheetBatch
          .getDataRange()
          .getValues();

      let maxNum = 0;

      for (
        let i = 1;
        i < dadosDepoisDelete.length;
        i++
      ) {
        const idAtual =
          String(
            dadosDepoisDelete[i][cfgBatch.idIndex] || ""
          );

        const num =
          parseInt(
            idAtual.replace(/\D/g, ""),
            10
          );

        if (
          !isNaN(num) &&
          num > maxNum
        ) {
          maxNum = num;
        }
      }

      const linhasCriar = [];

      creates.forEach(function(item, idx) {
        if (!Array.isArray(item)) {
          throw new Error(
            "CREATE em lote inválido em " +
            params.sheet
          );
        }

        let linha =
          Array.from(item);

        linha[cfgBatch.idIndex] =
          cfgBatch.prefixo +
          String(maxNum + idx + 1)
            .padStart(3, "0");

        if (nomeSheet === "TCENTRO_CUSTO") {
          linha =
            normalizarCentroCusto(linha);
        }

        linhasCriar.push(linha);
      });

      if (linhasCriar.length > 0) {
        const largura =
          Math.max.apply(
            null,
            linhasCriar.map(function(l) {
              return l.length;
            })
          );

        const completas =
          linhasCriar.map(function(l) {
            const x = Array.from(l);
            while (x.length < largura) {
              x.push("");
            }
            return x;
          });

        sheetBatch
          .getRange(
            sheetBatch.getLastRow() + 1,
            1,
            completas.length,
            largura
          )
          .setValues(completas);
      }

      SpreadsheetApp.flush();

      // Um único recálculo após todas as alterações.
      recalcularTodosCentrosDeCusto(
        ss,
        clienteTarget,
        periodoTarget
      );

      SpreadsheetApp.flush();

      return jsonResponse({
        status: "success",
        created: linhasCriar.length,
        updated: atualizados,
        deleted: linhasExcluir.length
      });
    }

    // ==================================================
    // LOCALIZA ABA
    // ==================================================

    const sheet =
      ss.getSheetByName(params.sheet);

    if (!sheet) {
      throw new Error(
        "Aba não encontrada: " +
        params.sheet
      );
    }


    // ==================================================
    // LOCALIZAÇÃO SEGURA DA COLUNA ID
    // ==================================================

    const headersSheet =
      sheet
        .getRange(
          1,
          1,
          1,
          sheet.getLastColumn()
        )
        .getValues()[0]
        .map(
          h =>
            String(h || "")
              .trim()
              .toUpperCase()
        );

    const mapaColunaId = {
      TCLIENTE: "TCLIENTE_ID",
      TUSUARIO: "TUSUARIO_ID",
      TPERIODO: "TPERIODO_ID",
      TINVESTIMENTOS: "TINVESTIMENTO_ID",
      TCENTRO_CUSTO: "TCENTRO_CUSTO_ID",
      TRECURSO: "TRECURSO_ID",
      TBENEFICIOS: "TBENEFICIO_ID",
      TFUNCIONARIO: "TFUNCIONARIO_ID",
      TPLANO_CONTAS: "TPLANO_CONTA_ID"
    };

    const nomeColunaId =
      mapaColunaId[nomeSheet];

    // V5.2.12 — identidade composta para dados de período.
    // Em períodos clonados, os IDs dos registros são preservados para manter
    // os vínculos internos (CC, funcionário, recurso, plano de contas etc.).
    // Portanto o registro só é único dentro de CLIENTE + PERÍODO + ID.
    const tabelasComPeriodo = [
      "TPERIODO",
      "TINVESTIMENTOS",
      "TCENTRO_CUSTO",
      "TRECURSO",
      "TBENEFICIOS",
      "TFUNCIONARIO",
      "TPLANO_CONTAS"
    ];

    const usaPeriodo =
      tabelasComPeriodo.includes(nomeSheet);

    if (!nomeColunaId) {
      throw new Error(
        "Tabela sem configuração de ID: " +
        params.sheet
      );
    }

    const colIdIndex =
      headersSheet.indexOf(
        nomeColunaId
      );

    if (colIdIndex === -1) {
      throw new Error(
        "Coluna de ID não encontrada na aba " +
        params.sheet +
        ": " +
        nomeColunaId
      );
    }


    // ==================================================
    // DELETE
    // ==================================================

    if (action === "DELETE") {

      const data =
        sheet
          .getDataRange()
          .getValues();

      const idProcurado =
        String(params.id || "")
          .trim()
          .toUpperCase();

      const cliProcurado =
        String(params.clienteId || "")
          .trim()
          .toUpperCase();

      const perProcurado =
        String(params.periodoId || "")
          .trim()
          .toUpperCase();

      if (usaPeriodo && (!cliProcurado || !perProcurado)) {
        throw new Error(
          "DELETE bloqueado por segurança: clienteId e periodoId são obrigatórios para " +
          params.sheet +
          "."
        );
      }

      for (
        let i = 1;
        i < data.length;
        i++
      ) {

        const idNaPlanilha =
          String(
            data[i][colIdIndex] || ""
          )
            .trim()
            .toUpperCase();

        const cliNaPlanilha =
          String(data[i][0] || "")
            .trim()
            .toUpperCase();

        const perNaPlanilha =
          String(data[i][1] || "")
            .trim()
            .toUpperCase();

        const matchCliente =
          usaPeriodo
            ? cliNaPlanilha === cliProcurado
            : (cliProcurado === "" || cliNaPlanilha === cliProcurado);

        const matchPeriodo =
          usaPeriodo
            ? perNaPlanilha === perProcurado
            : true;

        if (
          idNaPlanilha === idProcurado &&
          idProcurado !== "" &&
          matchCliente &&
          matchPeriodo
        ) {

          sheet.deleteRow(i + 1);

          if (
            [
              "TRECURSO",
              "TFUNCIONARIO",
              "TCENTRO_CUSTO",
              "TPLANO_CONTAS",
              "TPERIODO",
              "TBENEFICIOS"
            ].includes(nomeSheet)
          ) {

            recalcularTodosCentrosDeCusto(
              ss,
              cliNaPlanilha,
              perNaPlanilha
            );
          }

          SpreadsheetApp.flush();

          return jsonResponse({
            status: "deleted"
          });
        }
      }

      throw new Error(
        "Registro não encontrado para exclusão em " +
        params.sheet +
        " com ID: " +
        params.id
      );
    }


    // ==================================================
    // UPDATE / UPDATE_STATUS_PERIODO
    // ==================================================

    if (
      action === "UPDATE" ||
      action === "UPDATE_STATUS_PERIODO"
    ) {

      if (!Array.isArray(params.data)) {
        throw new Error(
          "Dados inválidos recebidos para UPDATE."
        );
      }

      const data =
        sheet
          .getDataRange()
          .getValues();

      const idProcurado =
        String(params.id || "")
          .trim()
          .toUpperCase();

      if (!idProcurado) {
        throw new Error(
          "UPDATE solicitado sem ID para a aba " +
          params.sheet
        );
      }

      // V5.2.12 — em períodos clonados os IDs históricos podem se repetir.
      // Por isso UPDATE não pode localizar apenas pelo ID; precisa respeitar
      // também o cliente e o período quando a tabela possui esse contexto.
      const cliProcurado =
        String(
          params.clienteId ||
          (params.data && params.data[0]) ||
          ""
        )
          .trim()
          .toUpperCase();

      const perProcurado =
        usaPeriodo
          ? String(
              params.periodoId ||
              (params.data && params.data[1]) ||
              ""
            )
              .trim()
              .toUpperCase()
          : "";

      if (usaPeriodo && (!cliProcurado || !perProcurado)) {
        throw new Error(
          "UPDATE bloqueado por segurança: clienteId e periodoId são obrigatórios para " +
          params.sheet +
          "."
        );
      }

      let linhaEncontrada = -1;

      for (
        let i = 1;
        i < data.length;
        i++
      ) {

        const idNaPlanilha =
          String(
            data[i][colIdIndex] || ""
          )
            .trim()
            .toUpperCase();

        const cliNaPlanilha =
          String(data[i][0] || "")
            .trim()
            .toUpperCase();

        const perNaPlanilha =
          usaPeriodo
            ? String(data[i][1] || "")
                .trim()
                .toUpperCase()
            : "";

        const matchCliente =
          usaPeriodo
            ? cliNaPlanilha === cliProcurado
            : (cliProcurado === "" || cliNaPlanilha === cliProcurado);

        const matchPeriodo =
          usaPeriodo
            ? perNaPlanilha === perProcurado
            : true;

        if (
          idNaPlanilha === idProcurado &&
          matchCliente &&
          matchPeriodo
        ) {
          linhaEncontrada =
            i + 1;
          break;
        }
      }

      if (
        linhaEncontrada === -1
      ) {
        throw new Error(
          "Registro não encontrado para atualização. " +
          "Aba: " +
          params.sheet +
          " | ID: " +
          params.id +
          " | Coluna ID: " +
          nomeColunaId +
          " | Cliente: " +
          cliProcurado +
          " | Período: " +
          perProcurado
        );
      }


      // ----------------------------------------------
      // NORMALIZAÇÕES
      // ----------------------------------------------

      if (
        nomeSheet ===
        "TCENTRO_CUSTO"
      ) {
        params.data =
          normalizarCentroCusto(
            params.data
          );
      }

      if (
        nomeSheet === "TPERIODO"
      ) {
        params.data =
          normalizarPeriodo(
            params.data
          );
      }


      // ----------------------------------------------
      // PROTEGE COLUNAS NÃO ENVIADAS PELO FRONTEND
      // ----------------------------------------------
      //
      // O UPDATE grava apenas o número de colunas
      // recebido em params.data.
      //
      // Portanto, campos posteriores que não fazem
      // parte do formulário permanecem intactos.
      // ----------------------------------------------

      sheet
        .getRange(
          linhaEncontrada,
          1,
          1,
          params.data.length
        )
        .setValues([
          params.data
        ]);

      SpreadsheetApp.flush();


      // ----------------------------------------------
      // RECÁLCULO
      // ----------------------------------------------

      if (
        [
          "TRECURSO",
          "TFUNCIONARIO",
          "TCENTRO_CUSTO",
          "TPLANO_CONTAS",
          "TPERIODO",
          "TBENEFICIOS"
        ].includes(nomeSheet)
      ) {

        const cliIdTarget =
          params.clienteId ||
          params.data[0] ||
          "";

        const perIdTarget =
          params.periodoId ||
          params.data[1] ||
          "";

        recalcularTodosCentrosDeCusto(
          ss,
          cliIdTarget,
          perIdTarget
        );

        SpreadsheetApp.flush();
      }

      return jsonResponse({
        status: "updated",
        sheet: params.sheet,
        id: params.id,
        row: linhaEncontrada
      });
    }


    // ==================================================
    // CREATE
    // ==================================================

    if (!Array.isArray(params.data)) {
      throw new Error(
        "Dados inválidos recebidos para CREATE."
      );
    }


    if (nomeSheet === "TCLIENTE") {

      params.data[0] =
        gerarNovoID(
          sheet,
          "CLI-",
          0
        );

    } else if (
      nomeSheet === "TUSUARIO"
    ) {

      params.data[1] =
        gerarNovoID(
          sheet,
          "USR-",
          1
        );

      CacheService
        .getScriptCache()
        .remove("users_data");

    } else if (
      nomeSheet === "TPERIODO"
    ) {

      params.data[1] =
        gerarNovoID(
          sheet,
          "PER-",
          1
        );

      params.data =
        normalizarPeriodo(
          params.data
        );

    } else if (
      nomeSheet ===
      "TCENTRO_CUSTO"
    ) {

      params.data[2] =
        gerarNovoID(
          sheet,
          "CC-",
          2
        );

      params.data =
        normalizarCentroCusto(
          params.data
        );

    } else if (
      nomeSheet === "TRECURSO"
    ) {

      params.data[3] =
        gerarNovoID(
          sheet,
          "REC-",
          3
        );

    } else if (
      nomeSheet === "TBENEFICIOS"
    ) {

      params.data[2] =
        gerarNovoID(
          sheet,
          "BEN-",
          2
        );

    } else if (
      nomeSheet === "TFUNCIONARIO"
    ) {

      params.data[3] =
        gerarNovoID(
          sheet,
          "FUNC-",
          3
        );

    } else if (
      nomeSheet === "TPLANO_CONTAS"
    ) {

      params.data[3] =
        gerarNovoID(
          sheet,
          "PLC-",
          3
        );

    } else if (
      nomeSheet === "TINVESTIMENTOS"
    ) {

      params.data[2] =
        gerarNovoID(
          sheet,
          "INV-",
          2
        );
    }


    sheet.appendRow(
      params.data
    );

    SpreadsheetApp.flush();

    if (nomeSheet === "TPERIODO") {
      atribuirDiagnosticoNovoPeriodo(
        ss,
        params.data[0],
        params.data[1]
      );
      SpreadsheetApp.flush();
    }


    if (
      [
        "TRECURSO",
        "TFUNCIONARIO",
        "TCENTRO_CUSTO",
        "TPLANO_CONTAS",
        "TPERIODO",
        "TBENEFICIOS"
      ].includes(nomeSheet)
    ) {

      recalcularTodosCentrosDeCusto(
        ss,
        params.data[0],
        params.data[1]
      );

      SpreadsheetApp.flush();
    }


    return jsonResponse({
      status: "success"
    });


  } catch (err) {

    return jsonResponse({
      status: "error",
      message: err.toString()
    });

  } finally {

    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (e) {}
    }
  }
}


// ======================================================
// VERIFICA PERÍODO FECHADO
// ======================================================

function isPeriodoFechado(
  ss,
  clienteId,
  periodoId
) {

  const sheetPeriodo =
    ss.getSheetByName(
      "TPERIODO"
    );

  if (!sheetPeriodo) {
    return false;
  }

  const data =
    sheetPeriodo
      .getDataRange()
      .getValues();

  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    if (
      String(data[i][0])
        .trim()
        .toUpperCase() ===
        String(clienteId)
          .trim()
          .toUpperCase() &&

      String(data[i][1])
        .trim()
        .toUpperCase() ===
        String(periodoId)
          .trim()
          .toUpperCase()
    ) {

      const status =
        String(
          data[i][3] || ""
        )
          .trim()
          .toUpperCase();

      return status === "FECHADO";
    }
  }

  return false;
}


// ======================================================
// GERA NOVO ID
// ======================================================

function gerarNovoID(
  sheet,
  prefixo,
  colIndex
) {

  const data =
    sheet
      .getDataRange()
      .getValues();

  if (data.length <= 1) {
    return prefixo + "001";
  }

  let maxNum = 0;

  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    const idAtual =
      String(
        data[i][colIndex] || ""
      );

    const num =
      parseInt(
        idAtual.replace(/\D/g, ""),
        10
      );

    if (
      !isNaN(num) &&
      num > maxNum
    ) {
      maxNum = num;
    }
  }

  return (
    prefixo +
    String(maxNum + 1)
      .padStart(3, "0")
  );
}


// ======================================================
// CLONAR PERÍODO
// ======================================================

function clonarEstruturaPeriodo(
  ss,
  clienteId,
  periodoOrigemId,
  novoNomePeriodo
) {

  const sheetPeriodo =
    ss.getSheetByName(
      "TPERIODO"
    );

  if (!sheetPeriodo) {
    throw new Error(
      "Aba TPERIODO não encontrada."
    );
  }

  const novoPeriodoId =
    gerarNovoID(
      sheetPeriodo,
      "PER-",
      1
    );

  /*
   * V5.1:
   * Agora TPERIODO possui 11 colunas.
   * A coluna K é:
   * TPERIODO_DESCONSIDERAR_DEPRECIACAO
   */

  let origData = [
    clienteId,
    novoPeriodoId,
    novoNomePeriodo,
    "ABERTO",
    "SIM",
    0,
    0,
    0,
    0,
    0,
    "NAO"
  ];

  const pData =
    sheetPeriodo
      .getDataRange()
      .getValues();

  for (
    let p = 1;
    p < pData.length;
    p++
  ) {

    if (
      String(pData[p][0]) ===
        String(clienteId) &&
      String(pData[p][1]) ===
        String(periodoOrigemId)
    ) {

      origData = [
        clienteId,
        novoPeriodoId,
        novoNomePeriodo,
        "ABERTO",
        "SIM",
        pData[p][5] || 0,
        pData[p][6] || 0,
        pData[p][7] || 0,
        pData[p][8] || 0,
        pData[p][9] || 0,
        valorSim(pData[p][10])
          ? "SIM"
          : "NAO"
      ];

      break;
    }
  }

  sheetPeriodo.appendRow(
    origData
  );

  // V5.2.22 — novos períodos recebem sempre o padrão global mais recente.
  atribuirDiagnosticoNovoPeriodo(
    ss,
    clienteId,
    novoPeriodoId
  );

  const abasDuplicar = [
    "TCENTRO_CUSTO",
    "TRECURSO",
    "TBENEFICIOS",
    "TFUNCIONARIO",
    "TPLANO_CONTAS",
    "TINVESTIMENTOS"
  ];

  abasDuplicar.forEach(
    nomeAba => {

      const sheet =
        ss.getSheetByName(
          nomeAba
        );

      if (!sheet) return;

      const data =
        sheet
          .getDataRange()
          .getValues();

      const linhasNovas = [];

      for (
        let i = 1;
        i < data.length;
        i++
      ) {

        if (
          String(data[i][0]) ===
            String(clienteId) &&
          String(data[i][1]) ===
            String(periodoOrigemId)
        ) {

          const novaLinha =
            Array.from(data[i]);

          novaLinha[1] =
            novoPeriodoId;

          linhasNovas.push(
            novaLinha
          );
        }
      }

      if (
        linhasNovas.length > 0
      ) {

        sheet
          .getRange(
            sheet.getLastRow() + 1,
            1,
            linhasNovas.length,
            linhasNovas[0].length
          )
          .setValues(
            linhasNovas
          );
      }
    }
  );

  SpreadsheetApp.flush();

  recalcularTodosCentrosDeCusto(
    ss,
    clienteId,
    novoPeriodoId
  );

  SpreadsheetApp.flush();

  return jsonResponse({
    status: "cloned",
    novoPeriodoId:
      novoPeriodoId
  });
}


// ======================================================
// RECÁLCULO GERAL DOS CENTROS DE CUSTO
// ======================================================

function recalcularTodosCentrosDeCusto(
  ss,
  clienteId,
  periodoId
) {

  const sheetCC =
    ss.getSheetByName(
      "TCENTRO_CUSTO"
    );

  const sheetRec =
    ss.getSheetByName(
      "TRECURSO"
    );

  const sheetFunc =
    ss.getSheetByName(
      "TFUNCIONARIO"
    );

  const sheetPlano =
    ss.getSheetByName(
      "TPLANO_CONTAS"
    );

  const sheetPeriodo =
    ss.getSheetByName(
      "TPERIODO"
    );

  if (!sheetCC) {
    return;
  }


  const dataCC =
    sheetCC
      .getDataRange()
      .getValues();

  const dataRec =
    sheetRec
      ? sheetRec
          .getDataRange()
          .getValues()
      : [];

  const dataFunc =
    sheetFunc
      ? sheetFunc
          .getDataRange()
          .getValues()
      : [];

  const dataPlano =
    sheetPlano
      ? sheetPlano
          .getDataRange()
          .getValues()
      : [];

  const dataPeriodo =
    sheetPeriodo
      ? sheetPeriodo
          .getDataRange()
          .getValues()
      : [];


  // ====================================================
  // CONFIGURAÇÕES DO PERÍODO
  // ====================================================

  let valorPredioTotal = 0;

  let desconsiderarDepreciacao =
    false;

  for (
    let p = 1;
    p < dataPeriodo.length;
    p++
  ) {

    if (
      String(dataPeriodo[p][0]) ===
        String(clienteId) &&
      String(dataPeriodo[p][1]) ===
        String(periodoId)
    ) {

      valorPredioTotal =
        numeroSeguro(
          dataPeriodo[p][7],
          0
        );

      // Coluna K / índice 10
      desconsiderarDepreciacao =
        valorSim(
          dataPeriodo[p][10]
        );

      break;
    }
  }


  /*
   * O prédio continua cadastrado normalmente.
   * Só a utilização da depreciação é zerada.
   */

  const depreciacaoPredioMensalTotal =
    desconsiderarDepreciacao
      ? 0
      : (
          valorPredioTotal *
          (0.04 / 12)
        );


  // ====================================================
  // MONTA MAPA DOS CENTROS
  // ====================================================

  const ccMap = {};

  let totalAreaGlobal = 0;


  for (
    let j = 1;
    j < dataCC.length;
    j++
  ) {

    if (
      String(dataCC[j][0]) !==
        String(clienteId) ||
      String(dataCC[j][1]) !==
        String(periodoId)
    ) {
      continue;
    }


    const ccId =
      String(dataCC[j][2]);

    const area =
      numeroSeguro(
        dataCC[j][6],
        0
      );

    const tipoCC =
      String(
        dataCC[j][4] || ""
      )
        .trim()
        .toUpperCase();

    let tipoRateioHoras =
      tipoCC ===
      "PRODUTIVO DIRETO"
        ? String(
            dataCC[j][9] || ""
          )
            .trim()
            .toUpperCase()
        : "";

    // K / índice 10 é o campo oficial CONSIDERAR_MINIMO.
    // Compatibilidade de reparo: se uma linha antiga ficou com J=MINIMO
    // e K foi corrompida pela versão anterior, ela também é tratada como mínimo.
    const considerarMinimo =
      tipoCC === "PRODUTIVO DIRETO" &&
      (
        valorSim(dataCC[j][10]) ||
        tipoRateioHoras === "MINIMO"
      );

    let fxDireto =
      numeroSeguro(
        dataCC[j][7],
        0
      );

    let prodPct =
      numeroSeguro(
        dataCC[j][8],
        100
      );

    // ================================================
    // REGRA DO MÍNIMO
    // ================================================

    if (
      considerarMinimo &&
      tipoCC ===
        "PRODUTIVO DIRETO"
    ) {

      prodPct = 100;
      tipoRateioHoras =
        "MINIMO";
    }


    totalAreaGlobal +=
      area;


    ccMap[ccId] = {

      row: j + 1,

      nome:
        String(
          dataCC[j][3] || ""
        ),

      tipo:
        tipoCC,

      considerarMinimo:
        considerarMinimo,

      area:
        area,

      custoFixoDireto:
        fxDireto,

      produtividadePct:
        prodPct,

      tipoRateioHoras:
        tipoRateioHoras,

      qtdeRecursos:
        0,

      custoMensalRec:
        0,

      horasMaquinas:
        0,

      custoFuncionario:
        0,

      horasFuncionario:
        0,

      horasFinais:
        0,

      custoPlanoContas:
        0,

      custoPredio:
        0,

      custoIndiretos:
        0
    };
  }


  // ====================================================
  // 1. RECURSOS
  // ====================================================

  for (
    let i = 1;
    i < dataRec.length;
    i++
  ) {

    if (
      String(dataRec[i][0]) !==
        String(clienteId) ||
      String(dataRec[i][1]) !==
        String(periodoId)
    ) {
      continue;
    }


    const ccId =
      String(
        dataRec[i][2] || ""
      );

    if (!ccMap[ccId]) {
      continue;
    }


    ccMap[ccId]
      .qtdeRecursos++;


    /*
     * TRECURSO índice 7:
     * custo mensal / depreciação do recurso.
     *
     * Se o período estiver marcado para
     * desconsiderar depreciação:
     *
     * - NÃO altera TRECURSO
     * - NÃO apaga valor
     * - simplesmente usa ZERO no cálculo
     */

    const valRecCusto =
      desconsiderarDepreciacao
        ? 0
        : numeroSeguro(
            dataRec[i][7],
            0
          );


    ccMap[ccId]
      .custoMensalRec +=
      valRecCusto;


    const turnosRec =
      numeroSeguro(
        dataRec[i][8],
        1
      ) || 1;


    ccMap[ccId]
      .horasMaquinas +=
      176 * turnosRec;
  }


  // ====================================================
  // 2. FUNCIONÁRIOS
  // ====================================================

  let totalSobraRateioFuncionarios =
    0;


  for (
    let k = 1;
    k < dataFunc.length;
    k++
  ) {

    if (
      String(dataFunc[k][0]) !==
        String(clienteId) ||
      String(dataFunc[k][1]) !==
        String(periodoId)
    ) {
      continue;
    }


    let ccInfo =
      String(
        dataFunc[k][2] || ""
      ).trim();


    if (
      ccInfo.startsWith('"') &&
      ccInfo.endsWith('"')
    ) {
      ccInfo =
        ccInfo.substring(
          1,
          ccInfo.length - 1
        );
    }


    ccInfo =
      ccInfo
        .replace(/""/g, '"')
        .replace(/;/g, ",");


    const custoMensal =
      numeroSeguro(
        dataFunc[k][9],
        0
      );


    const horasTotais =
      numeroSeguro(
        dataFunc[k][12],
        176
      ) || 176;


    const isRateio =
      String(
        dataFunc[k][10] || ""
      )
        .trim()
        .toUpperCase() ===
      "SIM";


    const sobraFunc =
      numeroSeguro(
        dataFunc[k][11],
        0
      );


    totalSobraRateioFuncionarios +=
      sobraFunc;


    if (!isRateio) {

      if (ccMap[ccInfo]) {

        ccMap[ccInfo]
          .custoFuncionario +=
          custoMensal;

        ccMap[ccInfo]
          .horasFuncionario +=
          horasTotais;
      }

    } else {

      try {

        const rateioArr =
          JSON.parse(
            ccInfo
          );

        if (
          Array.isArray(
            rateioArr
          )
        ) {

          rateioArr.forEach(
            item => {

              const idT =
                item.id ||
                item.ID;

              const pctT =
                item.pct ??
                item.PCT ??
                0;

              if (
                ccMap[idT]
              ) {

                const pct =
                  numeroSeguro(
                    pctT,
                    0
                  ) / 100;

                ccMap[idT]
                  .custoFuncionario +=
                  custoMensal *
                  pct;

                ccMap[idT]
                  .horasFuncionario +=
                  horasTotais *
                  pct;
              }
            }
          );
        }

      } catch (e) {

        if (
          ccMap[ccInfo]
        ) {

          ccMap[ccInfo]
            .custoFuncionario +=
            custoMensal;

          ccMap[ccInfo]
            .horasFuncionario +=
            horasTotais;
        }
      }
    }
  }


  // ====================================================
  // HORAS FINAIS + DEPRECIAÇÃO PREDIAL
  // ====================================================

  Object.keys(
    ccMap
  ).forEach(id => {

    const cc =
      ccMap[id];


    if (
      cc.tipo ===
      "PRODUTIVO DIRETO"
    ) {

      /*
       * REGRA PRIORITÁRIA:
       *
       * Considerar Mínimo = SIM
       * => 130 horas fixas
       * => tipo rateio MINIMO
       * => produtividade 100%
       */

      if (
        cc.considerarMinimo
      ) {

        cc.horasFinais = 130;
        cc.tipoRateioHoras =
          "MINIMO";
        cc.produtividadePct =
          100;

      } else if (
        cc.tipoRateioHoras ===
        "MAQUINA"
      ) {

        cc.horasFinais =
          cc.horasMaquinas;

      } else {

        cc.horasFinais =
          cc.horasFuncionario;
      }

    } else {

      cc.horasFinais = 0;
    }


    /*
     * Depreciação predial:
     *
     * - normal => rateada pela área
     * - período sem depreciação => ZERO
     */

    if (
      !desconsiderarDepreciacao &&
      totalAreaGlobal > 0
    ) {

      cc.custoPredio =
        depreciacaoPredioMensalTotal *
        (
          cc.area /
          totalAreaGlobal
        );

    } else {

      cc.custoPredio = 0;
    }
  });


  // ====================================================
  // 3. PLANO DE CONTAS
  // ====================================================
  // Novos critérios automáticos por tipo de Centro de Custo:
  // PD_AREA, PD_RECURSOS, PD_HORAS, PI_AREA e ADM_AREA.
  // ====================================================

  for (let p = 1; p < dataPlano.length; p++) {
    if (String(dataPlano[p][0]) !== String(clienteId) || String(dataPlano[p][1]) !== String(periodoId)) continue;

    let ccTargetInfo = String(dataPlano[p][2] || "").trim();
    if (ccTargetInfo.startsWith('"') && ccTargetInfo.endsWith('"')) ccTargetInfo = ccTargetInfo.substring(1, ccTargetInfo.length - 1);
    ccTargetInfo = ccTargetInfo.replace(/""/g, '"').replace(/;/g, ",");

    const criterioPlano = String(dataPlano[p][5] || "").trim().toUpperCase();
    const valorPlano = numeroSeguro(dataPlano[p][6], 0);

    if (criterioPlano.includes("NÃO RATEAR") || criterioPlano.includes("NAO RATEAR")) continue;

    if (criterioPlano === "EXCLUSIVO") {
      if (ccMap[ccTargetInfo]) ccMap[ccTargetInfo].custoPlanoContas += valorPlano;
      continue;
    }

    const criterioAutomatico = {
      PD_AREA:     { tipo: "PRODUTIVO DIRETO",   base: "AREA" },
      PD_RECURSOS: { tipo: "PRODUTIVO DIRETO",   base: "RECURSOS" },
      PD_HORAS:    { tipo: "PRODUTIVO DIRETO",   base: "HORAS" },
      PI_AREA:     { tipo: "PRODUTIVO INDIRETO", base: "AREA" },
      ADM_AREA:    { tipo: "ADMINISTRATIVO",     base: "AREA" }
    };

    const regraAuto = criterioAutomatico[criterioPlano] || null;
    const criterioBase = regraAuto ? regraAuto.base : criterioPlano;
    let participantes = [];

    if (regraAuto) {
      participantes = Object.keys(ccMap).filter(id => ccMap[id].tipo === regraAuto.tipo);
    } else {
      try { participantes = JSON.parse(ccTargetInfo); }
      catch (e) { participantes = Object.keys(ccMap); }
      if (!Array.isArray(participantes) || participantes.length === 0) participantes = Object.keys(ccMap);
    }

    if (criterioPlano === "SELETIVO_PERCENTUAL" || ccTargetInfo.includes("pct")) {
      participantes.forEach(item => {
        const idStr = typeof item === "object" ? (item.id || item.ID) : item;
        if (!ccMap[idStr]) return;
        const pctVal = typeof item === "object" ? (item.pct ?? item.PCT ?? 0) : 0;
        ccMap[idStr].custoPlanoContas += valorPlano * (numeroSeguro(pctVal, 0) / 100);
      });
      continue;
    }

    let baseTotal = 0;
    participantes.forEach(item => {
      const idStr = typeof item === "object" ? (item.id || item.ID) : item;
      if (!ccMap[idStr]) return;
      if (criterioBase === "AREA") baseTotal += ccMap[idStr].area;
      else if (criterioBase === "RECURSOS") baseTotal += ccMap[idStr].qtdeRecursos;
      else if (criterioBase === "HORAS") baseTotal += ccMap[idStr].horasFinais;
    });

    if (baseTotal <= 0) continue;

    participantes.forEach(item => {
      const idStr = typeof item === "object" ? (item.id || item.ID) : item;
      if (!ccMap[idStr]) return;
      let baseCC = 0;
      if (criterioBase === "AREA") baseCC = ccMap[idStr].area;
      else if (criterioBase === "RECURSOS") baseCC = ccMap[idStr].qtdeRecursos;
      else if (criterioBase === "HORAS") baseCC = ccMap[idStr].horasFinais;
      ccMap[idStr].custoPlanoContas += valorPlano * (baseCC / baseTotal);
    });
  }


  // ====================================================
  // 4. RATEIO DOS PRODUTIVOS INDIRETOS
  // ====================================================

  let totalCustoIndiretoAcumulado =
    totalSobraRateioFuncionarios;

  let totalHorasProdutivosDiretos =
    0;


  Object.keys(
    ccMap
  ).forEach(id => {

    const cc =
      ccMap[id];


    if (
      cc.tipo ===
      "PRODUTIVO INDIRETO"
    ) {

      const custoTotalDoSetor =
        cc.custoFixoDireto +
        cc.custoMensalRec +
        cc.custoFuncionario +
        cc.custoPlanoContas +
        cc.custoPredio;


      totalCustoIndiretoAcumulado +=
        custoTotalDoSetor;

    } else if (
      cc.tipo ===
      "PRODUTIVO DIRETO"
    ) {

      totalHorasProdutivosDiretos +=
        cc.horasFinais;
    }
  });


  if (
    totalHorasProdutivosDiretos > 0 &&
    totalCustoIndiretoAcumulado > 0
  ) {

    const taxaIndiretoPorHora =
      totalCustoIndiretoAcumulado /
      totalHorasProdutivosDiretos;


    Object.keys(
      ccMap
    ).forEach(id => {

      if (
        ccMap[id].tipo ===
        "PRODUTIVO DIRETO"
      ) {

        ccMap[id]
          .custoIndiretos =
          ccMap[id]
            .horasFinais *
          taxaIndiretoPorHora;

      } else {

        ccMap[id]
          .custoIndiretos = 0;
      }
    });

  } else {

    Object.keys(
      ccMap
    ).forEach(id => {

      ccMap[id]
        .custoIndiretos = 0;
    });
  }


  // ====================================================
  // GRAVAÇÃO TCENTRO_CUSTO
  // ====================================================
  //
  // ATENÇÃO:
  //
  // Coluna 6 (F) = QTDE_RECURSOS.
  // Coluna 11 (K) = CONSIDERAR_MINIMO.
  // Campos de custo calculado seguem de L até Q.
  // ====================================================

  Object.keys(
    ccMap
  ).forEach(id => {

    const item =
      ccMap[id];


    // I = produtividade
    sheetCC
      .getRange(
        item.row,
        9
      )
      .setValue(
        item.produtividadePct
      );


    // J = tipo rateio
    sheetCC
      .getRange(
        item.row,
        10
      )
      .setValue(
        item.tipoRateioHoras
      );


    // F = quantidade de recursos calculada
    sheetCC
      .getRange(
        item.row,
        6
      )
      .setValue(
        item.qtdeRecursos
      );


    // K = considerar mínimo — regrava SIM/NAO para também reparar
    // linhas que foram corrompidas pela versão anterior.
    sheetCC
      .getRange(
        item.row,
        11
      )
      .setValue(
        item.considerarMinimo ? "SIM" : "NAO"
      );


    // L = custo mensal recurso/depreciação
    sheetCC
      .getRange(
        item.row,
        12
      )
      .setValue(
        item.custoMensalRec
      );


    // M = custo funcionário
    sheetCC
      .getRange(
        item.row,
        13
      )
      .setValue(
        item.custoFuncionario
      );


    // N = horas finais
    sheetCC
      .getRange(
        item.row,
        14
      )
      .setValue(
        item.horasFinais
      );


    // O = plano de contas
    sheetCC
      .getRange(
        item.row,
        15
      )
      .setValue(
        item.custoPlanoContas
      );


    // P = prédio
    sheetCC
      .getRange(
        item.row,
        16
      )
      .setValue(
        item.custoPredio
      );


    // Q = indiretos
    sheetCC
      .getRange(
        item.row,
        17
      )
      .setValue(
        item.custoIndiretos
      );
  });


  SpreadsheetApp.flush();
}

function autorizarEmailConsultoriaRF() {
  MailApp.sendEmail({
    to: "richard@consultoriarf.net",
    subject: "CONSULTORIA.RF | Teste de autorização",
    body: "Envio de e-mail autorizado com sucesso."
  });

  Logger.log("E-mail enviado com sucesso.");
}
