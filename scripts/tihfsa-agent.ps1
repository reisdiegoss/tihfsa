<#
.SYNOPSIS
    TIHFSA Sentinel Agent - Agente Nativo de Telemetria e Monitoramento de Estacoes.
    Hotel Fasano Salvador - Substituicao Nativa do Zabbix Agent para Windows.

.DESCRIPTION
    Coleta dados de hardware (CPU, Memoria, Disco), sistema (Uptime, OS),
    rede (IP, Hostname) e identifica o Usuario Ativo logado na maquina,
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
    [switch]$CheckinOnly,
    [int]$IntervalMinutes = 15
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
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
    param(
        [string]$TargetServerUrl,
        [switch]$Silent
    )
    try {
        # 1. Verifica se ja esta instalado no repositorio confiavel da maquina local
        $installed = Get-ChildItem Cert:\LocalMachine\Root -ErrorAction SilentlyContinue | Where-Object {
            $_.Subject -like "*TIHFSA Root*" -or $_.Issuer -like "*TIHFSA Root*"
        }
        if ($installed) {
            if (-not $Silent) {
                Write-Host " [OK] Certificado Raiz TIHFSA ja configurado nesta estacao." -ForegroundColor Green
            }
            return $true
        }

        if (-not $Silent) {
            Write-Host "[+] Baixando e instalando Certificado Raiz TIHFSA..." -ForegroundColor Cyan
        }

        # 2. Se nao estiver instalado, tenta baixar do servidor
        $serverBase = ($TargetServerUrl -split '/api/')[0]
        $candidateUrls = @(
            "$serverBase/api/v1/monitoring/agent/ca.crt",
            "$serverBase/cert/tihfsa-ca.crt",
            "https://fassa29/cert/tihfsa-ca.crt",
            "https://fassa29.fasanobr.local/cert/tihfsa-ca.crt",
            "https://192.168.168.29/cert/tihfsa-ca.crt",
            "http://192.168.168.29/cert/tihfsa-ca.crt",
            "http://fassa29/cert/tihfsa-ca.crt"
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
            if (-not $Silent) {
                Write-Host " [OK] Certificado Raiz TIHFSA instalado com sucesso na Loja do Windows!" -ForegroundColor Green
                Write-Host "      Navegadores Edge e Chrome agora confiam na conexao HTTPS segura." -ForegroundColor Green
            }
            return $true
        } else {
            if (-not $Silent) {
                Write-Host " [AVISO] Nao foi possivel baixar o certificado raiz SSL de $serverBase." -ForegroundColor Yellow
            }
        }
    } catch {
        Log-AgentMessage "[AVISO] Nao foi possivel verificar/instalar certificado SSL: $_"
        if (-not $Silent) {
            Write-Host " [AVISO] Erro ao verificar/instalar certificado SSL: $_" -ForegroundColor Yellow
        }
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
                    try {
                        [System.IO.File]::Copy($tempScript, $targetScript, $true)
                        Log-AgentMessage "[OK] Script do agente auto-atualizado com sucesso via .NET."
                    } catch {
                        Copy-Item -Path $tempScript -Destination $targetScript -Force -ErrorAction SilentlyContinue
                        Log-AgentMessage "[OK] Script do agente auto-atualizado com sucesso via Copy-Item."
                    }
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

    Write-Host "==========================================================================" -ForegroundColor Cyan
    Write-Host " TIHFSA Sentinel Agent - Instalacao e Ativacao do Agente" -ForegroundColor Cyan
    Write-Host " Servidor: $TargetUrl" -ForegroundColor White
    Write-Host "==========================================================================" -ForegroundColor Cyan

    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host ""
        Write-Host "==========================================================================" -ForegroundColor Red
        Write-Host " [ERRO DE PRIVILEGIO] Execucao como Administrador obrigatoria!" -ForegroundColor Red
        Write-Host "==========================================================================" -ForegroundColor Red
        Write-Host " Para instalar o certificado SSL Raiz e a Tarefa Agendada no Windows," -ForegroundColor Yellow
        Write-Host " clique com o botao direito no PowerShell e selecione:" -ForegroundColor Yellow
        Write-Host "   'Executar como Administrador' (Run as Administrator)" -ForegroundColor White
        Write-Host "==========================================================================" -ForegroundColor Red
        Write-Host ""
        return $false
    }

    # 1. Assegura que o certificado raiz TIHFSA esta instalado na maquina
    Write-Host "[1/3] Verificando Autoridade Certificadora Raiz TIHFSA..." -ForegroundColor Cyan
    Ensure-TihfsaRootCertificate -TargetServerUrl $TargetUrl

    # 2. Cria diretorio e copia arquivo do script
    Write-Host "[2/3] Instalando arquivos do agente em C:\ProgramData\TIHFSA-Agent..." -ForegroundColor Cyan
    $installDir = "C:\ProgramData\TIHFSA-Agent"
    if (-not (Test-Path $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    }

    $targetScript = "$installDir\tihfsa-agent.ps1"
    if ($PSCommandPath -and (Test-Path $PSCommandPath) -and ($PSCommandPath -ne $targetScript)) {
        try {
            [System.IO.File]::Copy($PSCommandPath, $targetScript, $true)
        } catch {
            Copy-Item -Path $PSCommandPath -Destination $targetScript -Force -ErrorAction SilentlyContinue
        }
    } elseif (-not (Test-Path $targetScript)) {
        $scriptUrl = $TargetUrl.Replace("/checkin", "/script")
        try {
            Invoke-RestMethod -Uri $scriptUrl -OutFile $targetScript -TimeoutSec 15
        } catch {
            curl.exe -k -s $scriptUrl -o $targetScript
        }
    }

    if (-not (Test-Path $targetScript)) {
        Write-Host " [ERRO] Nao foi possivel copiar ou baixar o script do agente para $targetScript." -ForegroundColor Red
        return $false
    }

    # 3. Registra a Tarefa Agendada no Windows
    Write-Host "[3/3] Registrando Tarefa Agendada no Windows (a cada $Interval minutos)..." -ForegroundColor Cyan
    $taskName = "TIHFSA Sentinel Agent"

    try {
        schtasks.exe /Delete /F /TN $taskName 2>$null | Out-Null
    } catch {}

    $actionArg = "-NoProfile -File `"$targetScript`" -ServerUrl `"$TargetUrl`" -AgentSecret `"$Secret`" -Silent"
    $legacyCmd = "powershell.exe $actionArg"
    $created = $false

    # Tentativa 1: Register-ScheduledTask nativo (PowerShell)
    try {
        $taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArg
        $taskTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $Interval) -RepetitionDuration ([TimeSpan]::MaxValue)
        $taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

        Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -User "NT AUTHORITY\SYSTEM" -RunLevel Highest -Force -ErrorAction Stop | Out-Null
        $created = $true
    } catch {
        # Tentativa 2: Fallback via schtasks.exe tradicional com correcao de XML para bateria
        schtasks.exe /Create /F /TN $taskName /RU "NT AUTHORITY\SYSTEM" /RL HIGHEST /SC MINUTE /MO $Interval /TR $legacyCmd 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $created = $true }
    }

    if (-not $created) {
        schtasks.exe /Create /F /TN $taskName /SC MINUTE /MO $Interval /TR $legacyCmd 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $created = $true }
    }

    if ($created) {
        # Garante suporte a bateria em notebooks via XML
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

        Write-Host " [OK] Tarefa Agendada '$taskName' registrada com sucesso!" -ForegroundColor Green
        return $true
    } else {
        Write-Host " [ERRO] Nao foi possivel registrar a tarefa agendada no Windows. Verifique se o PowerShell esta como Administrador." -ForegroundColor Red
        return $false
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
            Log-AgentMessage "[OK] Configuracao de execucao em bateria e despertar ativada para notebooks."
        }
    } catch {}
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

    # Camada 1: Proprietario do processo explorer.exe da sessao interativa grafica
    # Garante que mesmo com o script rodando como Administrador ou SYSTEM, pega o usuario na tela
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

    # Camada 2: Sessao de console interativo via Win32_ComputerSystem
    try {
        $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
        if ($cs.UserName) {
            if (-not (Test-IsAdminOrServiceAccount $cs.UserName)) {
                return $cs.UserName
            }
            if (-not $detectedUser) { $detectedUser = $cs.UserName }
        }
    } catch {}

    # Camada 3: Sessao de console ativa via query user
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

    # Camada 4: Registro do Windows (Ultimo usuario real logado - otimo se rodar no boot antes do login)
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

function Get-BackupExecTelemetry {
    # 1. Verifica se os servicos do Veritas Backup Exec 23.0 existem na maquina
    $beServiceNames = @('BackupExecJobEngine', 'BackupExecServer', 'BackupExecDeviceMediaService', 'BackupExecManagementService')
    $beInstalled = $false
    $beServicesRunning = $true
    $servicesStatus = @{}

    foreach ($sName in $beServiceNames) {
        $svc = Get-Service -Name $sName -ErrorAction SilentlyContinue
        if ($svc) {
            $beInstalled = $true
            $servicesStatus[$sName] = $svc.Status.ToString()
            if ($svc.Status -ne "Running") {
                $beServicesRunning = $false
            }
        }
    }

    # Se nao houver servicos do Backup Exec, encerra retornando $null de forma ultra-leve
    if (-not $beInstalled) {
        return $null
    }

    $telemetry = @{
        installed                = $true
        server_version           = "23.0 Rev. 1250"
        services_running         = $beServicesRunning
        services_status          = $servicesStatus
        last_job_name            = ""
        last_job_status          = "Unknown"  # "Success" | "Error" | "Warning" | "Unknown"
        last_job_completion_time = ""
        last_job_elapsed_time    = ""
        last_job_byte_count_gb   = 0.0
        last_event_id            = 0
        last_event_message       = ""
    }

    # 2. Tenta coletar via BEMCLI (Modulo Oficial Veritas Backup Exec PowerShell)
    try {
        if (-not (Get-Module -Name BEMCLI)) {
            Import-Module BEMCLI -ErrorAction SilentlyContinue | Out-Null
        }
        if (Get-Command Get-BEJobHistory -ErrorAction SilentlyContinue) {
            $lastJob = Get-BEJobHistory -ErrorAction SilentlyContinue | Sort-Object EndTime -Descending | Select-Object -First 1
            if ($lastJob) {
                $telemetry.last_job_name = if ($lastJob.JobName) { $lastJob.JobName } else { "Backup Exec Job" }
                $telemetry.last_job_completion_time = if ($lastJob.EndTime) { $lastJob.EndTime.ToString("yyyy-MM-dd HH:mm:ss") } else { "" }
                $telemetry.last_job_elapsed_time = if ($lastJob.ElapsedTime) { $lastJob.ElapsedTime.ToString() } else { "" }
                if ($lastJob.TotalDataSizeBytes) {
                    $telemetry.last_job_byte_count_gb = [math]::Round($lastJob.TotalDataSizeBytes / 1GB, 2)
                }

                $jobStatusRaw = if ($lastJob.JobStatus) { $lastJob.JobStatus.ToString() } else { "" }
                if ($jobStatusRaw -match "Succeeded$|Success|Successful") {
                    $telemetry.last_job_status = "Success"
                } elseif ($jobStatusRaw -match "Error|Failed|Canceled|CompletedWithExceptions|Fatal|Missed|ThresholdExceeded") {
                    $telemetry.last_job_status = "Error"
                } elseif ($jobStatusRaw -match "Warning|Attention") {
                    $telemetry.last_job_status = "Warning"
                }
            }
        }
        # Verifica se ha Alertas Ativos no console do Backup Exec (ex: fita requerida, pool cheio, erro de hardware)
        if (Get-Command Get-BEAlert -ErrorAction SilentlyContinue) {
            $activeAlerts = @(Get-BEAlert -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Active' -and $_.Severity -in @('Error', 'AttentionRequired', 'Warning') })
            if ($activeAlerts -and $activeAlerts.Count -gt 0) {
                $firstAlert = $activeAlerts[0]
                $telemetry.last_job_status = "Error"
                $telemetry.last_event_message = "Alerta Ativo no Veritas Backup Exec: $($firstAlert.Name) - $($firstAlert.Message)"
            }
        }
    } catch {}

    # 3. Complemento / Fallback Seguro via Windows Application Event Log
    try {
        # Busca os eventos mais recentes de erro/aviso/conclusao do Veritas Backup Exec
        $events = Get-EventLog -LogName Application -Source "*Backup Exec*" -Newest 50 -ErrorAction SilentlyContinue | Where-Object {
            $_.EventID -in @(34113, 34114, 34115, 57751, 57752, 57753, 57754, 57755, 57756, 58068) -or $_.EntryType -in @("Error", "Warning")
        }

        if ($events -and $events.Count -gt 0) {
            $latestEvent = $events[0]
            $eventId = [int]$latestEvent.EventID
            $eventMsg = if ($latestEvent.Message) { $latestEvent.Message.Trim() } else { "" }
            $eventTime = $latestEvent.TimeGenerated
            $evtTimeStr = $eventTime.ToString("yyyy-MM-dd HH:mm:ss")
            $isEvtError = ($eventId -in @(34114, 34115, 57755, 57756, 57751, 57752, 57753, 57754, 58068)) -or ($latestEvent.EntryType -in @("Error", "Warning"))

            # O evento do Windows prevalece se for um erro ou se for mais recente que o registro do BEMCLI
            if ($isEvtError -or -not $telemetry.last_job_completion_time -or ($evtTimeStr -ge $telemetry.last_job_completion_time)) {
                $telemetry.last_event_id = $eventId
                $telemetry.last_event_message = $eventMsg
                $telemetry.last_job_completion_time = $evtTimeStr
                $telemetry.last_job_status = if ($eventId -eq 57755) { "Warning" } elseif ($isEvtError) { "Error" } else { "Success" }

                if ($eventMsg -match "trabalho\s+['""]([^'""]+)['""]|job\s+['""]([^'""]+)['""]") {
                    $telemetry.last_job_name = $matches[1]
                }
            }
        }
    } catch {}

    if (-not $telemetry.last_job_name) {
        $telemetry.last_job_name = "Rotina Diaria de Backup Veritas"
    }

    return $telemetry
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

    # Discos Logicos (Particoes locais C:, D:, etc.)
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

    # Discos Fisicos (Hardware SSD, NVMe, HDD)
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

    # Endereco IPv4 Ativo & MAC Address
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

    # Deteccao nativa de Windows Server (ProductType 2 ou 3)
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

    # Chave de Ativacao do Windows (BIOS OA3 / MSDM)
    $winKey = ""
    try {
        $oa3 = (Get-CimInstance SoftwareLicensingService -ErrorAction SilentlyContinue).OA3xOriginalProductKey
        if ($oa3) { $winKey = $oa3.Trim() }
    } catch {}

    # Licenca, Versao e Chave de Ativacao do Microsoft Office
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

    # Inventario Completo de Softwares / Programas Instalados (Painel de Controle / Registro)
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
        backup_exec         = Get-BackupExecTelemetry
    }
}

# ------------------------------------------------------------------------------
# Ponto de Entrada Principal (Entrypoint)
# ------------------------------------------------------------------------------
try {
    if ($Uninstall) {
        Uninstall-SentinelTask
        return
    }

    # Se for apenas envio de check-in avulso:
    if ($CheckinOnly) {
        Ensure-TihfsaRootCertificate -TargetServerUrl $ServerUrl -Silent
    } elseif (-not $Silent) {
        # Se NAO for execucao em segundo plano (-Silent), executa o instalador da tarefa agendada:
        $installed = Install-SentinelTask -TargetUrl $ServerUrl -Secret $AgentSecret -Interval $IntervalMinutes
        if (-not $installed) {
            Write-Host ""
            Write-Host "[!] A instalacao nao pode ser concluida. Verifique o erro exibido acima." -ForegroundColor Red
            if (-not $Silent) {
                Write-Host "Pressione [ENTER] para fechar esta janela..." -ForegroundColor Cyan
                try { [void][System.Console]::ReadLine() } catch {}
            }
            return
        }
        Write-Host ""
        Write-Host "[+] Coletando metricas e executando envio de telemetria..." -ForegroundColor Cyan
    } else {
        Ensure-TihfsaRootCertificate -TargetServerUrl $ServerUrl -Silent
        Update-AgentScriptSelf -TargetServerUrl $ServerUrl
        Ensure-SentinelTaskBatterySettings
    }

    # Execucao do Check-in de Telemetria
    $payloadObj = Get-SystemMetrics
    $payloadJson = $payloadObj | ConvertTo-Json -Depth 5
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($payloadJson)
    $headers = @{
        "Content-Type"  = "application/json; charset=utf-8"
        "X-Agent-Token" = $AgentSecret
    }

    $sent = $false
    try {
        $response = Invoke-RestMethod -Uri $ServerUrl -Method POST -Body $bodyBytes -Headers $headers -TimeoutSec 5 -ErrorAction Stop
        $sent = $true
    } catch {
        try {
            # Fallback resiliente via curl.exe nativo do Windows com arquivo UTF-8
            $tempJson = "$env:TEMP\tihfsa_checkin_$([System.Guid]::NewGuid().ToString('N')).json"
            [System.IO.File]::WriteAllText($tempJson, $payloadJson, [System.Text.Encoding]::UTF8)
            $curlOut = curl.exe -k -s -m 5 -X POST -H "Content-Type: application/json; charset=utf-8" -H "X-Agent-Token: $AgentSecret" --data-binary "@$tempJson" $ServerUrl 2>$null
            Remove-Item $tempJson -Force -ErrorAction SilentlyContinue
            if ($curlOut -like '*"status":"ok"*') {
                $sent = $true
            }
        } catch {}
    }

    if ($sent) {
        if (-not $Silent) {
            Write-Host " [OK] Telemetria enviada com sucesso para $ServerUrl ($($payloadObj.hostname) - $($payloadObj.logged_user))" -ForegroundColor Green
            if (-not $CheckinOnly) {
                Write-Host ""
                Write-Host "==========================================================================" -ForegroundColor Green
                Write-Host " [SUCESSO] TIHFSA Sentinel Agent instalado e sincronizado com sucesso!" -ForegroundColor Green
                Write-Host "==========================================================================" -ForegroundColor Green
                Write-Host " * Sincronizacao:    Executa a cada $IntervalMinutes minutos em segundo plano" -ForegroundColor White
                Write-Host " * Local do Script:  C:\ProgramData\TIHFSA-Agent\tihfsa-agent.ps1" -ForegroundColor White
                Write-Host " * Servidor:         $ServerUrl" -ForegroundColor White
                Write-Host " * Certificado SSL:  Instalado (Trusted Root CA - Navegadores confiam)" -ForegroundColor White
                Write-Host " * Modo Bateria:     Ativado (executa normalmente em notebooks na bateria)" -ForegroundColor White
                Write-Host "==========================================================================" -ForegroundColor Green
                Write-Host ""
            }
        } else {
            Log-AgentMessage "[OK] Telemetria enviada com sucesso ($($payloadObj.hostname) - $($payloadObj.logged_user))"
        }
    } else {
        if ($Silent) {
            # Notebook fora da rede corporativa ou sem comunicacao:
            # NUNCA exibir erro na tela do usuario. Grava apenas no log local e encerra limpo.
            Log-AgentMessage "[INFO] Servidor inacessivel ou maquina fora da rede. Telemetria sera reenviada no proximo ciclo."
            return
        } else {
            Write-Host ""
            Write-Host "==========================================================================" -ForegroundColor Yellow
            Write-Host " [AVISO] Nao foi possivel conectar ao servidor de telemetria agora." -ForegroundColor Yellow
            Write-Host "==========================================================================" -ForegroundColor Yellow
            Write-Host " * Servidor: $ServerUrl" -ForegroundColor White
            Write-Host " * Verifique se a maquina esta conectada na rede local ou VPN." -ForegroundColor White
            Write-Host " * A telemetria sera reenviada automaticamente no proximo ciclo de $IntervalMinutes min." -ForegroundColor White
            Write-Host "==========================================================================" -ForegroundColor Yellow
            Write-Host ""
        }
    }

    if ((-not $Silent) -and (-not $CheckinOnly)) {
        Write-Host "Pressione [ENTER] para fechar esta janela..." -ForegroundColor Cyan
        try { [void][System.Console]::ReadLine() } catch {}
    }
} catch {
    Log-AgentMessage "[ERRO CRITICO] Falha inesperada no agente: $_"
    if (-not $Silent) {
        Write-Host ""
        Write-Host "[ERRO CRITICO] Falha durante a execucao: $_" -ForegroundColor Red
        Write-Host $_.ScriptStackTrace -ForegroundColor Red
        Write-Host ""
        Write-Host "Pressione [ENTER] para fechar esta janela..." -ForegroundColor Cyan
        try { [void][System.Console]::ReadLine() } catch {}
    }
}
