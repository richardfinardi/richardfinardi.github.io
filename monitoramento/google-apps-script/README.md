# Alertas por e-mail com sua conta Google (sem Resend)

O monitoramento continua no **Cloudflare AUVRIUN**, verificando as APIs a cada 5 minutos.
Ao confirmar 3 falhas consecutivas, o Cloudflare envia um POST autenticado para este
Google Apps Script, que utiliza **MailApp** para enviar o alerta a partir da conta Google
que executou `configurarAlertas`. Na primeira recuperação, envia outro e-mail.
Não é necessário deixar o navegador ou computador ligado.

## Etapa única de autorização na sua conta Google

1. Abra https://script.google.com/home/projects/create com a conta Google desejada.
2. Nomeie o projeto **Monitoramento RF - Alertas**.
3. Substitua o conteúdo de `Código.gs` pelo arquivo `Codigo.gs` desta pasta.
4. Salve. Selecione `configurarAlertas` no menu superior e clique **Executar**.
5. Autorize o projeto a enviar e-mails pela sua conta. Ele mandará um e-mail de teste
   para **a própria conta Google que executou essa função**.
6. Abra **Registro de execução**. Copie somente para o Cloudflare o valor mostrado
   depois de `ALERT_WEBHOOK_TOKEN:`. Guarde o token em lugar seguro.
7. **Implantar > Nova implantação > Selecionar tipo > App da Web**.
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa** (a chave no POST protege os envios)
   - Clique em **Implantar**, autorize e copie a URL terminada em `/exec`.
8. No Cloudflare, conta **AUVRIUN > Workers & Pages > auvriun-api-monitor >
   Settings > Variables and Secrets**, adicione e implante:
   - `GOOGLE_APPS_SCRIPT_URL` = URL `.../exec` da etapa 7 (Secret).
   - `ALERT_WEBHOOK_TOKEN` = token da etapa 6 (Secret).
9. Abra https://consultoriarf.net/monitoramento/ e clique em **Atualizar painel**.
   Deve mostrar **Envio habilitado • Google Apps Script**.

**Importante:** o envio de teste na etapa 5 valida o Gmail, mas o envio Cloudflare →
Apps Script precisa ser validado na primeira ocorrência real ou em um teste controlado.
Se algo falhar, o painel registra a tentativa e o erro (sem divulgar a chave).

## Regras do envio

- Queda após 3 verificações consecutivas com falha (~15 minutos ou mais).
- Recuperação após 1 verificação bem-sucedida.
- Não repetir e-mails para o mesmo incidente.
- Até 3 tentativas se o Google falhar (o Apps Script também impede duplicação).
- Incidentes anteriores à ativação do canal não são enviados retroativamente.
- O Apps Script respeita cotas de envio do Google.

## Segurança

O Web App precisa estar acessível a qualquer pessoa para receber requisições do Cloudflare,
mas recusa eventos com token inválido. O token **não deve ser enviado ao ChatGPT**,
colado em arquivos do GitHub, na URL do Web App ou exibido no painel.
Se perder ou vazar a chave, gere um novo token em Script Properties e atualize o Cloudflare.
