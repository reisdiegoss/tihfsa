@echo off
setlocal EnableDelayedExpansion
title Instalador de Certificado Raiz TIHFSA - Hotel Fasano
cls
echo =====================================================================
echo   TIHFSA - Hotel Fasano Salvador
echo   Instalador de Autoridade Certificadora Raiz (Trusted Root CA)
echo =====================================================================
echo.

:: 1. Verificar se esta sendo executado como Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Permissao insuficiente!
    echo Este instalador precisa ser executado com privilegios de Administrador.
    echo.
    echo Por favor, clique com o botao direito neste arquivo e escolha:
    echo  "Executar como Administrador"
    echo.
    pause
    exit /b 1
)

:: 2. Localizar ou baixar o arquivo do certificado raiz
set "CERT_NAME=tihfsa-ca.crt"
set "CERT_PATH=%~dp0%CERT_NAME%"

if not exist "!CERT_PATH!" (
    set "CERT_PATH=%~dp0..\cert\%CERT_NAME%"
)

if not exist "!CERT_PATH!" (
    echo [INFO] Certificado local nao encontrado. Baixando do servidor fassa29...
    set "CERT_PATH=%temp%\%CERT_NAME%"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'http://fassa29/cert/tihfsa-ca.crt' -OutFile '!CERT_PATH!' -UseBasicParsing -TimeoutSec 5 } catch { try { Invoke-WebRequest -Uri 'http://192.168.168.29/cert/tihfsa-ca.crt' -OutFile '!CERT_PATH!' -UseBasicParsing -TimeoutSec 5 } catch { exit 1 } }"
)

if not exist "!CERT_PATH!" (
    echo [ERRO] Nao foi possivel localizar nem baixar o certificado tihfsa-ca.crt!
    echo Verifique se o servidor fassa29 esta acessivel na rede corporativa.
    echo.
    pause
    exit /b 1
)

echo [1/2] Instalando certificado na loja "Autoridades de Certificacao Raiz Confiaveis"...
certutil -addstore -f "ROOT" "!CERT_PATH!"

if %errorlevel% equ 0 (
    echo.
    echo =====================================================================
    echo   [SUCESSO] Certificado Raiz TIHFSA instalado com sucesso!
    echo =====================================================================
    echo.
    echo   Os navegadores (Microsoft Edge, Google Chrome) agora reconhecem
    echo   o servidor fassa29 como uma autoridade confiavel.
    echo.
    echo   URL de acesso seguro: https://fassa29/suporte
    echo.
    echo   Dica: Feche e abra o navegador para atualizar o status do cadeado.
    echo =====================================================================
) else (
    echo.
    echo [ERRO] O comando certutil retornou o codigo %errorlevel%.
)

echo.
pause
