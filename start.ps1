<#
.SYNOPSIS
    Script de Inicialização Completa do TIHFSA
.DESCRIPTION
    Este script inicia o Backend (FastAPI) e o Frontend (React/Vite) em processos paralelos,
    validando ativamente se as portas estão respondendo antes de avançar.
#>

$ErrorActionPreference = "Stop"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  TIHFSA - Hotel Fasano Salvador" -ForegroundColor Yellow
Write-Host "  Inicializador Automático de Sistema" -ForegroundColor Yellow
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Matar processos antigos (opcional, mas recomendado para evitar portas presas)
Write-Host "[*] Limpando processos antigos (uvicorn, node)..." -ForegroundColor DarkGray
Stop-Process -Name "uvicorn" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

# 2. Iniciar o Backend
Write-Host "[*] Iniciando o Servidor Backend (FastAPI)..." -ForegroundColor White
Start-Process -FilePath "powershell" -ArgumentList "-Command `"cd backend; .\venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --port 8000`"" -WindowStyle Minimized

# Validar Backend
Write-Host "[*] Aguardando validação do Backend na porta 8000..." -NoNewline -ForegroundColor White
$backend_ready = $false
$retry_count = 0
$max_retries = 30 # 30 segundos no máximo

while (-not $backend_ready -and $retry_count -lt $max_retries) {
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/" -Method Get -TimeoutSec 1 -ErrorAction Stop
        if ($response.status -eq "online") {
            $backend_ready = $true
        }
    } catch {
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline -ForegroundColor DarkGray
        $retry_count++
    }
}

if ($backend_ready) {
    Write-Host " [OK]" -ForegroundColor Green
    Write-Host "[+] Backend validado e respondendo corretamente!" -ForegroundColor Green
} else {
    Write-Host " [FALHA]" -ForegroundColor Red
    Write-Host "[-] O Backend não respondeu após 30 segundos. Abortando inicialização." -ForegroundColor Red
    exit 1
}

Write-Host ""

# 3. Iniciar o Frontend
Write-Host "[*] Iniciando o Servidor Frontend (React/Vite)..." -ForegroundColor White
Start-Process -FilePath "powershell" -ArgumentList "-Command `"cd frontend; npm run dev`"" -WindowStyle Minimized

# Validar Frontend
Write-Host "[*] Aguardando validação do Frontend na porta 5173..." -NoNewline -ForegroundColor White
$frontend_ready = $false
$retry_count = 0
$max_retries = 30

while (-not $frontend_ready -and $retry_count -lt $max_retries) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173/" -Method Get -TimeoutSec 1 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $frontend_ready = $true
        }
    } catch {
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline -ForegroundColor DarkGray
        $retry_count++
    }
}

if ($frontend_ready) {
    Write-Host " [OK]" -ForegroundColor Green
    Write-Host "[+] Frontend validado e respondendo corretamente!" -ForegroundColor Green
} else {
    Write-Host " [FALHA]" -ForegroundColor Red
    Write-Host "[-] O Frontend não respondeu após 30 segundos. Abortando inicialização." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " SISTEMA INICIALIZADO COM SUCESSO!" -ForegroundColor Green
Write-Host " Abrindo o portal no navegador padrão..." -ForegroundColor White
Write-Host "===============================================" -ForegroundColor Cyan
Start-Sleep -Seconds 2

# Abrir no navegador padrão
Start-Process "http://localhost:5173"
