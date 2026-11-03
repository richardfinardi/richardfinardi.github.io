# Monitoramento das APIs — Cloudflare AUVRIUN

Worker: `auvriun-api-monitor`. Faz uma requisição HTTPS real a cada API
de 5 em 5 minutos via Cron Trigger, salva o histórico em Durable Object e
publica `/status` para o painel web e widget Android.

## E-mail pela sua conta Google, sem Resend

Código pronto em **monitoramento/google-apps-script/Codigo.gs** e instruções em
**monitoramento/google-apps-script/README.md**.

- Google Apps Script executa como o proprietário e envia por MailApp.
- Receptor só aceita eventos com token secreto compartilhado.
- Worker utiliza dois Secrets:
  `GOOGLE_APPS_SCRIPT_URL` (URL `/exec`) e `ALERT_WEBHOOK_TOKEN` (token
  gerado ao executar `configurarAlertas` na conta Google).
- Teste completo disponível: executar `testarIntegracaoCompleta` no Google
  Apps Script após configurar os Secrets no Cloudflare.
- `/test-email` exige o token em cabeçalho `Authorization: Bearer ...` e
  não simula indisponibilidade de nenhuma API.
- Queda após 3 falhas consecutivas (~15 minutos); recuperação no primeiro
  sucesso. Retries limitados a 3, com idempotência também no Google.
- Preserva Secrets entre deploys (`keep_vars: true`).
- O painel mostra se o canal de e-mail está configurado e o histórico de envios
  e falhas, sem revelar destinatário ou credenciais.

## Status e segurança

`GET /status` expõe apenas estado das APIs e situação do canal de alertas.
Nenhuma credencial é entregue ao navegador. `POST /run` só está disponível
na instância interna do Durable Object, não na URL pública.
O envio não depende do navegador, do widget Android nem do computador ligado.

## Alternativa legada

O Worker mantém suporte a Resend (`RESEND_API_KEY`, `ALERT_EMAIL_TO`,
`ALERT_EMAIL_FROM`) caso algum dia seja necessário. Quando as duas variáveis
do Google estão presentes, o Google Apps Script é o canal preferencial.
