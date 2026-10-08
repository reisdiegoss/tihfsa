"""
Router NotificationLogs — Auditoria, Consulta e Reenvio de Notificações do Sistema (E-mail e WhatsApp).
Hotel Fasano Salvador — TI Corporativa
"""
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.notification_log import NotificationLog
from app.models.user import User
from app.auth.dependencies import require_technician

router = APIRouter(prefix="/api/v1/notifications/logs", tags=["Notificações"])


class NotificationLogItem(BaseModel):
    id: int
    channel: str
    notification_type: str
    recipient: str
    recipient_name: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    ticket_id: Optional[int] = None
    status: str
    error_message: Optional[str] = None
    resend_count: int
    last_attempt_at: datetime
    created_at: datetime


class NotificationLogsResponse(BaseModel):
    total_count: int
    items: List[NotificationLogItem]


class NotificationStatsResponse(BaseModel):
    total: int
    sent: int
    failed: int
    email_count: int
    whatsapp_count: int


@router.get("", response_model=NotificationLogsResponse, summary="Listar histórico de notificações disparadas")
def list_notification_logs(
    channel: Optional[str] = Query(None, description="EMAIL ou WHATSAPP"),
    status: Optional[str] = Query(None, description="SENT ou FAILED"),
    search: Optional[str] = Query(None, description="Busca por destinatário ou assunto"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    query = db.query(NotificationLog)

    if channel and channel.upper() != "ALL":
        query = query.filter(NotificationLog.channel == channel.upper())

    if status and status.upper() != "ALL":
        query = query.filter(NotificationLog.status == status.upper())

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (NotificationLog.recipient.ilike(term)) |
            (NotificationLog.subject.ilike(term)) |
            (NotificationLog.recipient_name.ilike(term))
        )

    total = query.count()
    items = query.order_by(desc(NotificationLog.created_at)).offset(offset).limit(limit).all()

    return NotificationLogsResponse(
        total_count=total,
        items=[
            NotificationLogItem(
                id=log.id,
                channel=log.channel,
                notification_type=log.notification_type,
                recipient=log.recipient,
                recipient_name=log.recipient_name,
                subject=log.subject,
                body=log.body,
                ticket_id=log.ticket_id,
                status=log.status,
                error_message=log.error_message,
                resend_count=log.resend_count,
                last_attempt_at=log.last_attempt_at,
                created_at=log.created_at,
            )
            for log in items
        ]
    )


@router.get("/stats", response_model=NotificationStatsResponse, summary="Estatísticas de entrega de notificações")
def get_notification_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    total = db.query(NotificationLog).count()
    sent = db.query(NotificationLog).filter(NotificationLog.status == "SENT").count()
    failed = db.query(NotificationLog).filter(NotificationLog.status == "FAILED").count()
    email_cnt = db.query(NotificationLog).filter(NotificationLog.channel == "EMAIL").count()
    wa_cnt = db.query(NotificationLog).filter(NotificationLog.channel == "WHATSAPP").count()

    return NotificationStatsResponse(
        total=total,
        sent=sent,
        failed=failed,
        email_count=email_cnt,
        whatsapp_count=wa_cnt,
    )


@router.post("/{log_id}/resend", summary="Reenviar notificação de forma imediata")
def resend_notification(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    log = db.query(NotificationLog).filter(NotificationLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Registro de notificação não encontrado.")

    now = datetime.now(timezone.utc)
    success = False
    error_msg = None

    if log.channel == "EMAIL":
        from app.services.email_service import send_system_email
        # Disparo SMTP sem log_notification duplicado, já que atualizamos o log atual
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        from app.config import settings

        if not settings.smtp_user or not settings.smtp_password:
            error_msg = "Credenciais SMTP ausentes no .env"
        else:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"[Reenvio] {log.subject}" if log.subject else "Notificação TIHFSA"
            msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_user}>"
            msg["To"] = log.recipient
            msg.attach(MIMEText(log.body or "", "html", "utf-8"))

            try:
                with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
                    server.starttls()
                    server.login(settings.smtp_user, settings.smtp_password)
                    server.send_message(msg)
                success = True
            except Exception as e:
                error_msg = str(e)

    elif log.channel == "WHATSAPP":
        import httpx
        from app.models.integration_config import EvolutionConfig
        evo = db.query(EvolutionConfig).filter(EvolutionConfig.is_active == True).first()
        if not evo or not evo.api_url or not evo.api_key:
            error_msg = "Evolution API (WhatsApp) não configurada ou inativa."
        else:
            try:
                headers = {"apikey": evo.api_key, "Content-Type": "application/json"}
                url = f"{evo.api_url.rstrip('/')}/message/sendText/{evo.instance_name}"
                payload = {"number": log.recipient, "text": log.body or log.subject or ""}
                with httpx.Client(timeout=10, verify=False) as client:
                    resp = client.post(url, json=payload, headers=headers)
                    if resp.status_code in (200, 201):
                        success = True
                    else:
                        error_msg = f"HTTP {resp.status_code}: {resp.text}"
            except Exception as e:
                error_msg = str(e)
    else:
        raise HTTPException(status_code=400, detail=f"Canal de envio '{log.channel}' não suportado.")

    log.resend_count += 1
    log.last_attempt_at = now
    if success:
        log.status = "SENT"
        log.error_message = None
    else:
        log.status = "FAILED"
        log.error_message = error_msg

    db.commit()
    db.refresh(log)

    return {
        "success": success,
        "message": f"Notificação reenviada com sucesso para {log.recipient}!" if success else f"Falha no reenvio: {error_msg}",
        "status": log.status,
        "resend_count": log.resend_count,
        "last_attempt_at": log.last_attempt_at,
    }
