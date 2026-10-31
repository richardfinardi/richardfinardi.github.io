# Sistema de Vagas · Condomínio Chácara das Flores

## Estrutura
- /vagas/index.html: aplicação web responsiva, acesso dos moradores e painel.
- /vagas/app.js: ações, formulários, fluxos de reserva e aprovações.
- /vagas/sw.js, manifest.webmanifest, icon.svg: atalho e PWA.
- /vagas/config.js: URL pública da API e ID público do serviço de notificações.
- /vagas/backend/Code.gs: backend Google Apps Script para banco Google Sheets.

## Google Sheets já criado
Banco: CHACARA_DAS_FLORES_VAGAS_DB
Local: Meu Drive / BANCO_DADOS
ID: 1baP2aPHfxocrl-vACXgYY7g46s1sks4PYmQ_yF-NNMw
Abas: MORADORES, VAGAS, DISPONIBILIDADES, RESERVAS, NOTIFICACOES, HISTORICO, SESSOES, CONFIG, LISTA_ESPERA.

## Ativação obrigatória da API (não foi implantada automaticamente)
GitHub Pages hospeda o frontend, mas não executa Google Apps Script. Por segurança, a URL do backend não foi inventada e nenhuma operação é simulada como reserva real.

1. Abra a planilha do Google Sheets acima e selecione Extensões > Apps Script.
2. Cole o conteúdo de backend/Code.gs no arquivo Code.gs.
3. Defina o fuso horário do projeto como America/Sao_Paulo.
4. Em Configurações do projeto > Propriedades do script, configure:
   - ADMIN_EMAIL: e-mail do administrador inicial
   - BOOTSTRAP_CODE: código forte e exclusivo para cadastrar o administrador
   - REGISTRATION_CODE: código separado distribuído aos moradores
   - opcionais ONESIGNAL_APP_ID e ONESIGNAL_REST_API_KEY para push
5. Implante > Nova implantação > Aplicativo da Web. Executar como "Eu" (proprietário do Sheets). Quem tem acesso: "Qualquer pessoa". O backend valida senha, sessão e autorização do morador em cada operação.
6. Copie a URL terminada em /exec e coloque em config.js na variável pública VAGAS_API_URL.
7. Abra https://consultoriarf.net/vagas/ para cadastrar o administrador usando seu ADMIN_EMAIL e BOOTSTRAP_CODE.
8. Cadastros com REGISTRATION_CODE ficam pendentes até aprovação administrativa no painel.
9. No editor Apps Script, execute uma vez setupTriggers() e autorize o gatilho para lembretes de reservas e avisos de atraso a cada 15 minutos.

## Atalho na tela inicial e notificações
Android: abra o site no Chrome, toque em Instalar aplicativo ou no menu Adicionar à tela inicial.
iPhone: Safari > Compartilhar > Adicionar à Tela de Início.
Para push web real, configure uma aplicação OneSignal no domínio https://consultoriarf.net; coloque seu ID público em VAGAS_ONESIGNAL_APP_ID no config.js e suas credenciais secretas somente nas Propriedades do Apps Script. O app usa o serviço worker /vagas/sw.js. No iPhone, Web Push exige iOS compatível e web app adicionado à tela inicial.

## Regras implementadas
- Cadastro de moradores sujeito à aprovação; painel do administrador.
- Autenticação por e-mail + PIN com hash+salt+pepper no servidor; sessão expira em 7 dias.
- Vagas próprias, publicação de disponibilidade por período e repetição semanal (4 semanas).
- Aprovação individual por disponibilidade: automática ou sob aprovação do proprietário.
- Reservas parciais na mesma vaga, sem sobreposição de períodos confirmados.
- LockService no servidor para evitar duplicidade simultânea.
- Check-in e checkout; avisos internos e chamadas opcionais ao OneSignal.
- Limite de duas reservas ativas e proibição de reservar vaga própria.
- Acesso do morador restrito aos seus dados e reservas.
- Encerramento de disponibilidade impedido enquanto houver reservas ativas.
- Lista de espera com alerta quando surgir uma vaga, sem reserva automática.
- Prorrogação de reserva se houver intervalo e a disponibilidade for de aprovação automática.
- Painel de portaria para administradores com reservas confirmadas e em uso.
- Lembretes de início e atraso via gatilho do Apps Script, após executar setupTriggers().
- Código-fonte e banco estão separados; nenhum segredo deve ficar no GitHub público.

## Antes de liberar para o condomínio
Testar cadastro/primeiro administrador, horário local, conflito de reservas, duas solicitações simultâneas, aprovação, cancelamento e push em Android/iOS. É necessário definir política de privacidade, consentimento e retenção de dados LGPD. Google Sheets + Apps Script é adequado para piloto controlado, mas pode ser insuficiente para alto volume ou autenticação de maior criticidade.

## Pendências explícitas
API Apps Script não implantada, configuração do OneSignal não fornecida, testes ponta a ponta com o domínio ainda não realizados. A interface exibe aviso e não registra reservas reais até que o servidor esteja ativado.