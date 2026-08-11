"""
Router Zabbix — proxy de alertas e criação de tickets a partir de alertas.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user, require_technician
from app.models.user import User
from app.models.ticket import Ticket, TicketStatus, TicketPriority
from app.services.zabbix_service import ZabbixService

router = APIRouter(prefix="/api/v1/zabbix", tags=["Monitoramento Zabbix"])


@router.get("/alerts")
def get_alerts(
    _: User = Depends(get_current_user),
):
    """Retorna alertas ativos do Zabbix."""
    try:
        problems = ZabbixService.get_active_problems()
        return {"alerts": problems, "count": len(problems)}
    except Exception as e:
        return {"alerts": [], "count": 0, "error": str(e)}


@router.get("/hosts")
def get_hosts(
    _: User = Depends(get_current_user),
):
    """Retorna hosts monitorados pelo Zabbix."""
    try:
        hosts = ZabbixService.get_hosts()
        return {"hosts": hosts, "count": len(hosts)}
    except Exception as e:
        return {"hosts": [], "count": 0, "error": str(e)}


@router.post("/alerts/{event_id}/create-ticket")
def create_ticket_from_alert(
    event_id: str,
    title: str,
    description: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    """
    Cria um chamado a partir de um alerta do Zabbix.
    O técnico clica no alerta e gera o ticket automaticamente.
    """
    ticket = Ticket(
        title=f"[Zabbix] {title}",
        description=description or f"Chamado gerado automaticamente a partir do alerta Zabbix (Event ID: {event_id})",
        status=TicketStatus.IN_PROGRESS,
        priority=TicketPriority.HIGH,
        requester_id=current_user.id,
        technician_id=current_user.id,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket
