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
    [string]$AgentSecret = "tihfsa-agent-token-fasano-2026",
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$Silent,
    [int]$IntervalMinutes = 15
)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}

function Log-AgentMessage {
    param([string]$Message)
    try {
        $logDir = "C:\ProgramData\TIHFSA-Agent"
        if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
        $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        Add-Content -Path "$logDir\agent.log" -Value "[$timestamp] $Message" -ErrorAction SilentlyContinue
    } catch {}
}

function Ensure-TihfsaRootCertificate {
    param([string]$TargetServerUrl)
    try {
        # 1. Verifica se já está instalado no repositório confiável da máquina local
        $installed = Get-ChildItem Cert:\LocalMachine\Root -ErrorAction SilentlyContinue | Where-Object {
            $_.Subject -like "*TIHFSA Root*" -or $_.Issuer -like "*TIHFSA Root*"
        }
        if ($installed) { return $true }

        # 2. Se não estiver instalado, tenta baixar do servidor
        $serverBase = ($TargetServerUrl -split '/api/')[0]
        $candidateUrls = @(
            "$serverBase/api/v1/monitoring/agent/ca.crt",
            "$serverBase/cert/tihfsa-ca.crt",
            "http://fassa29/cert/tihfsa-ca.crt",
            "http://192.168.168.29/cert/tihfsa-ca.crt"
        )

        $tempCa = "$env:TEMP\tihfsa-ca.crt"
        $downloaded = $false
        foreach ($url in $candidateUrls) {
            try {
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
                Invoke-WebRequest -Uri $url -OutFile $tempCa -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
                if (Test-Path $tempCa) { $downloaded = $true; break }
            } catch {
                try {
                    curl.exe -k -s -m 5 $url -o $tempCa 2>$null
                    if (Test-Path $tempCa) { $downloaded = $true; break }
                } catch {}
            }
        }

        if ($downloaded -and (Test-Path $tempCa)) {
            try {
                $certObj = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($tempCa)
                $store = New-Object System.Security.Cryptography.X509Certificates.X509Store([System.Security.Cryptography.X509Certificates.StoreName]::Root, [System.Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine)
                $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
                $store.Add($certObj)
                $store.Close()
            } catch {
                certutil.exe -addstore -f "ROOT" $tempCa 2>$null | Out-Null
            }
            Remove-Item $tempCa -Force -ErrorAction SilentlyContinue
            Log-AgentMessage "[OK] Certificado Raiz TIHFSA instalado com sucesso na Loja LocalMachine\Root."
            return $true
        }
    } catch {
        Log-AgentMessage "[AVISO] Nao foi possivel verificar/instalar certificado SSL: $_"
    }
    return $false
}

function Update-AgentScriptSelf {
    param([string]$TargetServerUrl)
    try {
        $installDir = "C:\ProgramData\TIHFSA-Agent"
        $targetScript = "$installDir\tihfsa-agent.ps1"
        $scriptUrl = $TargetServerUrl.Replace("/checkin", "/script")
        $tempScript = "$installDir\tihfsa-agent.new.ps1"

        try {
            Invoke-RestMethod -Uri $scriptUrl -OutFile $tempScript -TimeoutSec 10 -ErrorAction Stop
        } catch {
            curl.exe -k -s -m 10 $scriptUrl -o $tempScript 2>$null
        }

        if (Test-Path $tempScript) {
            $newSize = (Get-Item $tempScript).Length
            if ($newSize -gt 1500) {
                $content = Get-Content $tempScript -Raw -ErrorAction SilentlyContinue
                if ($content -like "*TIHFSA Sentinel Agent*") {
                    Move-Item -Path $tempScript -Destination $targetScript -Force
                    Log-AgentMessage "[OK] Script do agente auto-atualizado com sucesso."
                }
            }
            Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
        }
    } catch {}
}

function Install-SentinelTask {
    param(
        [string]$TargetUrl,
        [string]$Secret,
        [int]$Interval
    )

    # Assegura que o certificado raiz TIHFSA está instalado na máquina
    Ensure-TihfsaRootCertificate -TargetServerUrl $TargetUrl

    $installDir = "C:\ProgramData\TIHFSA-Agent"
    if (-not (Test-Path $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    }

    $targetScript = "$installDir\tihfsa-agent.ps1"
    if ($PSCommandPath -and (Test-Path $PSCommandPath) -and ($PSCommandPath -ne $targetScript)) {
        Copy-Item -Path $PSCommandPath -Destination $targetScript -Force
    } elseif (-not (Test-Path $targetScript)) {
        $scriptUrl = $TargetUrl.Replace("/checkin", "/script")
        try {
            Invoke-RestMethod -Uri $scriptUrl -OutFile $targetScript -TimeoutSec 15
        } catch {
            curl.exe -k -s $scriptUrl -o $targetScript
        }
    }

    $taskName = "TIHFSA Sentinel Agent"
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

    try {
        schtasks.exe /Delete /F /TN $taskName 2>$null | Out-Null
    } catch {}

    $actionArg = "-NonInteractive -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$targetScript`" -ServerUrl `"$TargetUrl`" -AgentSecret `"$Secret`" -Silent"

    $created = $false
    # 1. Registro nativo PowerShell (garante que notebooks rodem em bateria e ao despertar)
    try {
        $taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArg
        $taskTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $Interval) -RepetitionDuration ([TimeSpan]::MaxValue)
        $taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

        if ($isAdmin) {
            Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -User "NT AUTHORITY\SYSTEM" -RunLevel Highest -Force -ErrorAction Stop | Out-Null
        } else {
            Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Force -ErrorAction Stop | Out-Null
        }
        $created = $true
    } catch {
        # Fallback via schtasks tradicional com correção de XML para bateria
        $legacyCmd = "powershell.exe $actionArg"
        if ($isAdmin) {
            schtasks.exe /Create /F /TN $taskName /RU "NT AUTHORITY\SYSTEM" /RL HIGHEST /SC MINUTE /MO $Interval /TR $legacyCmd 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { $created = $true }
        }
        if (-not $created) {
            schtasks.exe /Create /F /TN $taskName /SC MINUTE /MO $Interval /TR $legacyCmd 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { $created = $true }
        }
        if ($created) {
            try {
                $tempXml = "$env:TEMP\tihfsa_task.xml"
                schtasks.exe /Query /TN $taskName /XML > $tempXml 2>$null
                if (Test-Path $tempXml) {
                    $xmlContent = [System.IO.File]::ReadAllText($tempXml)
                    $xmlContent = $xmlContent.Replace("<DisallowStartIfOnBatteries>true</DisallowStartIfOnBatteries>", "<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>")
                    $xmlContent = $xmlContent.Replace("<StopIfGoingOnBatteries>true</StopIfGoingOnBatteries>", "<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>")
                    $xmlContent = $xmlContent.Replace("<StartWhenAvailable>false</StartWhenAvailable>", "<StartWhenAvailable>true</StartWhenAvailable>")
                    [System.IO.File]::WriteAllText($tempXml, $xmlContent)
                    schtasks.exe /Create /TN $taskName /XML $tempXml /F 2>$null | Out-Null
                    Remove-Item $tempXml -Force -ErrorAction SilentlyContinue
                }
            } catch {}
        }
    }

    if ($created) {
        try { schtasks.exe /Run /TN $taskName 2>$null | Out-Null } catch {}

        Write-Host ""
        Write-Host "==========================================================================" -ForegroundColor Green
        Write-Host " [SUCESSO] TIHFSA Sentinel Agent instalado e agendado com sucesso!" -ForegroundColor Green
        Write-Host "==========================================================================" -ForegroundColor Green
        Write-Host " * Tarefa Agendada: '$taskName' (Executa a cada $Interval minutos)" -ForegroundColor White
        Write-Host " * Suporte Bateria:  Ativado (executa normalmente em notebooks na bateria)" -ForegroundColor White
        Write-Host " * Local do Script:  $targetScript" -ForegroundColor White
        Write-Host " * Servidor:         $TargetUrl" -ForegroundColor White
        Write-Host " * Comportamento:    100% invisivel em segundo plano." -ForegroundColor Cyan
        Write-Host " * Fora da rede:     Silencioso sem janelas ou erros ao usuario." -ForegroundColor Cyan
        Write-Host "==========================================================================" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Error "[ERRO] Nao foi possivel registrar a tarefa agendada no Windows. Tente executar o PowerShell como Administrador."
    }
}

function Uninstall-SentinelTask {
    $taskName = "TIHFSA Sentinel Agent"
    try {
        schtasks.exe /Delete /F /TN $taskName 2>$null | Out-Null
        Write-Host "[OK] Tarefa agendada '$taskName' removida com sucesso." -ForegroundColor Yellow
    } catch {}
    try {
        $installDir = "C:\ProgramData\TIHFSA-Agent"
        if (Test-Path $installDir) {
            Remove-Item -Path $installDir -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "[OK] Pasta '$installDir' removida com sucesso." -ForegroundColor Yellow
        }
    } catch {}
}

function Ensure-SentinelTaskBatterySettings {
    try {
        $task = Get-ScheduledTask -TaskName "TIHFSA Sentinel Agent" -ErrorAction SilentlyContinue
        if ($task -and $task.Settings -and ($task.Settings.DisallowStartIfOnBatteries -or -not $task.Settings.StartWhenAvailable)) {
            $task.Settings.DisallowStartIfOnBatteries = $false
            $task.Settings.StopIfGoingOnBatteries = $false
            $task.Settings.StartWhenAvailable = $true
            $task.Settings.ExecutionTimeLimit = (New-TimeSpan -Minutes 5)
            Set-ScheduledTask -InputObject $task -ErrorAction SilentlyContinue | Out-Null
            Log-AgentMessage "[OK] Configuração de execução em bateria e despertar ativada para notebooks."
        }
    } catch {}
}

if ($Install) {
    Install-SentinelTask -TargetUrl $ServerUrl -Secret $AgentSecret -Interval $IntervalMinutes
    exit 0
}

if ($Uninstall) {
    Uninstall-SentinelTask
    exit 0
}

function Test-IsAdminOrServiceAccount {
    param([string]$AccountName)
    if ([string]::IsNullOrWhiteSpace($AccountName)) { return $true }
    $clean = ($AccountName -split '\\')[-1].Trim().ToLower()
    $blackList = @('system', 'local service', 'network service', 'administrator', 'administrador', 'root', 'defaultuser0', 'guest', 'convidado')
    if ($blackList -contains $clean) { return $true }
    if ($clean -like 'adm_*' -or $clean -like 'adm-*' -or $clean -like 'suporte*' -or $clean -like 'admin*') { return $true }
    if ($clean -like '*$') { return $true } # Filtra contas de computador do AD (ex: HFSA000001N$)
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

# 1. Assegura a instalação da Autoridade Certificadora Raiz TIHFSA na máquina local
Ensure-TihfsaRootCertificate -TargetServerUrl $ServerUrl

# 2. Verifica auto-atualização silenciosa do script do agente
Update-AgentScriptSelf -TargetServerUrl $ServerUrl

# 3. Assegura configuração de bateria e despertar em notebooks
Ensure-SentinelTaskBatterySettings

# Execução do Check-in
$payloadObj = Get-SystemMetrics
$payloadJson = $payloadObj | ConvertTo-Json -Depth 5
$headers = @{
    "Content-Type"  = "application/json"
    "X-Agent-Token" = $AgentSecret
}

$sent = $false
try {
    $response = Invoke-RestMethod -Uri $ServerUrl -Method POST -Body $payloadJson -Headers $headers -TimeoutSec 5 -ErrorAction Stop
    $sent = $true
    if (-not $Silent) {
        Write-Host "[OK] TIHFSA Sentinel Agent: Telemetria enviada com sucesso para $ServerUrl ($($payloadObj.hostname) - $($payloadObj.logged_user))" -ForegroundColor Green
    } else {
        Log-AgentMessage "[OK] Telemetria enviada com sucesso ($($payloadObj.hostname) - $($payloadObj.logged_user))"
    }
} catch {
    try {
        # Fallback resiliente via curl.exe nativo do Windows
        $curlOut = $payloadJson | curl.exe -k -s -m 5 -X POST -H "Content-Type: application/json" -H "X-Agent-Token: $AgentSecret" --data-binary "@-" $ServerUrl 2>$null
        if ($curlOut -like '*"status":"ok"*') {
            $sent = $true
            if (-not $Silent) {
                Write-Host "[OK] TIHFSA Sentinel Agent: Telemetria enviada com sucesso via curl ($($payloadObj.hostname) - $($payloadObj.logged_user))" -ForegroundColor Green
            } else {
                Log-AgentMessage "[OK] Telemetria enviada com sucesso via curl ($($payloadObj.hostname))"
            }
        }
    } catch {}
}

if (-not $sent) {
    if ($Silent) {
        # Notebook fora da rede corporativa ou sem comunicacao:
        # NUNCA exibir erro na tela do usuario. Grava apenas no log local e encerra limpo com exit 0.
        Log-AgentMessage "[INFO] Servidor inacessivel ou maquina fora da rede. Telemetria sera reenviada no proximo ciclo."
        exit 0
    } else {
        Write-Warning "[AVISO] Nao foi possivel conectar ao servidor TIHFSA ($ServerUrl). Verifique se a maquina esta conectada na rede local ou VPN."
    }
}
