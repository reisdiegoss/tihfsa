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
    [string]$ServerUrl = "https://192.168.168.29/api/v1/monitoring/agent/checkin",
    [string]$AgentSecret = "tihfsa-agent-token-fasano-2026"
)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}

function Test-IsAdminOrServiceAccount {
    param([string]$AccountName)
    if ([string]::IsNullOrWhiteSpace($AccountName)) { return $true }
    $clean = ($AccountName -split '\\')[-1].Trim().ToLower()
    $blackList = @('system', 'local service', 'network service', 'administrator', 'administrador', 'root', 'defaultuser0', 'guest', 'convidado')
    if ($blackList -contains $clean) { return $true }
    if ($clean -like 'adm_*' -or $clean -like 'adm-*' -or $clean -like 'suporte*' -or $clean -like 'admin*') { return $true }
    return $false
}

function Get-LoggedUser {
    $detectedUser = $null

    # Camada 1: Proprietário do processo explorer.exe da sessão interativa gráfica
    # Garante que mesmo com o script rodando como Administrador ou SYSTEM, pega o usuário na tela
    try {
        $explorers = Get-CimInstance Win32_Process -Filter "Name = 'explorer.exe'" -ErrorAction SilentlyContinue
        foreach ($proc in $explorers) {
            $owner = Invoke-CimMethod -InputObject $proc -MethodName GetOwner -ErrorAction SilentlyContinue
            if ($owner -and $owner.User) {
                $candidate = if ($owner.Domain) { "$($owner.Domain)\$($owner.User)" } else { $owner.User }
                if (-not (Test-IsAdminOrServiceAccount $candidate)) {
                    return $candidate
                }
                if (-not $detectedUser) { $detectedUser = $candidate }
            }
        }
    } catch {}

    # Camada 2: Sessão de console interativo via Win32_ComputerSystem
    try {
        $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
        if ($cs.UserName) {
            if (-not (Test-IsAdminOrServiceAccount $cs.UserName)) {
                return $cs.UserName
            }
            if (-not $detectedUser) { $detectedUser = $cs.UserName }
        }
    } catch {}

    # Camada 3: Sessão de console ativa via query user
    try {
        $quser = query user 2>$null | Select-Object -Skip 1
        foreach ($line in $quser) {
            $parts = $line.Trim() -split '\s+'
            if ($parts.Count -ge 2) {
                $u = $parts[0].Replace('>', '').Trim()
                if (-not (Test-IsAdminOrServiceAccount $u)) {
                    return $u
                }
            }
        }
    } catch {}

    # Camada 4: Registro do Windows (Último usuário real logado — ótimo se rodar no boot antes do login)
    try {
        $lastLogon = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Authentication\LogonUI" -ErrorAction SilentlyContinue).LastLoggedOnUser
        if ($lastLogon -and (-not (Test-IsAdminOrServiceAccount $lastLogon))) {
            return $lastLogon
        }
        $defUser = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" -ErrorAction SilentlyContinue).DefaultUserName
        if ($defUser -and (-not (Test-IsAdminOrServiceAccount $defUser))) {
            return $defUser
        }
    } catch {}

    # Fallback seguro
    if ($detectedUser) { return $detectedUser }
    return $env:USERNAME
}

function Get-SystemMetrics {
    # CPU
    $cpu = 0
    $cpuModel = ""
    try {
        $proc = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($proc) {
            $cpuModel = $proc.Name.Trim()
            $cpuAvg = (Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Measure-Object -Property LoadPercentage -Average).Average
            $cpu = [int]$cpuAvg
        }
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

    # Discos Lógicos (Partições locais C:, D:, etc.)
    $disks = @()
    try {
        $disks = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue | ForEach-Object {
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
        })
    } catch {}

    # Discos Físicos (Hardware SSD, NVMe, HDD)
    $physicalDisks = @()
    try {
        $pDisks = Get-PhysicalDisk -ErrorAction SilentlyContinue
        if ($pDisks) {
            $physicalDisks = @($pDisks | ForEach-Object {
                $mType = if ($_.MediaType -and $_.MediaType -ne "Unspecified") { $_.MediaType } else { "SSD" }
                $szGb = [math]::Round($_.Size / 1GB, 0)
                @{
                    model      = $_.FriendlyName.Trim()
                    media_type = $mType
                    size_gb    = $szGb
                }
            })
        }
    } catch {}
    if ($physicalDisks.Count -eq 0) {
        try {
            $physicalDisks = @(Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | ForEach-Object {
                $szGb = [math]::Round($_.Size / 1GB, 0)
                $isSsd = ($_.Model -like "*SSD*" -or $_.MediaType -like "*SSD*")
                @{
                    model      = $_.Model.Trim()
                    media_type = if ($isSsd) { "SSD" } else { "Disco" }
                    size_gb    = $szGb
                }
            })
        } catch {}
    }

    # Endereço IPv4 Ativo & MAC Address
    $ipAddress = "unknown"
    $macAddress = $null
    try {
        $ipInfo = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Ethernet*","Wi-Fi*" -ErrorAction SilentlyContinue |
                  Where-Object { $_.IPAddress -notlike "169.254*" -and $_.IPAddress -ne "127.0.0.1" } |
                  Select-Object -First 1
        if ($ipInfo) {
            $ipAddress = $ipInfo.IPAddress
        }
        $netAdapter = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=True" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($netAdapter.MACAddress) {
            $macAddress = $netAdapter.MACAddress.Trim()
        }
    } catch {}

    # Hardware para CMDB (Assets)
    $brand = "Desconhecido"
    $model = "Desconhecido"
    $serialNumber = "Desconhecido"
    $deviceType = "Desktop"

    try {
        $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
        if ($cs.Manufacturer) { $brand = $cs.Manufacturer.Trim() }
        if ($cs.Model) { $model = $cs.Model.Trim() }
    } catch {}

    try {
        $bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue
        if ($bios.SerialNumber) { $serialNumber = $bios.SerialNumber.Trim() }
    } catch {}

    try {
        $battery = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue
        if ($null -ne $battery) {
            $deviceType = "Notebook"
        } else {
            $enclosure = Get-CimInstance Win32_SystemEnclosure -ErrorAction SilentlyContinue
            if ($enclosure.ChassisTypes) {
                $portableTypes = @(8, 9, 10, 11, 12, 14, 18, 21, 31, 32)
                foreach ($ct in $enclosure.ChassisTypes) {
                    if ($portableTypes -contains [int]$ct) {
                        $deviceType = "Notebook"
                        break
                    }
                }
            }
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
        hostname       = $env:COMPUTERNAME
        logged_user    = Get-LoggedUser
        ip_address     = $ipAddress
        cpu_usage_pct  = $cpu
        cpu_model      = $cpuModel
        ram_used_mb    = $ramUsedMB
        ram_total_mb   = $ramTotalMB
        ram_usage_pct  = $ramPct
        disks          = [object[]]@($disks)
        physical_disks = [object[]]@($physicalDisks)
        uptime_hours   = $uptimeHours
        os_name        = if ($os) { $os.Caption } else { "Windows" }
        brand          = $brand
        model          = $model
        serial_number  = $serialNumber
        mac_address    = $macAddress
        device_type    = $deviceType
    }
}

# Execução do Check-in
$payloadObj = Get-SystemMetrics
$payloadJson = $payloadObj | ConvertTo-Json -Depth 4
$headers = @{
    "Content-Type"  = "application/json"
    "X-Agent-Token" = $AgentSecret
}

try {
    $response = Invoke-RestMethod -Uri $ServerUrl -Method POST -Body $payloadJson -Headers $headers -TimeoutSec 10
    Write-Host "[OK] TIHFSA Sentinel Agent: Telemetria enviada com sucesso para $ServerUrl ($($payloadObj.hostname) - $($payloadObj.logged_user))" -ForegroundColor Green
} catch {
    try {
        # Fallback resiliente via curl.exe nativo do Windows
        $curlOut = $payloadJson | curl.exe -k -s -X POST -H "Content-Type: application/json" -H "X-Agent-Token: $AgentSecret" --data-binary "@-" $ServerUrl
        if ($curlOut -like '*"status":"ok"*') {
            Write-Host "[OK] TIHFSA Sentinel Agent: Telemetria enviada com sucesso via curl ($($payloadObj.hostname) - $($payloadObj.logged_user))" -ForegroundColor Green
        } else {
            Write-Warning "[AVISO] Falha ao enviar telemetria: $curlOut"
        }
    } catch {
        Write-Error "[ERRO] Não foi possível conectar ao servidor $ServerUrl : $_"
    }
}
