# AUVRIUN Cloudflare Worker — monitoramento de APIs

O GitHub Actions nao e mais o agendador principal. Este Worker verifica cinco APIs em
Cron Trigger \`*/5 * * * *\` e grava estado e historico duravelmente num Durable Object SQLite,
sem banco de dados ou KV para criar manualmente.

## O que ja esta preparado

- Arquivos do Worker prontos para publicar.
- \`/status\`: JSON publico compativel com o painel e widget Android.
- \`/health\`: horario e atraso da ultima verificacao.
- 3 falhas seguidas para marcar Offline; recuperacao no primeiro sucesso.
- Requisicoes HTTPS reais em \`/openapi.json\`, timeout de 12s, alerta de lentidao acima de 2500ms.
- Histórico de 48 testes por API, ate 500 eventos e metricas de disponibilidade.
- Cron Cloudflare a cada 5 minutos; pode haver pequenos atrasos.
- Resend opcional para e-mails de queda/recuperacao. Necessita dominio remetente verificado.

## Ativacao no Cloudflare da AUVRIUN

1. Acesse Cloudflare > seu perfil AUVRIUN > Workers & Pages. Verifique que
   \`*.workers.dev\` esteja ativado para a conta (nenhuma zona DNS obrigatoria).
2. Crie um token de API com a predefinicao **Edit Cloudflare Workers**, ou
   com a funcao **Workers Admin** no produto Workers se a tela usar o novo
   modelo de papeis. Restrinja o acesso apenas a conta AUVRIUN.
3. Copie o **Account ID** da conta Cloudflare (sem compartilhá-lo com senha).
4. No GitHub do repo \`richardfinardi/richardfinardi.github.io\`, crie em
   Settings > Secrets and variables > Actions:
   \`CLOUDFLARE_ACCOUNT_ID\` e \`CLOUDFLARE_API_TOKEN\`.
5. Actions > **Deploy AUVRIUN Monitor - Cloudflare** > **Run workflow**.
   Ele publica automaticamente Worker, Durable Object e Cron Trigger.
6. O proprio workflow identifica a URL publicada e a registra no arquivo
   \`monitoramento/data-source.json\`: nao e necessario copiar enderecos manualmente.
   Pode ser que a primeira verificacao leve alguns minutos apos o deploy.
7. O painel e o APK versao 1.3.0 ou superior passam a ler o Cloudflare
   diretamente. Confirme no painel que aparece \`Cloudflare AUVRIUN\`.
8. Somente apos conferir verificacoes reais desative a tarefa antiga do GitHub
   em \`.github/workflows/monitoramento.yml\` para nao duplicar monitoramento.

## Alertas por e-mail (opcional, Resend)

O Worker usa HTTPS API da Resend (Workers nao executam SMTP tradicional).
Crie uma conta em Resend, verifique um dominio remetente e defina estes Secrets
no proprio Cloudflare Worker (Settings > Variables and Secrets):
- \`RESEND_API_KEY\`: chave da Resend, tipo Secret
- \`ALERT_EMAIL_FROM\`: nome e endereco verificados, como
  \`RF Monitor <alertas@seu-dominio-verificado.com>\`
- \`ALERT_EMAIL_TO\`: e-mail(s) destinatario(s), separados por virgula

Ao ocorrerem tres falhas seguidas, envia aviso de indisponibilidade.
Ao voltar, envia aviso de recuperacao. Retry limitado a tres tentativas.

## Seguranca

- \`/status\` publica apenas o estado de APIs publicas e mensagens de erro truncadas.
- Nao adicione tokens ao config.json, Worker ou repositorio.
- O caminho interno \`/run\` nao e exposto ao publico.
- Durable Object e classe de armazenamento sao provisionados no primeiro deploy.
- A infraestrutura e persistente e independe do computador do usuario.
- Se o Cloudflare estiver fora ou o Cron atrasar, painel/widget mostram dados atrasados.

## Alertas por e-mail no monitoramento web (Resend)

O monitoramento e o envio dos e-mails ocorrem no **Cloudflare Worker**, independentemente
do navegador, GitHub Actions ou widget Android. A página pública de monitoramento
mostra somente se o canal está configurado e o resultado dos últimos envios;
não exibe as credenciais nem os endereços de destinatários.

**Para ativar:**
1. Em https://resend.com/domains, adicione um domínio ou subdomínio remetente
   sob seu controle e publique no provedor DNS os registros solicitados pela Resend.
   Verifique que esteja marcado como Verified. Não altere MX do Google Workspace.
2. Crie uma chave de envio em https://resend.com/api-keys .
3. Abra Cloudflare (conta AUVRIUN) > Workers & Pages >
   auvriun-api-monitor > Settings > Variables and Secrets > Add.
4. Cadastre as três variáveis abaixo e clique Deploy:
   - RESEND_API_KEY: tipo Secret; chave da Resend (não divulgar).
   - ALERT_EMAIL_FROM: tipo Secret; remetente no domínio verificado,
     exemplo: Monitoramento RF <alertas@seudominio.com>.
   - ALERT_EMAIL_TO: tipo Secret; destinatário(s) separados por vírgulas.
5. Abra https://consultoriarf.net/monitoramento/ e atualize o painel.
   O bloco "Alertas automáticos por e-mail" mostrará "E-mail configurado".
   Isso confirma o preenchimento, não a entrega: valide o primeiro envio real.

**Comportamento:** Queda após 3 verificações consecutivas sem resposta
(~15 minutos ou mais); recuperação ao primeiro teste de sucesso; sem repetição
de alertas enquanto a API permanece offline; até 3 tentativas quando houver
erro no provedor. Incidentes anteriores à primeira configuração não são
enviados retroativamente. O painel diferencia um e-mail aceito para envio
pela Resend de uma entrega na caixa de entrada (não há confirmação de entrega).

Se os e-mails não chegarem, verifique spam e a última falha exibida
no painel. Não configure tokens em arquivos públicos ou no HTML.
