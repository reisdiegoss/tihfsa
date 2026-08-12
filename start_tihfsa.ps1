<#
.SYNOPSIS
Script para iniciar o backend e o frontend do sistema TIHFSA sequencialmente com validação.
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Iniciando TIHFSA (Fasano Salvador)     " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 0. Limpar processos anteriores
function Stop-Existing-Services {
    Write-Host "[0/4] Verificando e encerrando processos anteriores (Portas 8000 e 5173)..." -ForegroundColor Yellow
    $Ports = @(8000, 5173)
    foreach ($Port in $Ports) {
        try {
            $Conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
            if ($Conns) {
                foreach ($Conn in $Conns) {
                    $ProcId = $Conn.OwningProcess
                    if ($ProcId -gt 0) {
                        Write-Host "   -> Encerrando processo na porta $Port (PID: $ProcId)..." -ForegroundColor DarkYellow
                        Stop-Process -Id $ProcId -Force -ErrorAction SilentlyContinue
                    }
                }
            }
        } catch {
            # Ignorar exceções
        }
    }
    Start-Sleep -Seconds 1
}

Stop-Existing-Services

# 1. Iniciar o Backend
Write-Host "[1/4] Iniciando o servidor Backend (FastAPI)..." -ForegroundColor Yellow
$BackendDir = Join-Path $ProjectRoot "backend"

# Iniciar o backend em um job/processo separado para não travar o terminal
Start-Process -NoNewWindow -FilePath "powershell.exe" -ArgumentList "-Command `"cd '$BackendDir'; .\venv\Scripts\activate; py -m uvicorn app.main:app --host localhost --port 8000 --reload`""

# 2. Validar o Backend
Write-Host "[2/4] Validando inicialização do Backend..." -ForegroundColor Yellow
$BackendUrl = "http://localhost:8000/"
$MaxRetries = 30
$RetryCount = 0
$BackendReady = $false

while ($RetryCount -lt $MaxRetries) {
    try {
        $response = Invoke-RestMethod -Uri $BackendUrl -Method Get -TimeoutSec 2
        if ($response.status -eq "online" -or $response.status -eq "OK") {
            $BackendReady = $true
            break
        }
    } catch {
        # Ignorar o erro, o backend ainda está subindo
    }
    
    Start-Sleep -Seconds 1
    $RetryCount++
    Write-Host "." -NoNewline
}
Write-Host ""

if (-not $BackendReady) {
    Write-Host "[ERRO] Backend não respondeu após 30 segundos! Abortando." -ForegroundColor Red
    exit 1
}

Write-Host "[SUCESSO] Backend iniciado e validado!" -ForegroundColor Green
Write-Host ""

# 3. Iniciar o Frontend
Write-Host "[3/4] Iniciando o servidor Frontend (Vite)..." -ForegroundColor Yellow
$FrontendDir = Join-Path $ProjectRoot "frontend"

Start-Process -NoNewWindow -FilePath "powershell.exe" -ArgumentList "-Command `"cd '$FrontendDir'; npm run dev`""

# 4. Validar o Frontend
Write-Host "[4/4] Validando inicialização do Frontend..." -ForegroundColor Yellow
$FrontendUrl = "http://localhost:5173/"
$RetryCount = 0
$FrontendReady = $false

while ($RetryCount -lt 30) {
    try {
        $req = Invoke-WebRequest -Uri $FrontendUrl -Method Get -UseBasicParsing -TimeoutSec 2
        if ($req.StatusCode -eq 200) {
            $FrontendReady = $true
            break
        }
    } catch {
        # Ignorar
    }
    
    Start-Sleep -Seconds 1
    $RetryCount++
    Write-Host "." -NoNewline
}
Write-Host ""

if (-not $FrontendReady) {
    Write-Host "[ERRO] Frontend não respondeu após 30 segundos! Verifique o console." -ForegroundColor Red
    exit 1
}

Write-Host "[SUCESSO] Frontend iniciado e validado!" -ForegroundColor Green
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "SISTEMA TIHFSA OPERACIONAL!" -ForegroundColor Cyan
Write-Host "Backend: $BackendUrl" -ForegroundColor Cyan
Write-Host "Frontend: $FrontendUrl" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Pressione qualquer tecla para sair deste script, os serviços continuarão em background." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
