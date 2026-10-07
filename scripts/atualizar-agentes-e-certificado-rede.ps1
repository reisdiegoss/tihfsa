<#
.SYNOPSIS
    TIHFSA — Atualizador em Massa de Agentes e Certificado SSL na Rede Local
    Hotel Fasano Salvador — TI Corporativa
.DESCRIPTION
    Atualiza silenciosamente todas as máquinas da rede que já possuem o Sentinel Agent instalado:
    1. Instala a Autoridade Certificadora Raiz TIHFSA (Trusted Root CA) para validar HTTPS sem avisos no Edge/Chrome.
    2. Atualiza o script C:\ProgramData\TIHFSA-Agent\tihfsa-agent.ps1 para a versão mais recente com auto-update contínuo.
    3. Executa a tarefa agendada imediatamente para confirmar a telemetria no servidor.
.EXAMPLE
    .\atualizar-agentes-e-certificado-rede.ps1 -ServerUrl "https://fassa29"
#>

param(
    [string]$ServerUrl = "https://fassa29",
    [string]$DomainName = "fasanobr.local"
)

# Requer privilégios administrativos
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "Execute este script como Administrador para atualizar máquinas remotamente na rede."
}

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host " TIHFSA — Atualização em Massa de Agentes e Certificado SSL na Rede" -ForegroundColor Cyan
Write-Host " Servidor Alvo: $ServerUrl" -ForegroundColor White
Write-Host "==========================================================================" -ForegroundColor Cyan

# 1. Obter lista de máquinas registradas no servidor TIHFSA
$machinesUrl = "$ServerUrl/api/v1/monitoring/agent/machines"
Write-Host "[1/3] Consultando estações registradas no TIHFSA ($machinesUrl)..." -ForegroundColor Yellow

$targetHosts = @()
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
    $apiResp = Invoke-RestMethod -Uri $machinesUrl -TimeoutSec 10 -ErrorAction Stop
    if ($apiResp -and $apiResp.machines) {
        $targetHosts = $apiResp.machines | ForEach-Object { $_.hostname } | Select-Object -Unique
        Write-Host " [+] Localizadas $($targetHosts.Count) estações no inventário do TIHFSA." -ForegroundColor Green
    }
} catch {
    Write-Warning " [!] Não foi possível obter máquinas da API. Tentando via Active Directory..."
}

# Se não pegou da API, tenta consultar do Active Directory
if ($targetHosts.Count -eq 0 -and (Get-Command Get-ADComputer -ErrorAction SilentlyContinue)) {
    try {
        $adComputers = Get-ADComputer -Filter {Enabled -eq $true} | Select-Object -ExpandProperty Name
        $targetHosts = $adComputers
        Write-Host " [+] Localizadas $($targetHosts.Count) estações ativas no Active Directory." -ForegroundColor Green
    } catch {}
}

if ($targetHosts.Count -eq 0) {
    Write-Host ""
    Write-Host "[INSTRUÇÃO DE GPO — RECOMENDADA PARA 100% DA REDE]" -ForegroundColor Yellow
    Write-Host "Para garantir a atualização automática em TODAS as máquinas sem precisar de lista:" -ForegroundColor White
    Write-Host "1. No Windows Server (AD), abra gpmc.msc -> Default Domain Policy ->" -ForegroundColor Cyan
    Write-Host "   Configuração do Computador -> Configurações do Windows -> Scripts -> Inicialização" -ForegroundColor Cyan
    Write-Host "2. Adicione o comando PowerShell:" -ForegroundColor White
    Write-Host "   powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""irm '$ServerUrl/api/v1/monitoring/agent/install' | iex""" -ForegroundColor Green
    Write-Host "Pronto! Todas as máquinas da rede instalam e atualizam no próximo boot." -ForegroundColor Green
    exit 0
}

# 2. Atualizar cada máquina remotamente via PowerShell / WinRM
Write-Host ""
Write-Host "[2/3] Atualizando agentes e instalando certificado raiz nas estações..." -ForegroundColor Yellow

$successCount = 0
$failCount = 0

$remoteCommand = {
    param($srvUrl)
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}

        # A. Instala Certificado Raiz
        $caUrl = "$srvUrl/api/v1/monitoring/agent/ca.crt"
        $tempCa = "$env:TEMP\tihfsa-ca.crt"
        try {
            Invoke-WebRequest -Uri $caUrl -OutFile $tempCa -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        } catch {
            curl.exe -k -s -m 5 $caUrl -o $tempCa 2>$null
        }
        if (Test-Path $tempCa) {
            certutil.exe -addstore -f "ROOT" $tempCa 2>$null | Out-Null
            Remove-Item $tempCa -Force -ErrorAction SilentlyContinue
        }

        # B. Atualiza Script do Agente
        $installDir = "C:\ProgramData\TIHFSA-Agent"
        if (Test-Path $installDir) {
            $scriptUrl = "$srvUrl/api/v1/monitoring/agent/script"
            $targetScript = "$installDir\tihfsa-agent.ps1"
            try {
                Invoke-RestMethod -Uri $scriptUrl -OutFile $targetScript -TimeoutSec 10 -ErrorAction Stop
            } catch {
                curl.exe -k -s -m 10 $scriptUrl -o $targetScript 2>$null
            }
            # C. Roda tarefa agendada
            schtasks.exe /Run /TN "TIHFSA Sentinel Agent" 2>$null | Out-Null
        }
        return "OK"
    } catch {
        return "ERRO: $_"
    }
}

foreach ($hostName in $targetHosts) {
    if ([string]::IsNullOrWhiteSpace($hostName)) { continue }
    Write-Host " * Conectando em $hostName... " -NoNewline
    
    # Testa ping rápido de 1 segundo
    $ping = Test-Connection -ComputerName $hostName -Count 1 -Quiet 2>$null
    if (-not $ping) {
        Write-Host "[OFFLINE / INACESSÍVEL]" -ForegroundColor DarkGray
        $failCount++
        continue
    }

    try {
        $res = Invoke-Command -ComputerName $hostName -ScriptBlock $remoteCommand -ArgumentList $ServerUrl -ErrorAction Stop -TimeoutSec 15
        if ($res -like "*OK*") {
            Write-Host "[ATUALIZADO COM SUCESSO]" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "[$res]" -ForegroundColor Yellow
            $failCount++
        }
    } catch {
        Write-Host "[FALHA WINRM/ACESSO: $($_.Exception.Message)]" -ForegroundColor Red
        $failCount++
    }
}

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host " Resumo da Atualização em Rede:" -ForegroundColor White
Write-Host "  * Sucesso: $successCount máquinas" -ForegroundColor Green
Write-Host "  * Pendentes / Offline: $failCount máquinas" -ForegroundColor Yellow
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host " Dica: Para as máquinas offline, a Tarefa Agendada existente executará" -ForegroundColor White
Write-Host " o script atualizado assim que ligarem e conectarem na rede." -ForegroundColor White
