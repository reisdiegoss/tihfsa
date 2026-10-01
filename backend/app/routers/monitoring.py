"""
Router Monitoring — Central unificada de dados de monitoramento (Helpdesk & NOC) e Telemetria Nativa de Agentes.
"""
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_technician
from app.config import settings
from app.database import get_db
from app.models.asset import Asset
from app.models.monitoring import AgentCheckin
from app.models.user import User
from app.services.sla_service import get_helpdesk_monitoring_summary

router = APIRouter(prefix="/api/v1/monitoring", tags=["Monitoring"])

AGENT_DEFAULT_TOKEN = "tihfsa-agent-token-fasano-2026"


# --- Schemas ---

class AgentCheckinPayload(BaseModel):
    hostname: str
    logged_user: Optional[str] = None
    ip_address: str
    cpu_usage_pct: Optional[int] = None
    cpu_model: Optional[str] = None
    ram_used_mb: Optional[int] = None
    ram_total_mb: Optional[int] = None
    ram_usage_pct: Optional[float] = None
    disks: Optional[list[dict] | dict] = None
    physical_disks: Optional[list[dict] | dict] = None
    uptime_hours: Optional[float] = None
    os_name: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    mac_address: Optional[str] = None
    device_type: Optional[str] = None
    vcpu_count: Optional[int] = None


class AgentMachineResponse(BaseModel):
    id: int
    hostname: str
    logged_user: Optional[str] = None
    ip_address: str
    cpu_usage_pct: Optional[int] = None
    cpu_model: Optional[str] = None
    ram_used_mb: Optional[int] = None
    ram_total_mb: Optional[int] = None
    ram_usage_pct: Optional[float] = None
    disk_metrics: Optional[list[dict]] = None
    uptime_hours: Optional[float] = None
    os_name: Optional[str] = None
    status: str
    is_online: bool
    last_seen_at: datetime
    seconds_ago: int
    asset_id: Optional[int] = None
    asset_name: Optional[str] = None
    asset_tag: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    device_type: Optional[str] = None
    assigned_user_id: Optional[int] = None
    assigned_user_name: Optional[str] = None


class AgentSummaryResponse(BaseModel):
    total_machines: int
    online_count: int
    warning_count: int
    offline_count: int
    machines: list[AgentMachineResponse]


# --- Endpoints Helpdesk Wallboard ---

@router.get("/helpdesk/summary", summary="Obter resumo e KPIs de Helpdesk para TV e Monitoramento")
def get_helpdesk_summary_endpoint(
    period_days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    """
    Retorna o resumo em tempo real para o painel de TV (Helpdesk Wallboard)
    e para a aba de Helpdesk do Hub de Monitoramento.
    """
    return get_helpdesk_monitoring_summary(db=db, period_days=period_days)


# --- Endpoints TIHFSA Sentinel Agent (Substituição Zabbix) ---

@router.post("/agent/checkin", summary="Registrar telemetria periódica do TIHFSA Agent")
def agent_checkin(
    data: AgentCheckinPayload,
    request: Request,
    db: Session = Depends(get_db),
    x_agent_token: Optional[str] = Header(None),
):
    """
    Endpoint de ingestão consumido pelo script PowerShell (ou daemon) rodando nas máquinas.
    Atualiza métricas de CPU, RAM, disco, usuário do Windows logado e IP.
    """
    now = datetime.now(timezone.utc)
    hostname_clean = data.hostname.strip().upper()
    ip_clean = data.ip_address.strip()

    # Validação simples do IP se vier unknown ou vazio: pega do socket
    if not ip_clean or ip_clean.lower() == "unknown":
        forwarded = request.headers.get("X-Forwarded-For")
        ip_clean = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")

    # Normalização de discos (pode vir como list ou como dict unitário do PowerShell)
    disks_normalized = []
    if isinstance(data.disks, dict):
        disks_normalized = [data.disks]
    elif isinstance(data.disks, list):
        disks_normalized = data.disks

    physical_disks_normalized = []
    if getattr(data, "physical_disks", None):
        if isinstance(data.physical_disks, dict):
            physical_disks_normalized = [data.physical_disks]
        elif isinstance(data.physical_disks, list):
            physical_disks_normalized = data.physical_disks

    # Avaliação do status de saúde (warning se disco > 90% ou CPU > 95%)
    has_warning = False
    if data.cpu_usage_pct and data.cpu_usage_pct >= 95:
        has_warning = True
    if disks_normalized:
        for d in disks_normalized:
            if isinstance(d, dict) and d.get("used_pct", 0) >= 90:
                has_warning = True
                break

    calculated_status = "warning" if has_warning else "online"

    # 1. Identificação do Usuário no banco de dados (users)
    clean_user = ""
    if data.logged_user:
        clean_user = re.sub(r"^.*?\\", "", data.logged_user).strip().lower()
        clean_user = clean_user.split("@")[0].strip()

    blacklisted_accounts = {"system", "local service", "network service", "administrator", "administrador", "root", "defaultuser0", "guest", "convidado"}
    is_admin_or_service = (
        clean_user in blacklisted_accounts
        or clean_user.startswith(("adm_", "adm-", "suporte", "admin"))
    )
    user = None
    if clean_user and not is_admin_or_service:
        user = (
            db.query(User)
            .filter(
                or_(
                    User.ad_username.ilike(clean_user),
                    User.email.ilike(f"{clean_user}@%"),
                )
            )
            .first()
        )

    # 2. Localização do Ativo no CMDB (por Serial Number, Hostname ou IP)
    asset = None
    valid_serial = bool(data.serial_number and data.serial_number.strip().lower() not in ("desconhecido", "to be filled by o.e.m.", "none", ""))
    if valid_serial:
        asset = db.query(Asset).filter(Asset.serial_number == data.serial_number.strip()).first()
    if not asset:
        asset = db.query(Asset).filter(Asset.name.ilike(hostname_clean)).first()
    if not asset and ip_clean not in ("unknown", "127.0.0.1", ""):
        asset = db.query(Asset).filter(Asset.ip_address == ip_clean).first()

    # Cálculo da Memória RAM (ex: "16 GB", "8 GB", "32 GB")
    ram_formatted = None
    if data.ram_total_mb and data.ram_total_mb > 0:
        ram_gb = round(data.ram_total_mb / 1024)
        ram_formatted = f"{ram_gb} GB"

    # Cálculo do Armazenamento (suporte inteligente a múltiplas unidades e SSD)
    storage_units = []
    if disks_normalized:
        for d in disks_normalized:
            if isinstance(d, dict):
                drive = d.get("drive", "").strip()
                total_gb = d.get("total_gb", 0)
                if total_gb:
                    if total_gb >= 950:
                        sz_str = f"{round(total_gb / 1024, 1)} TB".replace(".0 TB", " TB")
                    elif 450 <= total_gb <= 520:
                        sz_str = "512 GB"
                    elif 220 <= total_gb <= 260:
                        sz_str = "256 GB"
                    elif 900 <= total_gb <= 1050:
                        sz_str = "1 TB"
                    else:
                        sz_str = f"{int(round(total_gb))} GB"
                    unit_label = f"{drive} {sz_str}".strip() if drive else sz_str
                    storage_units.append(unit_label)

    p_types = [p.get("media_type") for p in physical_disks_normalized if isinstance(p, dict) and p.get("media_type")]
    has_ssd = any("ssd" in str(t).lower() or "nvme" in str(t).lower() for t in p_types)

    storage_formatted = None
    if storage_units:
        storage_formatted = ", ".join(storage_units)
        if has_ssd and "ssd" not in storage_formatted.lower():
            storage_formatted += " SSD"
    elif physical_disks_normalized:
        p_parts = []
        for p in physical_disks_normalized:
            if isinstance(p, dict):
                sz = p.get("size_gb", 0)
                mtype = p.get("media_type", "SSD")
                if sz:
                    sz_str = f"{round(sz / 1024, 1)} TB".replace(".0 TB", " TB") if sz >= 950 else f"{int(round(sz))} GB"
                    p_parts.append(f"{sz_str} {mtype}".strip())
        if p_parts:
            storage_formatted = ", ".join(p_parts)

    specs_payload = {
        "cpu": data.cpu_model,
        "ram": ram_formatted,
        "vcpu": data.vcpu_count,
        "ram_gb": ram_gb,
        "storage": storage_formatted,
        "os": data.os_name,
        "cpu_usage_pct": data.cpu_usage_pct,
        "ram_total_mb": data.ram_total_mb,
        "ram_used_mb": data.ram_used_mb,
        "ram_usage_pct": data.ram_usage_pct,
        "disks": disks_normalized,
        "physical_disks": physical_disks_normalized,
        "uptime_hours": data.uptime_hours,
        "mac_address": data.mac_address,
    }

    # Inferência inteligente do tipo de ativo (Servidor, Notebook ou Desktop)
    is_server_detected = bool(
        (data.os_name and "server" in data.os_name.lower())
        or (data.device_type and "servidor" in data.device_type.lower())
    )

    if not asset:
        # Auto-cadastro do Ativo no CMDB (Fase 1 Sentinel Agent)
        if is_server_detected:
            asset_type = "Servidor"
        elif data.device_type in ("Notebook", "Desktop", "Servidor"):
            asset_type = data.device_type
        else:
            asset_type = "Desktop"

        asset = Asset(
            name=hostname_clean,
            type=asset_type,
            brand=data.brand.strip() if data.brand and data.brand.strip().lower() != "desconhecido" else None,
            model=data.model.strip() if data.model and data.model.strip().lower() != "desconhecido" else None,
            serial_number=data.serial_number.strip() if valid_serial else None,
            mac_address=data.mac_address,
            ip_address=ip_clean if ip_clean != "unknown" else None,
            category_id=1,  # Hardware
            assigned_user_id=user.id if user else None,
            specs=specs_payload,
            is_active=True,
        )
        db.add(asset)
        db.flush()
    else:
        # Atualização contínua do Ativo existente
        if data.brand and data.brand.strip().lower() != "desconhecido":
            asset.brand = data.brand.strip()
        if data.model and data.model.strip().lower() != "desconhecido":
            asset.model = data.model.strip()
        if valid_serial:
            asset.serial_number = data.serial_number.strip()
        if data.mac_address:
            asset.mac_address = data.mac_address
        if ip_clean not in ("unknown", "127.0.0.1", ""):
            asset.ip_address = ip_clean
        if is_server_detected and asset.type in ("Desktop", "Notebook", "Outro", "Desconhecido"):
            asset.type = "Servidor"
        elif data.device_type and asset.type in ("Outro", "Desconhecido"):
            asset.type = data.device_type
        if user and not asset.assigned_user_id:
            asset.assigned_user_id = user.id

        merged_specs = dict(asset.specs or {})
        for k, v in specs_payload.items():
            if v is not None:
                merged_specs[k] = v
        asset.specs = merged_specs

    # 3. Formatação do nome de usuário exibido
    display_user = data.logged_user
    if user:
        display_user = f"{user.display_name} ({user.ad_username})"

    # 4. Busca registro existente do hostname para telemetria
    checkin = (
        db.query(AgentCheckin)
        .filter(AgentCheckin.hostname.ilike(hostname_clean))
        .first()
    )

    if not checkin:
        # Novo agente detectado
        checkin = AgentCheckin(
            hostname=hostname_clean,
            logged_user=display_user,
            ip_address=ip_clean,
            cpu_usage_pct=data.cpu_usage_pct,
            ram_used_mb=data.ram_used_mb,
            ram_total_mb=data.ram_total_mb,
            ram_usage_pct=data.ram_usage_pct,
            disk_metrics=disks_normalized,
            uptime_hours=data.uptime_hours,
            os_name=data.os_name,
            status=calculated_status,
            last_seen_at=now,
            asset_id=asset.id,
        )
        db.add(checkin)
    else:
        # Atualização de máquina já cadastrada
        checkin.hostname = hostname_clean
        checkin.logged_user = display_user
        checkin.ip_address = ip_clean
        checkin.cpu_usage_pct = data.cpu_usage_pct
        checkin.ram_used_mb = data.ram_used_mb
        checkin.ram_total_mb = data.ram_total_mb
        checkin.ram_usage_pct = data.ram_usage_pct
        checkin.disk_metrics = disks_normalized
        checkin.uptime_hours = data.uptime_hours
        checkin.os_name = data.os_name
        checkin.status = calculated_status
        checkin.last_seen_at = now
        checkin.asset_id = asset.id

    db.commit()
    db.refresh(checkin)

    return {
        "status": "ok",
        "hostname": checkin.hostname,
        "asset_id": checkin.asset_id,
        "assigned_user": user.display_name if user else None,
        "server_time": now.isoformat(),
    }


@router.get("/agent/machines", response_model=AgentSummaryResponse, summary="Listar estações monitoradas pelo agente")
def list_agent_machines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna a lista de todas as estações com o agente instalado,
    indicando status Online/Offline (limiar de 3 minutos), recursos de hardware e usuário ativo.
    """
    now = datetime.now(timezone.utc)
    records = db.query(AgentCheckin).order_by(AgentCheckin.last_seen_at.desc()).all()

    online_count = 0
    warning_count = 0
    offline_count = 0
    machine_list = []

    for r in records:
        diff_seconds = max(0, int((now - r.last_seen_at).total_seconds()))
        is_online = diff_seconds <= 180

        if not is_online:
            item_status = "offline"
            offline_count += 1
        elif r.status == "warning":
            item_status = "warning"
            warning_count += 1
            online_count += 1
        else:
            item_status = "online"
            online_count += 1

        machine_list.append(
            AgentMachineResponse(
                id=r.id,
                hostname=r.hostname,
                logged_user=r.logged_user,
                ip_address=r.ip_address,
                cpu_usage_pct=r.cpu_usage_pct,
                cpu_model=r.asset.specs.get("cpu") if (r.asset and isinstance(r.asset.specs, dict)) else None,
                ram_used_mb=r.ram_used_mb,
                ram_total_mb=r.ram_total_mb,
                ram_usage_pct=r.ram_usage_pct,
                disk_metrics=r.disk_metrics,
                uptime_hours=r.uptime_hours,
                os_name=r.os_name,
                status=item_status,
                is_online=is_online,
                last_seen_at=r.last_seen_at,
                seconds_ago=diff_seconds,
                asset_id=r.asset_id,
                asset_name=r.asset.name if r.asset else None,
                asset_tag=r.asset.asset_tag if r.asset else None,
                brand=r.asset.brand if r.asset else None,
                model=r.asset.model if r.asset else None,
                serial_number=r.asset.serial_number if r.asset else None,
                device_type=r.asset.type if r.asset else None,
                assigned_user_id=r.asset.assigned_user_id if r.asset else None,
                assigned_user_name=r.asset.assigned_user.display_name if (r.asset and r.asset.assigned_user) else None,
            )
        )

    return AgentSummaryResponse(
        total_machines=len(records),
        online_count=online_count,
        warning_count=warning_count,
        offline_count=offline_count,
        machines=machine_list,
    )


@router.delete("/agent/machines/{machine_id}", summary="Remover estação do monitoramento")
def delete_agent_machine(
    machine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    """Exclui o registro de telemetria de uma estação desativada."""
    checkin = db.query(AgentCheckin).filter(AgentCheckin.id == machine_id).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="Estação não encontrada")

    db.delete(checkin)
    db.commit()
    return {"status": "ok", "message": f"Estação {checkin.hostname} removida com sucesso"}


@router.get("/agent/script", summary="Download do script PowerShell do Agente")
def get_agent_powershell_script(request: Request, download: bool = False):
    """
    Retorna o script PowerShell configurado com a URL do servidor atual,
    permitindo instalação imediata via '(curl.exe -k -s "..." | Out-String) | iex'
    ou download direto do arquivo .ps1 pelo navegador.
    """
    # Detecta a base URL do servidor a partir do Host da requisição
    host = request.headers.get("Host", "127.0.0.1:8000")
    protocol = "https" if request.url.scheme == "https" or "https" in request.headers.get("X-Forwarded-Proto", "") else "http"
    server_endpoint = f"{protocol}://{host}/api/v1/monitoring/agent/checkin"

    ps_script = f"""<#
.SYNOPSIS
    TIHFSA Sentinel Agent — Telemetria de Estação para o Servidor TIHFSA.
    Substituto nativo do Zabbix Agent para Windows.
#>
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {{$true}}

$SERVER_URL = "{server_endpoint}"
$AGENT_SECRET = "{AGENT_DEFAULT_TOKEN}"

function Test-IsAdminOrServiceAccount {{
    param([string]$AccountName)
    if ([string]::IsNullOrWhiteSpace($AccountName)) {{ return $true }}
    $clean = ($AccountName -split '\\')[-1].Trim().ToLower()
    $blackList = @('system', 'local service', 'network service', 'administrator', 'administrador', 'root', 'defaultuser0', 'guest', 'convidado')
    if ($blackList -contains $clean) {{ return $true }}
    if ($clean -like 'adm_*' -or $clean -like 'adm-*' -or $clean -like 'suporte*' -or $clean -like 'admin*') {{ return $true }}
    return $false
}}

function Get-LoggedUser {{
    $detectedUser = $null

    try {{
        $explorers = Get-CimInstance Win32_Process -Filter "Name = 'explorer.exe'" -ErrorAction SilentlyContinue
        foreach ($proc in $explorers) {{
            $owner = Invoke-CimMethod -InputObject $proc -MethodName GetOwner -ErrorAction SilentlyContinue
            if ($owner -and $owner.User) {{
                $candidate = if ($owner.Domain) {{ @($owner.Domain, $owner.User) -join '\\' }} else {{ $owner.User }}
                if (-not (Test-IsAdminOrServiceAccount $candidate)) {{
                    return $candidate
                }}
                if (-not $detectedUser) {{ $detectedUser = $candidate }}
            }}
        }}
    }} catch {{}}

    try {{
        $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
        if ($cs.UserName) {{
            if (-not (Test-IsAdminOrServiceAccount $cs.UserName)) {{
                return $cs.UserName
            }}
            if (-not $detectedUser) {{ $detectedUser = $cs.UserName }}
        }}
    }} catch {{}}

    try {{
        $quser = query user 2>$null | Select-Object -Skip 1
        foreach ($line in $quser) {{
            $parts = $line.Trim() -split '\\s+'
            if ($parts.Count -ge 2) {{
                $u = $parts[0].Replace('>', '').Trim()
                if (-not (Test-IsAdminOrServiceAccount $u)) {{
                    return $u
                }}
            }}
        }}
    }} catch {{}}

    try {{
        $lastLogon = (Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI" -ErrorAction SilentlyContinue).LastLoggedOnUser
        if ($lastLogon -and (-not (Test-IsAdminOrServiceAccount $lastLogon))) {{
            return $lastLogon
        }}
        $defUser = (Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon" -ErrorAction SilentlyContinue).DefaultUserName
        if ($defUser -and (-not (Test-IsAdminOrServiceAccount $defUser))) {{
            return $defUser
        }}
    }} catch {{}}

    if ($detectedUser) {{ return $detectedUser }}
    return $env:USERNAME
}}

function Get-SystemMetrics {{
    $cpu = 0
    $cpuModel = ""
    $vcpuCount = 0
    try {{
        $proc = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $proc) {{
            $proc = Get-WmiObject Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
        }}
        if ($proc) {{
            if ($proc.Name) {{ $cpuModel = $proc.Name.Trim() }}
            if ($proc.NumberOfLogicalProcessors) {{ $vcpuCount = [int]$proc.NumberOfLogicalProcessors }}
            if ($proc.LoadPercentage -ne $null) {{ $cpu = [int]$proc.LoadPercentage }}
        }}
    }} catch {{}}

    # Fallback ultra-resiliente para CPU e vCPU (Funciona 100% em qualquer Windows Server ou Workstation)
    if (-not $cpuModel) {{
        try {{
            $regCpu = (Get-ItemProperty -Path "HKLM:\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0" -Name "ProcessorNameString" -ErrorAction SilentlyContinue).ProcessorNameString
            if ($regCpu) {{ $cpuModel = $regCpu.Trim() }}
        }} catch {{}}
    }}
    if ($vcpuCount -eq 0) {{
        try {{
            $vcpuCount = [int]$env:NUMBER_OF_PROCESSORS
        }} catch {{}}
    }}

    $os = $null
    $ramTotalMB = 0
    $ramUsedMB = 0
    $ramPct = 0.0
    try {{
        $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
        if (-not $os) {{
            $os = Get-WmiObject Win32_OperatingSystem -ErrorAction SilentlyContinue
        }}
        if ($os -and $os.TotalVisibleMemorySize) {{
            $ramTotalMB = [math]::Round($os.TotalVisibleMemorySize / 1024, 0)
            $ramFreeMB = [math]::Round($os.FreePhysicalMemory / 1024, 0)
            $ramUsedMB = $ramTotalMB - $ramFreeMB
        }}
    }} catch {{}}

    # Fallback de RAM via ComputerSystem / PhysicalMemory caso Win32_OperatingSystem venha zerado
    if ($ramTotalMB -eq 0) {{
        try {{
            $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
            if (-not $cs) {{ $cs = Get-WmiObject Win32_ComputerSystem -ErrorAction SilentlyContinue }}
            if ($cs -and $cs.TotalPhysicalMemory) {{
                $ramTotalMB = [math]::Round($cs.TotalPhysicalMemory / 1MB, 0)
            }}
        }} catch {{}}
        if ($ramTotalMB -eq 0) {{
            try {{
                $pmSum = (Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue | Measure-Object -Property Capacity -Sum).Sum
                if ($pmSum) {{ $ramTotalMB = [math]::Round($pmSum / 1MB, 0) }}
            }} catch {{}}
        }}
    }}

    if ($ramTotalMB -gt 0 -and $ramUsedMB -gt 0) {{
        $ramPct = [math]::Round(($ramUsedMB / $ramTotalMB) * 100, 1)
    }}

    $disks = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue | ForEach-Object {{
        @{{
            drive = $_.DeviceID
            total_gb = [math]::Round($_.Size / 1GB, 1)
            free_gb = [math]::Round($_.FreeSpace / 1GB, 1)
            used_pct = [math]::Round((($_.Size - $_.FreeSpace) / $_.Size) * 100, 1)
        }}
    }})

    $physicalDisks = @()
    try {{
        $pDisks = Get-PhysicalDisk -ErrorAction SilentlyContinue
        if ($pDisks) {{
            $physicalDisks = @($pDisks | ForEach-Object {{
                $mType = if ($_.MediaType -and $_.MediaType -ne "Unspecified") {{ $_.MediaType }} else {{ "SSD" }}
                $szGb = [math]::Round($_.Size / 1GB, 0)
                @{{
                    model      = $_.FriendlyName.Trim()
                    media_type = $mType
                    size_gb    = $szGb
                }}
            }})
        }}
    }} catch {{}}
    if ($physicalDisks.Count -eq 0) {{
        try {{
            $physicalDisks = @(Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | ForEach-Object {{
                $szGb = [math]::Round($_.Size / 1GB, 0)
                $isSsd = ($_.Model -like "*SSD*" -or $_.MediaType -like "*SSD*")
                @{{
                    model      = $_.Model.Trim()
                    media_type = if ($isSsd) {{ "SSD" }} else {{ "Disco" }}
                    size_gb    = $szGb
                }}
            }})
        }} catch {{}}
    }}

    $ipAddress = "unknown"
    $macAddress = $null
    try {{
        $ipInfo = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Ethernet*","Wi-Fi*" -ErrorAction SilentlyContinue |
                  Where-Object {{ $_.IPAddress -notlike "169.254*" -and $_.IPAddress -ne "127.0.0.1" }} |
                  Select-Object -First 1
        if ($ipInfo) {{ $ipAddress = $ipInfo.IPAddress }}
        $netAdapter = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=True" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($netAdapter.MACAddress) {{ $macAddress = $netAdapter.MACAddress.Trim() }}
    }} catch {{}}

    $brand = "Desconhecido"
    $model = "Desconhecido"
    $serialNumber = "Desconhecido"
    $deviceType = "Desktop"

    # Detecção nativa de Windows Server (ProductType 2 ou 3)
    if ($os -and ($os.ProductType -in 2, 3 -or $os.Caption -like "*Server*")) {{
        $deviceType = "Servidor"
    }} else {{
        try {{
            $battery = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue
            if ($null -ne $battery) {{
                $deviceType = "Notebook"
            }} else {{
                $enclosure = Get-CimInstance Win32_SystemEnclosure -ErrorAction SilentlyContinue
                if ($enclosure.ChassisTypes) {{
                    $portableTypes = @(8, 9, 10, 11, 12, 14, 18, 21, 31, 32)
                    foreach ($ct in $enclosure.ChassisTypes) {{
                        if ($portableTypes -contains [int]$ct) {{
                            $deviceType = "Notebook"
                            break
                        }}
                    }}
                }}
            }}
        }} catch {{}}
    }}

    try {{
        $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
        if ($cs.Manufacturer) {{ $brand = $cs.Manufacturer.Trim() }}
        if ($cs.Model) {{ $model = $cs.Model.Trim() }}
    }} catch {{}}

    try {{
        $bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue
        if ($bios.SerialNumber) {{ $serialNumber = $bios.SerialNumber.Trim() }}
    }} catch {{}}

    $uptimeHours = 0.0
    try {{
        if ($os -and $os.LastBootUpTime) {{
            $uptimeHours = [math]::Round((((Get-Date) - $os.LastBootUpTime).TotalHours), 1)
        }}
    }} catch {{}}

    return @{{
        hostname       = $env:COMPUTERNAME
        logged_user    = Get-LoggedUser
        ip_address     = $ipAddress
        cpu_usage_pct  = $cpu
        cpu_model      = $cpuModel
        vcpu_count     = [int]$vcpuCount
        ram_used_mb    = [int]$ramUsedMB
        ram_total_mb   = [int]$ramTotalMB
        ram_usage_pct  = [double]$ramPct
        disks          = [object[]]@($disks)
        physical_disks = [object[]]@($physicalDisks)
        uptime_hours   = $uptimeHours
        os_name        = if ($os -and $os.Caption) {{ $os.Caption }} else {{ "Windows" }}
        brand          = $brand
        model          = $model
        serial_number  = $serialNumber
        mac_address    = $macAddress
        device_type    = $deviceType
    }}
}}

try {{
    $metrics = Get-SystemMetrics
    $payload = $metrics | ConvertTo-Json -Depth 4
    $headers = @{{
        "Content-Type"  = "application/json"
        "X-Agent-Token" = $AGENT_SECRET
    }}
    $res = Invoke-RestMethod -Uri $SERVER_URL -Method POST -Body $payload -Headers $headers -TimeoutSec 10
    Write-Host "[OK] TIHFSA Sentinel Agent: Telemetria enviada com sucesso para $SERVER_URL ($($metrics.hostname) - $($metrics.logged_user))" -ForegroundColor Green
}} catch {{
    try {{
        $curlOut = $payload | curl.exe -k -s -X POST -H "Content-Type: application/json" -H "X-Agent-Token: $AGENT_SECRET" --data-binary "@-" $SERVER_URL
        if ($curlOut -like '*"status":"ok"*') {{
            Write-Host "[OK] TIHFSA Sentinel Agent: Telemetria enviada com sucesso via curl ($($metrics.hostname) - $($metrics.logged_user))" -ForegroundColor Green
        }} else {{
            Write-Warning "[AVISO] Falha ao enviar telemetria: $curlOut"
        }}
    }} catch {{
        Write-Error "[ERRO] Nao foi possivel conectar ao servidor: $_"
    }}
}}
"""
    resp_headers = {}
    if download:
        resp_headers["Content-Disposition"] = 'attachment; filename="tihfsa-agent.ps1"'
    return Response(content=ps_script, media_type="text/plain; charset=utf-8", headers=resp_headers)
