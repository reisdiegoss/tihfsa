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
    $vcpuCount = 0
    try {
        $proc = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $proc) {
            $proc = Get-WmiObject Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
        }
        if ($proc) {
            if ($proc.Name) { $cpuModel = $proc.Name.Trim() }
            if ($proc.NumberOfLogicalProcessors) { $vcpuCount = [int]$proc.NumberOfLogicalProcessors }
            if ($proc.LoadPercentage -ne $null) { $cpu = [int]$proc.LoadPercentage }
        }
    } catch {}

    # Fallback ultra-resiliente para CPU e vCPU (Funciona 100% em qualquer Windows Server ou Workstation)
    if (-not $cpuModel) {
        try {
            $regCpu = (Get-ItemProperty -Path "HKLM:\HARDWARE\DESCRIPTION\System\CentralProcessor\0" -Name "ProcessorNameString" -ErrorAction SilentlyContinue).ProcessorNameString
            if ($regCpu) { $cpuModel = $regCpu.Trim() }
        } catch {}
    }
    if ($vcpuCount -eq 0) {
        try {
            $vcpuCount = [int]$env:NUMBER_OF_PROCESSORS
        } catch {}
    }

    $os = $null
    $ramTotalMB = 0
    $ramUsedMB = 0
    $ramPct = 0.0
    try {
        $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
        if (-not $os) {
            $os = Get-WmiObject Win32_OperatingSystem -ErrorAction SilentlyContinue
        }
        if ($os -and $os.TotalVisibleMemorySize) {
            $ramTotalMB = [math]::Round($os.TotalVisibleMemorySize / 1024, 0)
            $ramFreeMB = [math]::Round($os.FreePhysicalMemory / 1024, 0)
            $ramUsedMB = $ramTotalMB - $ramFreeMB
        }
    } catch {}

    # Fallback de RAM via ComputerSystem / PhysicalMemory caso Win32_OperatingSystem venha zerado
    if ($ramTotalMB -eq 0) {
        try {
            $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
            if (-not $cs) { $cs = Get-WmiObject Win32_ComputerSystem -ErrorAction SilentlyContinue }
            if ($cs -and $cs.TotalPhysicalMemory) {
                $ramTotalMB = [math]::Round($cs.TotalPhysicalMemory / 1MB, 0)
            }
        } catch {}
        if ($ramTotalMB -eq 0) {
            try {
                $pmSum = (Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue | Measure-Object -Property Capacity -Sum).Sum
                if ($pmSum) { $ramTotalMB = [math]::Round($pmSum / 1MB, 0) }
            } catch {}
        }
    }

    if ($ramTotalMB -gt 0 -and $ramUsedMB -gt 0) {
        $ramPct = [math]::Round(($ramUsedMB / $ramTotalMB) * 100, 1)
    }

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

    # Detecção nativa de Windows Server (ProductType 2 ou 3)
    if ($os -and ($os.ProductType -in 2, 3 -or $os.Caption -like "*Server*")) {
        $deviceType = "Servidor"
    } else {
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
    }

    try {
        $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
        if ($cs.Manufacturer) { $brand = $cs.Manufacturer.Trim() }
        if ($cs.Model) { $model = $cs.Model.Trim() }
    } catch {}

    try {
        $bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue
        if ($bios.SerialNumber) { $serialNumber = $bios.SerialNumber.Trim() }
    } catch {}

    # Uptime em horas
    $uptimeHours = 0.0
    try {
        if ($os -and $os.LastBootUpTime) {
            $uptimeHours = [math]::Round((((Get-Date) - $os.LastBootUpTime).TotalHours), 1)
        }
    } catch {}

    # Chave de Ativação do Windows (BIOS OA3 / MSDM)
    $winKey = ""
    try {
        $oa3 = (Get-CimInstance SoftwareLicensingService -ErrorAction SilentlyContinue).OA3xOriginalProductKey
        if ($oa3) { $winKey = $oa3.Trim() }
    } catch {}

    # Licença, Versão e Chave de Ativação do Microsoft Office
    $officeVer = ""
    $officeKey = ""
    $officeStatus = ""

    $osppPaths = @(
        "$env:ProgramFiles\Microsoft Office\Office16\ospp.vbs",
        "${env:ProgramFiles(x86)}\Microsoft Office\Office16\ospp.vbs",
        "$env:ProgramFiles\Microsoft Office\Office15\ospp.vbs",
        "${env:ProgramFiles(x86)}\Microsoft Office\Office15\ospp.vbs"
    )

    foreach ($path in $osppPaths) {
        if (Test-Path $path) {
            try {
                $out = (& cscript //nologo $path /dstatus 2>$null) -join "`n"
                if ($out -match "LICENSE NAME:\s*([^\r\n]+)") {
                    $rawName = $matches[1].Trim()
                    if ($rawName -like "*HomeBusiness*") { $officeVer = "Microsoft Office Home & Business" }
                    elseif ($rawName -like "*ProPlus*") { $officeVer = "Microsoft Office Professional Plus" }
                    elseif ($rawName -like "*Standard*") { $officeVer = "Microsoft Office Standard" }
                    elseif ($rawName -like "*O365*" -or $rawName -like "*M365*") { $officeVer = "Microsoft 365 Apps" }
                    else { $officeVer = $rawName }
                    if ($rawName -match "Office\s*(20\d{2}|\d{2})") {
                        $verNum = $matches[1]
                        if ($verNum -eq "21" -or $verNum -eq "2021") { $officeVer += " 2021" }
                        elseif ($verNum -eq "19" -or $verNum -eq "2019") { $officeVer += " 2019" }
                        elseif ($verNum -eq "16" -or $verNum -eq "2016") { $officeVer += " 2016" }
                    }
                }
                if ($out -match "LICENSE STATUS:\s*([^\r\n]+)") {
                    $st = $matches[1].Trim()
                    $officeStatus = if ($st -like "*LICENSED*") { "Ativado (LICENSED)" } else { $st }
                }
                if ($out -match "Last 5 characters of installed product key:\s*([A-Z0-9]+)") {
                    $officeKey = "XXXXX-XXXXX-XXXXX-XXXXX-$($matches[1].Trim())"
                }
            } catch {}
            if ($officeKey -or $officeVer) { break }
        }
    }

    if (-not $officeVer) {
        try {
            $c2r = "HKLM:\SOFTWARE\Microsoft\Office\ClickToRun\Configuration"
            if (Test-Path $c2r) {
                $prop = Get-ItemProperty $c2r -ErrorAction SilentlyContinue
                if ($prop.ProductReleaseIds) {
                    $officeVer = "$($prop.ProductReleaseIds) $($prop.VersionToReport)".Trim()
                }
            }
        } catch {}
    }

    # Inventário Completo de Softwares / Programas Instalados (Painel de Controle / Registro)
    $installedApps = @()
    try {
        $uninstallPaths = @(
            "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
            "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
        )
        $rawApps = Get-ItemProperty $uninstallPaths -ErrorAction SilentlyContinue | Where-Object {
            $_.DisplayName -and ($_.SystemComponent -ne 1) -and ($_.ParentKeyName -eq $null) -and ($_.DisplayName -notmatch '^KB[0-9]+')
        } | Select-Object -Property DisplayName, DisplayVersion, Publisher, InstallDate | Sort-Object DisplayName -Unique
        
        foreach ($app in $rawApps) {
            $installedApps += @{
                name         = $app.DisplayName.Trim()
                version      = if ($app.DisplayVersion) { "$($app.DisplayVersion)".Trim() } else { "" }
                publisher    = if ($app.Publisher) { "$($app.Publisher)".Trim() } else { "" }
                install_date = if ($app.InstallDate) { "$($app.InstallDate)".Trim() } else { "" }
            }
        }
    } catch {}

    return @{
        hostname            = $env:COMPUTERNAME
        logged_user         = Get-LoggedUser
        ip_address          = $ipAddress
        cpu_usage_pct       = $cpu
        cpu_model           = $cpuModel
        vcpu_count          = [int]$vcpuCount
        ram_used_mb         = $ramUsedMB
        ram_total_mb        = $ramTotalMB
        ram_usage_pct       = $ramPct
        disks               = [object[]]@($disks)
        physical_disks      = [object[]]@($physicalDisks)
        uptime_hours        = $uptimeHours
        os_name             = if ($os -and $os.Caption) { $os.Caption } else { "Windows" }
        brand               = $brand
        model               = $model
        serial_number       = $serialNumber
        mac_address         = $macAddress
        device_type         = $deviceType
        windows_product_key = $winKey
        office_version      = $officeVer
        office_product_key  = $officeKey
        office_status       = $officeStatus
        installed_apps      = [object[]]@($installedApps)
    }
}

# Execução do Check-in
$payloadObj = Get-SystemMetrics
$payloadJson = $payloadObj | ConvertTo-Json -Depth 5
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
