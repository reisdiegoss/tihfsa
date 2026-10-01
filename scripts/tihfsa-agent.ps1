<#
.SYNOPSIS
    TIHFSA Sentinel Agent — Agente Nativo de Telemetria e Monitoramento de Estações.
    Hotel Fasano Salvador — Substituição Nativa do Zabbix Agent para Windows.

.DESCRIPTION
    Coleta dados de hardware (CPU, Memória, Disco), sistema (Uptime, OS),
    rede (IP, Hostname) e identifica o Usuário Ativo logado na máquina,
    enviando periodicamente para o backend do TIHFSA via HTTPS/REST.

.INSTALLATION (Executar como Administrador no PowerShell):
    # Instalar como Tarefa Agendada oculta que roda a cada 1 minuto:
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -NonInteractive -NoProfile -ExecutionPolicy Bypass -File C:\TIHFSA\tihfsa-agent.ps1"
    $Trigger = New-ScheduledTaskTrigger -AtStartup
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName "TIHFSASentinelAgent" -Action $Action -Trigger $Trigger -Settings $Settings -User "SYSTEM" -RunLevel Highest -Force
#>

param(
    [string]$ServerUrl = "http://192.168.168.26:8000/api/v1/monitoring/agent/checkin",
    [string]$AgentSecret = "tihfsa-agent-token-fasano-2026"
)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}

function Get-LoggedUser {
    try {
        # 1. Tentar capturar usuário interativo do console
        $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
        if ($cs.UserName) { return $cs.UserName }

        # 2. Fallback via query user
        $quser = query user 2>$null | Select-Object -Skip 1
        if ($quser) {
            $user = ($quser[0] -split '\s+')[1]
            return $user.Replace('>', '')
        }
    } catch {}

    # 3. Fallback para variável de ambiente da sessão
    return $env:USERNAME
}

function Get-SystemMetrics {
    # CPU
    $cpu = 0
    try {
        $cpuAvg = (Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Measure-Object -Property LoadPercentage -Average).Average
        $cpu = [int]$cpuAvg
    } catch {}

    # Memória RAM
    $ramTotalMB = 0
    $ramUsedMB = 0
    $ramPct = 0.0
    try {
        $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
        $ramTotalMB = [math]::Round($os.TotalVisibleMemorySize / 1024, 0)
        $ramFreeMB = [math]::Round($os.FreePhysicalMemory / 1024, 0)
        $ramUsedMB = $ramTotalMB - $ramFreeMB
        if ($ramTotalMB -gt 0) {
            $ramPct = [math]::Round(($ramUsedMB / $ramTotalMB) * 100, 1)
        }
    } catch {}

    # Discos Físicos (Locais)
    $disks = @()
    try {
        $disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue | ForEach-Object {
            $totalGB = [math]::Round($_.Size / 1GB, 1)
            $freeGB = [math]::Round($_.FreeSpace / 1GB, 1)
            $usedPct = 0
            if ($_.Size -gt 0) {
                $usedPct = [math]::Round((($_.Size - $_.FreeSpace) / $_.Size) * 100, 1)
            }
            @{
                drive    = $_.DeviceID
                total_gb = $totalGB
                free_gb  = $freeGB
                used_pct = $usedPct
            }
        }
    } catch {}

    # Endereço IPv4 Ativo
    $ipAddress = "unknown"
    try {
        $ipInfo = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Ethernet*","Wi-Fi*" -ErrorAction SilentlyContinue |
                  Where-Object { $_.IPAddress -notlike "169.254*" -and $_.IPAddress -ne "127.0.0.1" } |
                  Select-Object -First 1
        if ($ipInfo) {
            $ipAddress = $ipInfo.IPAddress
        }
    } catch {}

    # Uptime em horas
    $uptimeHours = 0.0
    try {
        if ($os.LastBootUpTime) {
            $uptimeHours = [math]::Round((((Get-Date) - $os.LastBootUpTime).TotalHours), 1)
        }
    } catch {}

    return @{
        hostname      = $env:COMPUTERNAME
        logged_user   = Get-LoggedUser
        ip_address    = $ipAddress
        cpu_usage_pct = $cpu
        ram_used_mb   = $ramUsedMB
        ram_total_mb  = $ramTotalMB
        ram_usage_pct = $ramPct
        disks         = $disks
        uptime_hours  = $uptimeHours
        os_name       = if ($os) { $os.Caption } else { "Windows" }
    }
}

# Execução do Check-in
try {
    $payloadObj = Get-SystemMetrics
    $payloadJson = $payloadObj | ConvertTo-Json -Depth 4
    $headers = @{
        "Content-Type"  = "application/json"
        "X-Agent-Token" = $AgentSecret
    }

    $response = Invoke-RestMethod -Uri $ServerUrl -Method POST -Body $payloadJson -Headers $headers -TimeoutSec 10
} catch {
    try {
        # Fallback resiliente via curl.exe nativo do Windows
        $payloadJson | curl.exe -k -s -X POST -H "Content-Type: application/json" -H "X-Agent-Token: $AgentSecret" --data-binary "@-" $ServerUrl | Out-Null
    } catch {}
}
