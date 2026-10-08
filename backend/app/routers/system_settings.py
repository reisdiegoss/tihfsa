"""
Router SystemSettings — Gerenciamento de Parâmetros Gerais e Notificações do TIHFSA.
Hotel Fasano Salvador — TI Corporativa
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.auth.dependencies import require_admin, get_current_user

router = APIRouter(prefix="/api/v1/settings/general", tags=["Settings"])


class SystemSettingsSchema(BaseModel):
    support_notification_email: str = "ti-hfsa@fasano.com.br"
    email_header_title: str = "TIHFSA — Hotel Fasano Salvador"
    email_header_subtitle: str = "Central de Serviços & Suporte de TI"
    email_body_title: str = "Notificação de Atendimento"
    ticket_warranty_days: int = 7
    csat_enabled: bool = True
    notify_requester_on_create: bool = True
    notify_requester_on_assign: bool = True
    notify_requester_on_solve: bool = True
    notify_technician_on_assign: bool = True


@router.get("", response_model=SystemSettingsSchema, summary="Obter parâmetros gerais do sistema")
def get_general_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    setting = db.query(SystemSetting).first()
    if not setting:
        setting = SystemSetting()
        db.add(setting)
        db.commit()
        db.refresh(setting)

    return SystemSettingsSchema(
        support_notification_email=setting.support_notification_email or "ti-hfsa@fasano.com.br",
        email_header_title=setting.email_header_title or "TIHFSA — Hotel Fasano Salvador",
        email_header_subtitle=setting.email_header_subtitle or "Central de Serviços & Suporte de TI",
        email_body_title=setting.email_body_title or "Notificação de Atendimento",
        ticket_warranty_days=setting.ticket_warranty_days or 7,
        csat_enabled=setting.csat_enabled if setting.csat_enabled is not None else True,
        notify_requester_on_create=setting.notify_requester_on_create if setting.notify_requester_on_create is not None else True,
        notify_requester_on_assign=setting.notify_requester_on_assign if setting.notify_requester_on_assign is not None else True,
        notify_requester_on_solve=setting.notify_requester_on_solve if setting.notify_requester_on_solve is not None else True,
        notify_technician_on_assign=setting.notify_technician_on_assign if setting.notify_technician_on_assign is not None else True,
    )


@router.put("", response_model=SystemSettingsSchema, summary="Salvar parâmetros gerais e notificações")
def update_general_settings(
    payload: SystemSettingsSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    setting = db.query(SystemSetting).first()
    if not setting:
        setting = SystemSetting()
        db.add(setting)

    email_clean = payload.support_notification_email.strip()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="E-mail de notificação de suporte inválido.")

    if payload.ticket_warranty_days < 1 or payload.ticket_warranty_days > 90:
        raise HTTPException(status_code=400, detail="Prazo de garantia deve ser entre 1 e 90 dias.")

    title_clean = (payload.email_header_title or "").strip() or "TIHFSA — Hotel Fasano Salvador"
    subtitle_clean = (payload.email_header_subtitle or "").strip() or "Central de Serviços & Suporte de TI"
    body_title_clean = (payload.email_body_title or "").strip() or "Notificação de Atendimento"

    setting.support_notification_email = email_clean
    setting.email_header_title = title_clean
    setting.email_header_subtitle = subtitle_clean
    setting.email_body_title = body_title_clean
    setting.ticket_warranty_days = payload.ticket_warranty_days
    setting.csat_enabled = payload.csat_enabled
    setting.notify_requester_on_create = payload.notify_requester_on_create
    setting.notify_requester_on_assign = payload.notify_requester_on_assign
    setting.notify_requester_on_solve = payload.notify_requester_on_solve
    setting.notify_technician_on_assign = payload.notify_technician_on_assign

    db.commit()
    db.refresh(setting)

    return SystemSettingsSchema(
        support_notification_email=setting.support_notification_email,
        email_header_title=setting.email_header_title,
        email_header_subtitle=setting.email_header_subtitle,
        email_body_title=setting.email_body_title,
        ticket_warranty_days=setting.ticket_warranty_days,
        csat_enabled=setting.csat_enabled,
        notify_requester_on_create=setting.notify_requester_on_create,
        notify_requester_on_assign=setting.notify_requester_on_assign,
        notify_requester_on_solve=setting.notify_requester_on_solve,
        notify_technician_on_assign=setting.notify_technician_on_assign,
    )


class TestEmailRequest(BaseModel):
    recipient_email: str | None = None


@router.post("/test-email", summary="Enviar e-mail de teste com o layout configurado")
def send_test_email_endpoint(
    payload: TestEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    from app.services.email_service import render_bulletproof_email, send_system_email, get_support_email
    
    target_email = (payload.recipient_email or "").strip() or current_user.email or get_support_email()
    if not target_email or "@" not in target_email:
        raise HTTPException(status_code=400, detail="E-mail destinatário inválido.")

    setting = db.query(SystemSetting).first()
    header_title = setting.email_header_title if setting else "TIHFSA — Hotel Fasano Salvador"
    header_sub = setting.email_header_subtitle if setting else "Central de Serviços & Suporte de TI"
    body_title = setting.email_body_title if setting else "Notificação de Atendimento"

    content = f"""
    <p style="margin: 0 0 14px;">Olá <strong>{current_user.display_name}</strong>,</p>
    <p style="margin: 0 0 16px;">Este é um e-mail de demonstração emitido para validação do layout no Microsoft Outlook e outros clientes.</p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px;">
        <tr>
            <td style="padding: 14px 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.6;">
                <strong>Título do Cabeçalho:</strong> {header_title}<br>
                <strong>Subtítulo:</strong> {header_sub}<br>
                <strong>Título do Corpo:</strong> {body_title}<br>
                <strong>E-mail de Suporte TI:</strong> {setting.support_notification_email if setting else 'ti-hfsa@fasano.com.br'}<br>
                <strong>Prazo de Garantia:</strong> {setting.ticket_warranty_days if setting else 7} dias
            </td>
        </tr>
    </table>
    """

    action = """
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 22px auto 6px;">
        <tr>
            <td align="center">
                <a href="#" style="display: inline-block; padding: 12px 28px; background-color: #1e3a8a; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    ✅ Configuração Validada
                </a>
            </td>
        </tr>
    </table>
    """

    html = render_bulletproof_email(
        header_title=header_title,
        header_subtitle=header_sub,
        badge_text="TESTE DE CONFIGURAÇÃO",
        badge_bg="#e0f2fe",
        badge_color="#0369a1",
        body_title=body_title,
        content_html=content,
        action_html=action,
        footer_text=f"{header_title} | Teste de Layout Corporativo",
    )

    success = send_system_email(
        to_email=target_email,
        subject=f"[TIHFSA] Teste de Personalização de E-mail — {header_title}",
        html_body=html,
    )

    if not success:
        raise HTTPException(status_code=500, detail="Falha ao despachar e-mail via SMTP. Verifique as credenciais no .env.")

    return {"success": True, "message": f"E-mail de teste enviado com sucesso para {target_email}!"}

