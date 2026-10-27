# Monitoramento de APIs | Consultoria RF

Painel: https://consultoriarf.net/monitoramento/

## Como funciona

- A página estática lê monitoramento/data/status.json, gerado pelo GitHub Actions.
- GitHub Actions executa em cron a cada cinco minutos **quando o agendador permitir**. O GitHub pode atrasar ou pular execuções; não é uma garantia de checagem minuto a minuto.
- Três falhas seguidas geram estado OFFLINE e um alerta. Uma resposta válida seguinte confirma a recuperação.
- Salva últimas 48 verificações por serviço, contadores de disponibilidade desde o primeiro teste e 500 eventos recentes.
- Monitoramento usa /openapi.json e valida JSON OpenAPI para testar realmente o backend FastAPI em vez de verificar apenas a página do Cloudflare.
- Sem resultados ainda, o painel mostra "Aguardando teste"; ele nunca inventa que uma API está online.

## Ajustar endereços

Edite monitoramento/config.json para cadastrar novos serviços ou corrigir URLs. Os domínios de Brastorno, Sintercan, PSTEC, Anfeer e Columbia foram preenchidos como candidatos **não verificados**. Confirme que cada um aponta ao backend real; alguns podem usar endereço ou caminho diferente. Se o backend não expõe OpenAPI, altere tipo para "http" e aponte para um endpoint público de saúde que retorne HTTP 2xx.

## Ativar as verificações

Acesse Actions > Monitoramento de APIs > Run workflow. Confira se o workflow tem permissão para gravar no branch principal e se o GitHub Pages está publicado. Para as execuções automáticas, o Actions precisa estar habilitado no repositório.

## Alertas (opcionais)

Adicione credenciais em Settings > Secrets and variables > Actions (Repository secrets):
- Telegram: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
- E-mail: SMTP_HOST, SMTP_PORT (587 ou 465), SMTP_USER, SMTP_PASSWORD, SMTP_FROM, ALERT_EMAIL_TO.

Sem esses secrets, o painel e histórico funcionam, mas nenhuma mensagem externa será enviada. Nunca adicione tokens ou senhas a arquivos versionados. O usuário precisa habilitar notificações no telefone no aplicativo de e-mail ou Telegram.

## Limitações

GitHub Pages não executa verificações no servidor: o GitHub Actions é quem faz as solicitações. O agendamento não é rigorosamente periódico e pode parar se Actions estiver desabilitado; o painel sinaliza dados com mais de 15 minutos. Os dados e incidentes são públicos em um repositório público. O monitor não testa disponibilidade de serviços internos protegidos por autenticação.
