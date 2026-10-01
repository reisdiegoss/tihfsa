"""
Router Monitoring — Central unificada de dados de monitoramento (Helpdesk & NOC) e Telemetria Nativa de Agentes.
"""
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
    ram_used_mb: Optional[int] = None
    ram_total_mb: Optional[int] = None
    ram_usage_pct: Optional[float] = None
    disks: Optional[list[dict]] = None
    uptime_hours: Optional[float] = None
    os_name: Optional[str] = None


class AgentMachineResponse(BaseModel):
    id: int
    hostname: str
    logged_user: Optional[str] = None
    ip_address: str
    cpu_usage_pct: Optional[int] = None
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

    # Avaliação do status de saúde (warning se disco > 90% ou CPU > 95%)
    has_warning = False
    if data.cpu_usage_pct and data.cpu_usage_pct >= 95:
        has_warning = True
    if data.disks:
        for d in data.disks:
            if isinstance(d, dict) and d.get("used_pct", 0) >= 90:
                has_warning = True
                break

    calculated_status = "warning" if has_warning else "online"

    # Busca registro existente do hostname
    checkin = (
        db.query(AgentCheckin)
        .filter(AgentCheckin.hostname.ilike(hostname_clean))
        .first()
    )

    if not checkin:
        # Novo agente detectado
        checkin = AgentCheckin(
            hostname=hostname_clean,
            logged_user=data.logged_user,
            ip_address=ip_clean,
            cpu_usage_pct=data.cpu_usage_pct,
            ram_used_mb=data.ram_used_mb,
            ram_total_mb=data.ram_total_mb,
            ram_usage_pct=data.ram_usage_pct,
            disk_metrics=data.disks,
            uptime_hours=data.uptime_hours,
            os_name=data.os_name,
            status=calculated_status,
            last_seen_at=now,
        )
        db.add(checkin)
    else:
        # Atualização de máquina já cadastrada
        checkin.hostname = hostname_clean
        checkin.logged_user = data.logged_user
        checkin.ip_address = ip_clean
        checkin.cpu_usage_pct = data.cpu_usage_pct
        checkin.ram_used_mb = data.ram_used_mb
        checkin.ram_total_mb = data.ram_total_mb
        checkin.ram_usage_pct = data.ram_usage_pct
        checkin.disk_metrics = data.disks
        checkin.uptime_hours = data.uptime_hours
        checkin.os_name = data.os_name
        checkin.status = calculated_status
        checkin.last_seen_at = now

    # Associação automática com Ativo no CMDB (por IP ou por Nome do equipamento)
    if not checkin.asset_id:
        matched_asset = (
            db.query(Asset)
            .filter(
                or_(
                    Asset.ip_address == ip_clean,
                    Asset.name.ilike(hostname_clean),
                )
            )
            .first()
        )
        if matched_asset:
            checkin.asset_id = matched_asset.id

    db.commit()
    db.refresh(checkin)

    return {
        "status": "ok",
        "hostname": checkin.hostname,
        "asset_id": checkin.asset_id,
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

function Get-LoggedUser {{
    try {{
        $logged = (Get-CimInstance Win32_ComputerSystem).UserName
        if ($logged) {{ return $logged }}
        $quser = query user 2>$null | Select-Object -Skip 1
        if ($quser) {{
            $user = ($quser[0] -split '\\s+')[1]
            return $user.Replace('>', '')
        }}
    }} catch {{}}
    return $env:USERNAME
}}

function Get-SystemMetrics {{
    $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
    $os = Get-CimInstance Win32_OperatingSystem
    $ramTotalMB = [math]::Round($os.TotalVisibleMemorySize / 1024, 0)
    $ramFreeMB = [math]::Round($os.FreePhysicalMemory / 1024, 0)
    $ramUsedMB = $ramTotalMB - $ramFreeMB
    $ramPct = [math]::Round(($ramUsedMB / $ramTotalMB) * 100, 1)

    $disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {{
        @{{
            drive = $_.DeviceID
            total_gb = [math]::Round($_.Size / 1GB, 1)
            free_gb = [math]::Round($_.FreeSpace / 1GB, 1)
            used_pct = [math]::Round((($_.Size - $_.FreeSpace) / $_.Size) * 100, 1)
        }}
    }}

    $ipInfo = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Ethernet*","Wi-Fi*" -ErrorAction SilentlyContinue |
              Where-Object {{ $_.IPAddress -notlike "169.254*" -and $_.IPAddress -ne "127.0.0.1" }} |
              Select-Object -First 1

    $uptimeHours = [math]::Round((((Get-Date) - $os.LastBootUpTime).TotalHours), 1)

    return @{{
        hostname       = $env:COMPUTERNAME
        logged_user    = Get-LoggedUser
        ip_address     = if ($ipInfo) {{ $ipInfo.IPAddress }} else {{ "unknown" }}
        cpu_usage_pct  = [int]$cpu
        ram_used_mb    = [int]$ramUsedMB
        ram_total_mb   = [int]$ramTotalMB
        ram_usage_pct  = [double]$ramPct
        disks          = $disks
        uptime_hours   = $uptimeHours
        os_name        = $os.Caption
    }}
}}

try {{
    $payload = Get-SystemMetrics | ConvertTo-Json -Depth 4
    $headers = @{{
        "Content-Type"  = "application/json"
        "X-Agent-Token" = $AGENT_SECRET
    }}
    Invoke-RestMethod -Uri $SERVER_URL -Method POST -Body $payload -Headers $headers -TimeoutSec 10
}} catch {{
    try {{
        $payload | curl.exe -k -s -X POST -H "Content-Type: application/json" -H "X-Agent-Token: $AGENT_SECRET" --data-binary "@-" $SERVER_URL | Out-Null
    }} catch {{}}
}}
"""
    resp_headers = {}
    if download:
        resp_headers["Content-Disposition"] = 'attachment; filename="tihfsa-agent.ps1"'
    return Response(content=ps_script, media_type="text/plain; charset=utf-8", headers=resp_headers)
