# Apps Script — CONSULTORIA.RF | Gestão de Custos

Esta pasta é a fonte versionada do backend Google Apps Script do SITE DE CUSTOS.

## Fluxo oficial

- O backend atual pode ser importado pelo workflow **Apps Script Import**.
- Alterações em arquivos .js/.json desta pasta disparam o workflow **Apps Script Sync**.
- O Sync executa `clasp push --force` e atualiza o deployment Web App atualmente usado pelo frontend.
- O frontend continua publicado pelo GitHub Pages deste repositório.

## Configuração protegida do repositório

Os workflows usam os secrets:

- `CLASPRC_JSON`: credencial OAuth do clasp.
- `APPS_SCRIPT_ID`: Script ID do projeto Google Apps Script ligado ao DB_CUSTOS.

O Deployment ID de produção já está fixado no workflow para preservar a URL utilizada pelo sistema.

> Não salvar `.clasprc.json`, tokens OAuth ou outras credenciais dentro do repositório.
