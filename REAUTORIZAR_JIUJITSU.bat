@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Reautorizar Google e Publicar Jiu-Jitsu
color 0A

echo ============================================================
echo   JIU-JITSU - REAUTORIZACAO DO GOOGLE APPS SCRIPT
echo ============================================================
echo.
echo Este processo vai:
echo   1. Reautorizar o Google Apps Script ^(clasp^)
echo   2. Atualizar o secret CLASPRC_JSON no GitHub
echo   3. Disparar o deploy do backend do Jiu-Jitsu
echo.
echo Voce so precisara confirmar os logins no navegador.
echo.
pause

echo.
echo [1/6] Verificando Node/NPM...
where npm >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js/NPM nao encontrado.
  pause
  exit /b 1
)

echo [2/6] Verificando clasp...
where clasp.cmd >nul 2>&1
if errorlevel 1 (
  echo clasp nao encontrado. Instalando...
  call npm install -g @google/clasp@3.4.1
  if errorlevel 1 (
    echo ERRO ao instalar clasp.
    pause
    exit /b 1
  )
)

echo.
echo [3/6] Reautorizando Google...
echo Entre na mesma conta Google que e dona do Apps Script do Jiu-Jitsu.
echo.
echo Limpando autorizacao antiga...
call clasp.cmd logout >nul 2>&1
echo.
echo O clasp vai mostrar um link abaixo.
echo 1. Abra o link no navegador.
echo 2. Autorize a conta Google.
echo 3. Copie o codigo/endereco final solicitado e cole aqui no CMD.
echo.
call clasp.cmd login --no-localhost
if errorlevel 1 (
  echo ERRO: a autorizacao Google nao foi concluida.
  pause
  exit /b 1
)

echo.
echo Conferindo conta autorizada...
call clasp.cmd show-authorized-user
if errorlevel 1 (
  echo ERRO: nao foi possivel confirmar a conta Google.
  pause
  exit /b 1
)

if not exist "%USERPROFILE%\.clasprc.json" (
  echo ERRO: arquivo .clasprc.json nao foi criado.
  pause
  exit /b 1
)

echo.
echo [4/6] Verificando GitHub CLI...
set "GH_EXE="
where gh.exe >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%G in ('where gh.exe') do if not defined GH_EXE set "GH_EXE=%%G"
)

if not defined GH_EXE (
  if exist "C:\Program Files\GitHub CLI\gh.exe" set "GH_EXE=C:\Program Files\GitHub CLI\gh.exe"
)

if not defined GH_EXE (
  where winget >nul 2>&1
  if errorlevel 1 (
    echo ERRO: GitHub CLI nao encontrado e winget nao esta disponivel.
    pause
    exit /b 1
  )
  echo GitHub CLI nao encontrado. Instalando...
  winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements
  if exist "C:\Program Files\GitHub CLI\gh.exe" set "GH_EXE=C:\Program Files\GitHub CLI\gh.exe"
)

if not defined GH_EXE (
  echo ERRO: GitHub CLI nao localizado apos instalacao.
  pause
  exit /b 1
)

echo.
echo [5/6] Atualizando autorizacao no GitHub...
"%GH_EXE%" auth status -h github.com >nul 2>&1
if errorlevel 1 (
  echo O navegador sera aberto para autorizar o GitHub.
  "%GH_EXE%" auth login --web -h github.com -p https
  if errorlevel 1 (
    echo ERRO: login no GitHub nao concluido.
    pause
    exit /b 1
  )
)

type "%USERPROFILE%\.clasprc.json" | "%GH_EXE%" secret set CLASPRC_JSON --repo richardfinardi/richardfinardi.github.io
if errorlevel 1 (
  echo ERRO ao atualizar o secret CLASPRC_JSON.
  pause
  exit /b 1
)

echo.
echo [6/6] Disparando deploy do Jiu-Jitsu...
"%GH_EXE%" workflow run jiujitsu-apps-script-sync.yml --repo richardfinardi/richardfinardi.github.io
if errorlevel 1 (
  echo ERRO ao disparar workflow.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   REAUTORIZACAO CONCLUIDA
echo ============================================================
echo.
echo Aguarde cerca de 1 minuto.
echo Depois teste novamente consultoriarf.net/jiujitsu/
echo.
pause
endlocal
