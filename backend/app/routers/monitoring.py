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
    installed_apps: Optional[list[dict]] = None
    windows_product_key: Optional[str] = None
    office_version: Optional[str] = None


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

    # Cálculo da Memória RAM (arredondamento comercial para compensar reserva de hardware/kernel)
    ram_formatted = None
    ram_gb = None
    if data.ram_total_mb and data.ram_total_mb > 0:
        mb = data.ram_total_mb
        if 30000 <= mb <= 33500:
            ram_gb = 32
        elif 14500 <= mb <= 17000:
            ram_gb = 16
        elif 7000 <= mb <= 8500:
            ram_gb = 8
        elif 3500 <= mb <= 4300:
            ram_gb = 4
        elif 60000 <= mb <= 66000:
            ram_gb = 64
        elif 120000 <= mb <= 132000:
            ram_gb = 128
        else:
            ram_gb = round(mb / 1024)
        ram_formatted = f"{ram_gb} GB"

    # Cálculo do Armazenamento (suporte inteligente a múltiplas unidades reais e SSD)
    storage_units = []
    if disks_normalized:
        for d in disks_normalized:
            if isinstance(d, dict):
                drive = d.get("drive", "").strip()
                total_gb = d.get("total_gb", 0)
                # Ignora partições efêmeras e virtuais de sistema como efivars, efi, boot, tmpfs
                if any(drive.startswith(p) for p in ("/sys", "/dev", "/run", "/boot")):
                    continue
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

    # Normalização de Fabricante / Modelo (Hyper-V, VMware, KVM/QEMU)
    brand_clean = data.brand.strip() if data.brand and data.brand.strip().lower() != "desconhecido" else None
    model_clean = data.model.strip() if data.model and data.model.strip().lower() != "desconhecido" else None

    if brand_clean == "Microsoft Corporation" and (not model_clean or "virtual machine" in model_clean.lower()):
        brand_clean = "Microsoft Hyper-V"
        model_clean = "Máquina Virtual"
    elif brand_clean and "vmware" in brand_clean.lower():
        brand_clean = "VMware"
        model_clean = "Máquina Virtual"
    elif brand_clean and ("qemu" in brand_clean.lower() or "kvm" in brand_clean.lower()):
        brand_clean = "QEMU / KVM"
        model_clean = "Máquina Virtual"

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
        "windows_product_key": data.windows_product_key,
        "office_version": data.office_version,
        "installed_apps": data.installed_apps or [],
    }

    # Inferência inteligente do tipo de ativo (Servidor, Notebook ou Desktop)
    is_server_detected = bool(
        (data.os_name and "server" in data.os_name.lower())
        or (data.device_type and "servidor" in data.device_type.lower())
        or (model_clean and "máquina virtual" in model_clean.lower())
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
            brand=brand_clean,
            model=model_clean,
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
        if brand_clean:
            asset.brand = brand_clean
        if model_clean:
            asset.model = model_clean
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


@router.get("/agent/script", summary="Download ou execução do script do Agente (Windows ou Linux)")
def get_agent_powershell_script(request: Request, download: bool = False, os: str = "windows"):
    """
    Retorna o script do Sentinel Agent configurado para o servidor atual.
    Suporta ?os=windows (padrão) e ?os=linux.
    """
    if os.lower() in ("linux", "ubuntu", "debian"):
        return get_agent_linux_script(request=request, download=download)

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

    # Chave de Ativacao do Windows (BIOS OA3 / MSDM)
    $winKey = ""
    try {{
        $oa3 = (Get-CimInstance SoftwareLicensingService -ErrorAction SilentlyContinue).OA3xOriginalProductKey
        if ($oa3) {{ $winKey = $oa3.Trim() }}
    }} catch {{}}

    # Versao do Microsoft Office / Microsoft 365 instalada
    $officeVer = ""
    try {{
        $officeKeys = @(
            "HKLM:\\SOFTWARE\\Microsoft\\Office\\ClickToRun\\Configuration",
            "HKLM:\\SOFTWARE\\Microsoft\\Office\\16.0\\Common\\ProductVersion",
            "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Office\\16.0\\Common\\ProductVersion"
        )
        foreach ($k in $officeKeys) {{
            if (Test-Path $k) {{
                $prop = Get-ItemProperty $k -ErrorAction SilentlyContinue
                if ($prop.ProductReleaseIds) {{
                    $officeVer = "$($prop.ProductReleaseIds) $($prop.VersionToReport)".Trim()
                    break
                }}
            }}
        }}
    }} catch {{}}

    # Inventario Completo de Softwares / Programas Instalados (Painel de Controle / Registro)
    $installedApps = @()
    try {{
        $uninstallPaths = @(
            "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
            "HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
        )
        $rawApps = Get-ItemProperty $uninstallPaths -ErrorAction SilentlyContinue | Where-Object {{
            $_.DisplayName -and ($_.SystemComponent -ne 1) -and ($_.ParentKeyName -eq $null) -and ($_.DisplayName -notmatch '^KB[0-9]+')
        }} | Select-Object -Property DisplayName, DisplayVersion, Publisher, InstallDate | Sort-Object DisplayName -Unique
        
        foreach ($app in $rawApps) {{
            $installedApps += @{{
                name         = $app.DisplayName.Trim()
                version      = if ($app.DisplayVersion) {{ "$($app.DisplayVersion)".Trim() }} else {{ "" }}
                publisher    = if ($app.Publisher) {{ "$($app.Publisher)".Trim() }} else {{ "" }}
                install_date = if ($app.InstallDate) {{ "$($app.InstallDate)".Trim() }} else {{ "" }}
            }}
        }}
    }} catch {{}}

    return @{{
        hostname            = $env:COMPUTERNAME
        logged_user         = Get-LoggedUser
        ip_address          = $ipAddress
        cpu_usage_pct       = $cpu
        cpu_model           = $cpuModel
        vcpu_count          = [int]$vcpuCount
        ram_used_mb         = [int]$ramUsedMB
        ram_total_mb        = [int]$ramTotalMB
        ram_usage_pct       = [double]$ramPct
        disks               = [object[]]@($disks)
        physical_disks      = [object[]]@($physicalDisks)
        uptime_hours        = $uptimeHours
        os_name             = if ($os -and $os.Caption) {{ $os.Caption }} else {{ "Windows" }}
        brand               = $brand
        model               = $model
        serial_number       = $serialNumber
        mac_address         = $macAddress
        device_type         = $deviceType
        windows_product_key = $winKey
        office_version      = $officeVer
        installed_apps      = [object[]]@($installedApps)
    }}
}}

try {{
    $metrics = Get-SystemMetrics
    $payload = $metrics | ConvertTo-Json -Depth 5
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


@router.get("/agent/linux-script", summary="Download ou execução do script Bash do Agente para Linux")
def get_agent_linux_script(request: Request, download: bool = False):
    """
    Retorna o script Bash do Sentinel Agent configurado para o servidor atual.
    Compatível com Ubuntu (18.04 a 24.04+), Debian (10 a 12+) e derivadas.
    Uso imediato via: 'curl -k -s "..." | bash'
    """
    host = request.headers.get("Host", "127.0.0.1:8000")
    protocol = "https" if request.url.scheme == "https" or "https" in request.headers.get("X-Forwarded-Proto", "") else "http"
    server_endpoint = f"{protocol}://{host}/api/v1/monitoring/agent/checkin"

    sh_script = f"""#!/usr/bin/env bash
# ==============================================================================
# TIHFSA Sentinel Agent — Telemetria de Estação e Servidor Linux
# Hotel Fasano Salvador | Suporte nativo para Ubuntu, Debian e derivadas
# ==============================================================================
set -e

SERVER_URL="{server_endpoint}"
AGENT_SECRET="{AGENT_DEFAULT_TOKEN}"

# 1. Identificação do Hostname
HOSTNAME=$(hostname -s 2>/dev/null || cat /etc/hostname 2>/dev/null || uname -n)

# 2. Usuário Logado Interativo
LOGGED_USER=""
if command -v who >/dev/null 2>&1; then
    LOGGED_USER=$(who 2>/dev/null | awk '{{print $1}}' | sort -u | grep -v -E '^(root|daemon|nobody|systemd.*)$' | head -n 1 || true)
fi
if [ -z "$LOGGED_USER" ] && command -v logname >/dev/null 2>&1; then
    CANDIDATE=$(logname 2>/dev/null || true)
    if [ "$CANDIDATE" != "root" ] && [ -n "$CANDIDATE" ]; then
        LOGGED_USER="$CANDIDATE"
    fi
fi
if [ -z "$LOGGED_USER" ] && [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
    LOGGED_USER="$SUDO_USER"
fi
if [ -z "$LOGGED_USER" ]; then
    COMMON_USER=$(find /home -maxdepth 1 -mindepth 1 -type d 2>/dev/null | awk -F/ '{{print $NF}}' | grep -v -E '^(lost\\+found)$' | head -n 1 || true)
    if [ -n "$COMMON_USER" ]; then
        LOGGED_USER="$COMMON_USER"
    else
        LOGGED_USER="$(whoami 2>/dev/null || echo "root")"
    fi
fi

# 3. IP e Interface de Rede Padrão
DEFAULT_IFACE=$(ip route show default 2>/dev/null | awk '{{print $5}}' | head -n 1 || true)
IP_ADDRESS="127.0.0.1"
MAC_ADDRESS=""

if [ -n "$DEFAULT_IFACE" ]; then
    IP_ADDRESS=$(ip -4 addr show dev "$DEFAULT_IFACE" 2>/dev/null | grep -oP '(?<=inet\\s)\\d+(\\.\\d+){{3}}' | head -n 1 || true)
    if [ -f "/sys/class/net/$DEFAULT_IFACE/address" ]; then
        MAC_ADDRESS=$(cat "/sys/class/net/$DEFAULT_IFACE/address" 2>/dev/null | tr '[:lower:]' '[:upper:]')
    fi
fi

if [ -z "$IP_ADDRESS" ] || [ "$IP_ADDRESS" = "127.0.0.1" ]; then
    IP_ADDRESS=$(hostname -I 2>/dev/null | awk '{{print $1}}' || echo "unknown")
fi

if [ -z "$MAC_ADDRESS" ]; then
    MAC_ADDRESS=$(ip link show 2>/dev/null | awk '/ether/ {{print $2}}' | head -n 1 | tr '[:lower:]' '[:upper:]' || true)
fi

# 4. Processador (CPU e vCPU)
CPU_MODEL=""
if [ -f /proc/cpuinfo ]; then
    CPU_MODEL=$(grep -m1 "model name" /proc/cpuinfo 2>/dev/null | cut -d: -f2 | sed 's/^[ \\t]*//' | tr -d '"\\r\\n' || true)
fi
if [ -z "$CPU_MODEL" ] && command -v lscpu >/dev/null 2>&1; then
    CPU_MODEL=$(lscpu 2>/dev/null | grep -E "Model name" | cut -d: -f2 | sed 's/^[ \\t]*//' | tr -d '"\\r\\n' || true)
fi
if [ -z "$CPU_MODEL" ]; then
    CPU_MODEL="$(uname -m)"
fi

VCPU_COUNT=1
if command -v nproc >/dev/null 2>&1; then
    VCPU_COUNT=$(nproc 2>/dev/null || echo 1)
elif [ -f /proc/cpuinfo ]; then
    VCPU_COUNT=$(grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 1)
fi

# 5. Uso de CPU (%) em 0.5s via /proc/stat
CPU_USAGE=0
if [ -f /proc/stat ]; then
    STAT1=$(awk '/^cpu / {{print $2+$3+$4+$5+$6+$7+$8+$9, $5+$6}}' /proc/stat 2>/dev/null || true)
    sleep 0.5
    STAT2=$(awk '/^cpu / {{print $2+$3+$4+$5+$6+$7+$8+$9, $5+$6}}' /proc/stat 2>/dev/null || true)
    
    T1=$(echo "$STAT1" | awk '{{print $1}}')
    I1=$(echo "$STAT1" | awk '{{print $2}}')
    T2=$(echo "$STAT2" | awk '{{print $1}}')
    I2=$(echo "$STAT2" | awk '{{print $2}}')
    
    if [ -n "$T1" ] && [ -n "$T2" ]; then
        DIFF_TOTAL=$(( T2 - T1 ))
        DIFF_IDLE=$(( I2 - I1 ))
        
        if [ "$DIFF_TOTAL" -gt 0 ]; then
            CPU_USAGE=$(( ((DIFF_TOTAL - DIFF_IDLE) * 100) / DIFF_TOTAL ))
            [ "$CPU_USAGE" -lt 0 ] && CPU_USAGE=0
            [ "$CPU_USAGE" -gt 100 ] && CPU_USAGE=100
        fi
    fi
fi

# 6. Memória RAM (MB e %)
RAM_TOTAL_MB=0
RAM_USED_MB=0
RAM_USAGE_PCT="0.0"

if [ -f /proc/meminfo ]; then
    MEM_TOTAL_KB=$(grep -m1 "MemTotal:" /proc/meminfo | awk '{{print $2}}')
    MEM_AVAIL_KB=$(grep -m1 "MemAvailable:" /proc/meminfo | awk '{{print $2}}' || true)
    
    if [ -z "$MEM_AVAIL_KB" ] || [ "$MEM_AVAIL_KB" -eq 0 ]; then
        MEM_FREE_KB=$(grep -m1 "MemFree:" /proc/meminfo | awk '{{print $2}}')
        MEM_BUFFERS_KB=$(grep -m1 "Buffers:" /proc/meminfo | awk '{{print $2}}')
        MEM_CACHED_KB=$(grep -m1 "^Cached:" /proc/meminfo | awk '{{print $2}}')
        MEM_AVAIL_KB=$(( ${{MEM_FREE_KB:-0}} + ${{MEM_BUFFERS_KB:-0}} + ${{MEM_CACHED_KB:-0}} ))
    fi
    
    if [ -n "$MEM_TOTAL_KB" ] && [ "$MEM_TOTAL_KB" -gt 0 ]; then
        RAM_TOTAL_MB=$(( MEM_TOTAL_KB / 1024 ))
        RAM_USED_MB=$(( (MEM_TOTAL_KB - MEM_AVAIL_KB) / 1024 ))
        [ "$RAM_USED_MB" -lt 0 ] && RAM_USED_MB=0
        RAM_USAGE_PCT=$(awk -v u="$RAM_USED_MB" -v t="$RAM_TOTAL_MB" 'BEGIN {{ if (t > 0) printf "%.1f", (u/t)*100; else print "0.0" }}')
    fi
fi

# 7. Discos Lógicos (Partições montadas reais de dados)
DISKS_JSON="["
FIRST_DISK=1
while read -r mountpoint total_mb avail_mb pct; do
    [ -z "$mountpoint" ] && continue
    case "$mountpoint" in
        /sys*|/dev*|/run*|/boot*|/var/lib/docker*) continue ;;
    esac
    total_gb=$(awk -v m="$total_mb" 'BEGIN {{ printf "%.1f", m/1024 }}')
    free_gb=$(awk -v m="$avail_mb" 'BEGIN {{ printf "%.1f", m/1024 }}')
    clean_pct=$(echo "$pct" | tr -d '%')
    
    if [ "$FIRST_DISK" -eq 0 ]; then
        DISKS_JSON="$DISKS_JSON,"
    fi
    DISKS_JSON="$DISKS_JSON{{\\"drive\\":\\"$mountpoint\\",\\"total_gb\\":$total_gb,\\"free_gb\\":$free_gb,\\"used_pct\\":${{clean_pct:-0}}}}"
    FIRST_DISK=0
done < <(df -m -P -x tmpfs -x devtmpfs -x squashfs -x overlay -x iso9660 -x efivarfs 2>/dev/null | awk 'NR>1 {{print $6, $2, $4, $5}}')
DISKS_JSON="$DISKS_JSON]"

# 8. Discos Físicos (Hardware SSD vs HDD lido via kernel /sys/block)
PHYSICAL_DISKS_JSON="["
FIRST_PDISK=1
for blk in /sys/block/sd* /sys/block/nvme* /sys/block/vd*; do
    [ -d "$blk" ] || continue
    name=$(basename "$blk")
    [ -f "$blk/partition" ] && continue
    
    sz_gb=0
    if [ -f "$blk/size" ]; then
        sz_sectors=$(cat "$blk/size" 2>/dev/null || echo 0)
        sz_gb=$(awk -v s="$sz_sectors" 'BEGIN {{ printf "%d", (s * 512) / (1024*1024*1024) }}')
    fi
    
    media_type="SSD"
    if [ -f "$blk/queue/rotational" ]; then
        rot=$(cat "$blk/queue/rotational" 2>/dev/null || echo 0)
        [ "$rot" = "1" ] && media_type="HDD"
    fi
    
    model="Disk $name"
    if [ -f "$blk/device/model" ]; then
        d_model=$(cat "$blk/device/model" 2>/dev/null | tr -d '"\\r\\n' | sed 's/^[ \\t]*//;s/[ \\t]*$//')
        [ -n "$d_model" ] && model="$d_model"
    fi
    
    if [ "$FIRST_PDISK" -eq 0 ]; then
        PHYSICAL_DISKS_JSON="$PHYSICAL_DISKS_JSON,"
    fi
    PHYSICAL_DISKS_JSON="$PHYSICAL_DISKS_JSON{{\\"model\\":\\"$model\\",\\"media_type\\":\\"$media_type\\",\\"size_gb\\":${{sz_gb:-0}}}}"
    FIRST_PDISK=0
done
PHYSICAL_DISKS_JSON="$PHYSICAL_DISKS_JSON]"

# 9. Sistema Operacional
OS_NAME="Linux"
if [ -f /etc/os-release ]; then
    OS_NAME=$(source /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || true)
fi
[ -z "$OS_NAME" ] && OS_NAME="$(uname -s) $(uname -r)"
OS_NAME=$(echo "$OS_NAME" | tr -d '"\\r\\n')

# 10. Uptime em Horas
UPTIME_HOURS="0.0"
if [ -f /proc/uptime ]; then
    UPTIME_HOURS=$(awk '{{printf "%.1f", $1/3600}}' /proc/uptime 2>/dev/null || echo "0.0")
fi

# 11. Fabricante, Modelo e Serial Number
BRAND=""
MODEL=""
SERIAL=""

[ -f /sys/class/dmi/id/sys_vendor ] && BRAND=$(cat /sys/class/dmi/id/sys_vendor 2>/dev/null | tr -d '"\\r\\n' || true)
[ -f /sys/class/dmi/id/product_name ] && MODEL=$(cat /sys/class/dmi/id/product_name 2>/dev/null | tr -d '"\\r\\n' || true)
[ -f /sys/class/dmi/id/product_serial ] && SERIAL=$(cat /sys/class/dmi/id/product_serial 2>/dev/null | tr -d '"\\r\\n' || true)

# Detecção e normalização de VMs Hyper-V, VMware e KVM
if [ "$BRAND" = "Microsoft Corporation" ] && {{ [ -z "$MODEL" ] || [ "$MODEL" = "Virtual Machine" ]; }}; then
    BRAND="Microsoft Hyper-V"
    MODEL="Máquina Virtual"
fi

VIRT=""
if command -v systemd-detect-virt >/dev/null 2>&1; then
    VIRT=$(systemd-detect-virt 2>/dev/null || true)
fi

if [ -n "$VIRT" ] && [ "$VIRT" != "none" ]; then
    [ -z "$BRAND" ] && BRAND="Virtual ($VIRT)"
    [ -z "$MODEL" ] && MODEL="VM ($VIRT)"
fi

[ -z "$BRAND" ] && BRAND="Linux Host"
[ -z "$MODEL" ] && MODEL="Generic PC"
[ -z "$SERIAL" ] && SERIAL="Desconhecido"

# 12. Tipo do Dispositivo
DEVICE_TYPE="Servidor"
if [ -d /sys/class/power_supply ] && ls /sys/class/power_supply/BAT* >/dev/null 2>&1; then
    DEVICE_TYPE="Notebook"
elif [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
    DEVICE_TYPE="Desktop"
fi

# 13. Softwares e Aplicações Instaladas no Linux (Pacotes principais via dpkg)
APPS_JSON="["
FIRST_APP=1
if command -v dpkg-query >/dev/null 2>&1; then
    while IFS=$$'\\t' read -r pkg ver; do
        [ -z "$pkg" ] && continue
        if [ "$FIRST_APP" -eq 0 ]; then APPS_JSON="$APPS_JSON,"; fi
        APPS_JSON="$APPS_JSON{{\\"name\\":\\"$pkg\\",\\"version\\":\\"$ver\\",\\"publisher\\":\\"Ubuntu/Debian\\",\\"install_date\\":\\"\\"}}"
        FIRST_APP=0
    done < <(dpkg-query -W -f='${{Package}}\\t${{Version}}\\n' 2>/dev/null | grep -E -i '^(docker|containerd|nginx|mysql|mariadb|postgres|apache2|zabbix|openssh|php|node|python3|fail2ban|ufw|samba|cron|rsyslog|redis|git|curl|vim|nano)' | head -n 40 || true)
fi
APPS_JSON="$APPS_JSON]"

# Payload JSON
PAYLOAD=$(cat <<EOF
{{
  "hostname": "$HOSTNAME",
  "logged_user": "$LOGGED_USER",
  "ip_address": "$IP_ADDRESS",
  "cpu_usage_pct": $CPU_USAGE,
  "cpu_model": "$CPU_MODEL",
  "vcpu_count": $VCPU_COUNT,
  "ram_used_mb": $RAM_USED_MB,
  "ram_total_mb": $RAM_TOTAL_MB,
  "ram_usage_pct": $RAM_USAGE_PCT,
  "disks": $DISKS_JSON,
  "physical_disks": $PHYSICAL_DISKS_JSON,
  "uptime_hours": $UPTIME_HOURS,
  "os_name": "$OS_NAME",
  "brand": "$BRAND",
  "model": "$MODEL",
  "serial_number": "$SERIAL",
  "mac_address": "$MAC_ADDRESS",
  "device_type": "$DEVICE_TYPE",
  "installed_apps": $APPS_JSON
}}
EOF
)

# 13. Envio da Telemetria (curl ou wget)
if command -v curl >/dev/null 2>&1; then
    RESPONSE=$(curl -k -s -w "\\n%{{http_code}}" -X POST \\
        -H "Content-Type: application/json" \\
        -H "X-Agent-Token: $AGENT_SECRET" \\
        -d "$PAYLOAD" \\
        --connect-timeout 8 \\
        --max-time 15 \\
        "$SERVER_URL" 2>/dev/null || true)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
    BODY=$(echo "$RESPONSE" | head -n -1)
    
    if [ "$HTTP_CODE" = "200" ] || echo "$BODY" | grep -q '"status":"ok"'; then
        echo -e "\\033[32m[OK] TIHFSA Sentinel Agent (Linux): Telemetria enviada com sucesso para $SERVER_URL ($HOSTNAME - $LOGGED_USER)\\033[0m"
        exit 0
    else
        echo -e "\\033[33m[AVISO] Resposta do servidor (HTTP $HTTP_CODE): $BODY\\033[0m" >&2
        exit 1
    fi
elif command -v wget >/dev/null 2>&1; then
    TMP_FILE=$(mktemp)
    echo "$PAYLOAD" > "$TMP_FILE"
    if wget -q --no-check-certificate \\
        --header="Content-Type: application/json" \\
        --header="X-Agent-Token: $AGENT_SECRET" \\
        --post-file="$TMP_FILE" \\
        -O - "$SERVER_URL" >/dev/null 2>&1; then
        rm -f "$TMP_FILE"
        echo -e "\\033[32m[OK] TIHFSA Sentinel Agent (Linux): Telemetria enviada via wget para $SERVER_URL ($HOSTNAME - $LOGGED_USER)\\033[0m"
        exit 0
    else
        rm -f "$TMP_FILE"
        echo -e "\\033[31m[ERRO] Falha ao enviar telemetria via wget para $SERVER_URL\\033[0m" >&2
        exit 1
    fi
else
    echo -e "\\033[31m[ERRO] curl ou wget é obrigatório no Linux para envio da telemetria.\\033[0m" >&2
    exit 1
fi
"""
    resp_headers = {}
    if download:
        resp_headers["Content-Disposition"] = 'attachment; filename="tihfsa-agent.sh"'
    return Response(content=sh_script, media_type="text/x-shellscript; charset=utf-8", headers=resp_headers)


@router.get("/agent/linux-install", summary="Script de instalação permanente no Linux (Ubuntu / Debian)")
def get_agent_linux_install(request: Request):
    """
    Retorna o instalador Bash permanente para Ubuntu / Debian.
    Uso: 'curl -k -s "..." | sudo bash'
    """
    host = request.headers.get("Host", "127.0.0.1:8000")
    protocol = "https" if request.url.scheme == "https" or "https" in request.headers.get("X-Forwarded-Proto", "") else "http"
    script_endpoint = f"{protocol}://{host}/api/v1/monitoring/agent/linux-script"
    checkin_endpoint = f"{protocol}://{host}/api/v1/monitoring/agent/checkin"

    install_script = f"""#!/usr/bin/env bash
# ==============================================================================
# Instalador Permanente do TIHFSA Sentinel Agent no Linux (Ubuntu / Debian)
# ==============================================================================
set -e

if [ "$(id -u)" -ne 0 ]; then
    echo -e "\\033[31m[ERRO] Este instalador precisa ser executado como root (use sudo bash).\\033[0m" >&2
    exit 1
fi

SERVER_URL="{checkin_endpoint}"
AGENT_SECRET="{AGENT_DEFAULT_TOKEN}"
SCRIPT_URL="{script_endpoint}"

INSTALL_DIR="/usr/local/bin"
AGENT_BIN="$INSTALL_DIR/tihfsa-agent.sh"
CONFIG_DIR="/etc/tihfsa"
CRON_FILE="/etc/cron.d/tihfsa-agent"

echo -e "\\033[34m[+] Instalando TIHFSA Sentinel Agent para Linux...\\033[0m"

mkdir -p "$INSTALL_DIR" "$CONFIG_DIR"

echo -e "\\033[34m[+] Baixando script do agente de $SCRIPT_URL...\\033[0m"
if command -v curl >/dev/null 2>&1; then
    curl -k -s -L "$SCRIPT_URL" -o "$AGENT_BIN"
elif command -v wget >/dev/null 2>&1; then
    wget -q --no-check-certificate "$SCRIPT_URL" -O "$AGENT_BIN"
else
    echo -e "\\033[31m[ERRO] Instale curl ou wget para prosseguir.\\033[0m" >&2
    exit 1
fi

chmod +x "$AGENT_BIN"

echo -e "\\033[34m[+] Configurando agendador periódico (a cada 1 minuto em /etc/cron.d/)...\\033[0m"
cat << 'EOF' > "$CRON_FILE"
# TIHFSA Sentinel Agent — Execução a cada 1 minuto
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

* * * * * root /usr/local/bin/tihfsa-agent.sh >/dev/null 2>&1
EOF

chmod 644 "$CRON_FILE"

echo -e "\\033[34m[+] Executando o primeiro envio de telemetria agora...\\033[0m"
"$AGENT_BIN" || true

echo -e "\\033[32m[SUCESSO] TIHFSA Sentinel Agent instalado com sucesso no Linux!\\033[0m"
echo -e "O host já está registrado no TIHFSA e enviará métricas continuamente."
"""
    return Response(content=install_script, media_type="text/x-shellscript; charset=utf-8")
