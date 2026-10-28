# Aerocris — Pré-custeio (3º trimestre/2026)

Módulo acessado na aba **Aerocris · Pré-custeio**, dentro do portal `app.html`, somente pelo menu de administrador.

## Premissas confirmadas
- Jornada contratual de **42 horas semanais por turno**: 07:00–16:24 e 16:24–01:48, ambos com 1 h de intervalo e 8 h 24 min efetivos por dia.
- Capacidade de referência de **182 h/mês por posto e por turno** (42 × 52 ÷ 12). A capacidade real de cada mês depende de calendário, feriados, turnos operantes e eventuais restrições.
- Utilização: Corte 55%; Torno CNC 55%; CTU 3 Eixos 70%; CTU 5 Eixos 70%; Engenharia 70%; Fresa Convencional 55%; Montagem Componentes 55%; Ajustagem 70%; Inspeção 70%; demais / ADM 70%.
- **Versão 1:** 9 centros independentes.
- **Versão 2:** 5 centros independentes (Torno CNC, CTU 3 Eixos, CTU 5 Eixos, Fresa Convencional e Montagem Componentes). Corte, Engenharia, Ajustagem e Inspeção continuam custeados mediante rateio.
- Operadores do Centro de Usinagem CNC são classificados provisoriamente por salário-base, por turno; os quatro maiores de cada turno são sugeridos às quatro máquinas de 5 eixos. Confirmar o quadro real por máquina e turno antes de consolidar.

## Arquivos recebidos, não publicados
1. `Recursos.xlsx` — 35 recursos, 4 máquinas CTU de 5 eixos.
2. `Relação de Funcionários.xls` — 132 posições (inclui vagas previstas), com informações pessoais e salariais.
3. `DRE 3TRIM26.xls` — DRE de 01/07 a 30/09/2026, valores trimestrais.

**Segurança:** o repositório GitHub Pages é público. Nenhum anexo, nome de funcionário, salário, custo de máquina ou valor de DRE foi gravado nele. A base privada é distribuída separadamente ao consultor em arquivo `aerocris_base_privada.json`, carregado manualmente **somente na memória do navegador**. Não compartilhar esse JSON por link público e não adicioná-lo ao repositório.

## Funcionalidade atual
- Análise de custo-hora preliminar por centro, com postos, turnos, utilização e outros gastos mensais editáveis.
- Comparação V1 × V2, recalculando os rateios e exigindo conservação do custo.
- Matriz editável de rateio (quatro origens × cinco destinos). Padrão provisório proporcional às horas efetivas dos destinos, ainda sujeito a homologação.
- Sugestão de operadores de cinco eixos por maior remuneração-base dentro de cada turno.
- Resumo DRE trimestral mensalizado, sem somar valores contábeis em duplicidade à folha.
- Exportação de rascunho **privado** com os ajustes feitos na sessão; importação do mesmo arquivo posteriormente.
- Nenhuma gravação no backend; cliente e período ainda não foram criados.

## Pendências para custeio definitivo
- Cadastrar a Aerocris em Administração e criar períodos distintos: `3T/2026 - V1 - 9 centros` e `3T/2026 - V2 - 5 centros`.
- Confirmar os postos ativos e turnos por centro, encargos, benefícios e folgas; distinguir máquinas de ativos não produtivos.
- Conciliar a DRE com folha, plano de contas, depreciação e demais custos, evitando duplicidade.
- Classificar os salários das áreas Manutenção, Produção, Setup e Suprimentos (atualmente pendentes de rateio).
- Validar com o cliente os percentuais e direcionadores dos quatro setores rateados.
- Vincular os cenários ao modelo persistente do aplicativo após homologar os cadastros.

> Este pré-custeio não é um relatório final, e não modifica a base existente de outros clientes.
