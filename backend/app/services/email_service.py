"""
Service EmailService — envio de e-mails de validação via SMTP.

Usa aiosmtplib para envio mas com wrapper sync para simplicidade.
Template HTML com botões de Aprovar/Rejeitar.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import settings


EMAIL_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f7; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }}
        .header {{ background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; padding: 24px 30px; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 600; }}
        .header p {{ margin: 4px 0 0; opacity: 0.8; font-size: 13px; }}
        .body {{ padding: 30px; }}
        .info-row {{ display: flex; margin-bottom: 12px; }}
        .info-label {{ color: #666; min-width: 120px; font-weight: 600; font-size: 13px; }}
        .info-value {{ color: #333; font-size: 14px; }}
        .solution-box {{ background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0; }}
        .solution-box h3 {{ margin: 0 0 8px; color: #15803d; font-size: 14px; }}
        .solution-box p {{ margin: 0; color: #333; font-size: 14px; line-height: 1.6; }}
        .buttons {{ text-align: center; margin: 28px 0 10px; }}
        .btn {{ display: inline-block; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 0 8px; }}
        .btn-approve {{ background: #22c55e; color: #fff; }}
        .btn-reject {{ background: #ef4444; color: #fff; }}
        .footer {{ text-align: center; padding: 16px; color: #999; font-size: 11px; border-top: 1px solid #eee; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Validação de Chamado #{ticket_id}</h1>
            <p>TIHFSA — Hotel Fasano Salvador</p>
        </div>
        <div class="body">
            <p>Olá <strong>{manager_name}</strong>,</p>
            <p>O chamado abaixo foi resolvido pelo técnico e precisa da sua validação:</p>

            <div style="margin: 20px 0;">
                <div class="info-row"><span class="info-label">Chamado:</span> <span class="info-value">#{ticket_id} — {ticket_title}</span></div>
                <div class="info-row"><span class="info-label">Solicitante:</span> <span class="info-value">{requester_name}</span></div>
                <div class="info-row"><span class="info-label">Técnico:</span> <span class="info-value">{technician_name}</span></div>
            </div>

            <div class="solution-box">
                <h3>💡 Solução Aplicada:</h3>
                <p>{solution}</p>
            </div>

            <div class="buttons">
                <a href="{approve_url}" class="btn btn-approve">✅ Aprovar Solução</a>
                <a href="{reject_url}" class="btn btn-reject">❌ Recusar</a>
            </div>
        </div>
        <div class="footer">
            Este é um e-mail automático do sistema TIHFSA. Links válidos por 72 horas.
        </div>
    </div>
</body>
</html>
"""


def send_validation_email(
    ticket,
    requester_name: str,
    manager_email: str,
    manager_name: str,
    technician_name: str,
    solution: str,
    approve_url: str,
    reject_url: str,
):
    """Envia e-mail HTML de validação para o gestor via SMTP."""
    if not settings.smtp_user or not settings.smtp_password:
        print("[WARN] SMTP não configurado. E-mail de validação não enviado.")
        return

    html_content = EMAIL_TEMPLATE.format(
        ticket_id=ticket.id,
        ticket_title=ticket.title,
        requester_name=requester_name,
        manager_name=manager_name,
        technician_name=technician_name,
        solution=solution,
        approve_url=approve_url,
        reject_url=reject_url,
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[TIHFSA] Validação Chamado #{ticket.id} — {ticket.title}"
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_user}>"
    msg["To"] = manager_email
    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        print(f"[INFO] E-mail de validação enviado para {manager_email}")
    except Exception as e:
        print(f"[ERROR] Falha ao enviar e-mail: {e}")
        raise


NOC_ALERT_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f1f5f9; padding: 20px; color: #1e293b; margin: 0; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }}
        .header {{ background: {header_bg}; color: #ffffff; padding: 24px 30px; }}
        .header h1 {{ margin: 0; font-size: 18px; font-weight: 700; }}
        .header p {{ margin: 6px 0 0; opacity: 0.9; font-size: 13px; font-weight: 500; }}
        .body {{ padding: 28px 30px; }}
        .badge {{ display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 800; text-transform: uppercase; margin-bottom: 16px; background: {badge_bg}; color: {badge_color}; }}
        .details-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 16px 0; }}
        .details-box p {{ margin: 6px 0; font-size: 13px; line-height: 1.6; color: #334155; }}
        .details-box strong {{ color: #0f172a; }}
        .button-box {{ text-align: center; margin: 26px 0 10px; }}
        .btn {{ display: inline-block; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 13px; background: #2563eb; color: #ffffff; }}
        .footer {{ text-align: center; padding: 16px; color: #94a3b8; font-size: 11px; border-top: 1px solid #f1f5f9; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{icon} {header_title}</h1>
            <p>TIHFSA — Monitoramento & Gestão de TI • Hotel Fasano Salvador</p>
        </div>
        <div class="body">
            <span class="badge">{status_badge}</span>
            <div class="details-box">
                {details_html}
            </div>
            {action_button_html}
        </div>
        <div class="footer">
            Notificação automática do sistema TIHFSA enviada para {to_email}. Não responda a este e-mail.
        </div>
    </div>
</body>
</html>
"""


def send_noc_email(
    subject: str,
    header_title: str,
    details_html: str,
    status_type: str = "danger",
    ticket_id: int | None = None,
    to_email: str | None = None,
) -> bool:
    """
    Envia e-mail formatado do NOC para o e-mail corporativo de TI via SMTP.
    Destinatário padrão: ti-hfsa@fasano.com.br
    """
    if not settings.smtp_user or not settings.smtp_password:
        print("[WARN] SMTP não configurado. E-mail NOC não enviado.")
        return False

    target_email = to_email or settings.admin_email or "ti-hfsa@fasano.com.br"
    base_url = settings.app_base_url or "https://192.168.168.26"

    # Definição de Cores e Ícones
    if status_type == "danger":
        icon = "🚨"
        header_bg = "linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)"
        badge_bg = "#fee2e2"
        badge_color = "#991b1b"
        status_badge = "DISPOSITIVO OFFLINE"
    elif status_type == "warning":
        icon = "⚠️"
        header_bg = "linear-gradient(135deg, #d97706 0%, #b45309 100%)"
        badge_bg = "#fef3c7"
        badge_color = "#92400e"
        status_badge = "CHAMADO REABERTO — NOVA QUEDA"
    elif status_type == "success":
        icon = "✅"
        header_bg = "linear-gradient(135deg, #15803d 0%, #166534 100%)"
        badge_bg = "#dcfce7"
        badge_color = "#166534"
        status_badge = "ONLINE — AGUARDANDO VALIDAÇÃO"
    else:
        icon = "📋"
        header_bg = "linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)"
        badge_bg = "#dbeafe"
        badge_color = "#1e40af"
        status_badge = "RESUMO OPERACIONAL DE TI"

    if ticket_id:
        action_btn = f'<div class="button-box"><a href="{base_url}/admin/tickets" class="btn">Visualizar Chamado #{ticket_id}</a></div>'
    else:
        action_btn = f'<div class="button-box"><a href="{base_url}/admin/tickets" class="btn">Acessar Fila de Chamados</a></div>'

    html_content = NOC_ALERT_TEMPLATE.format(
        icon=icon,
        header_title=header_title,
        header_bg=header_bg,
        badge_bg=badge_bg,
        badge_color=badge_color,
        status_badge=status_badge,
        details_html=details_html,
        action_button_html=action_btn,
        to_email=target_email,
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_user}>"
    msg["To"] = target_email
    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        print(f"[INFO] E-mail NOC enviado com sucesso para {target_email}: {subject}")
        return True
    except Exception as e:
        print(f"[ERROR] Falha ao enviar e-mail NOC para {target_email}: {e}")
        return False


def send_noc_dual_notification(
    whatsapp_text: str,
    email_subject: str,
    email_title: str,
    email_details_html: str,
    status_type: str = "danger",
    ticket_id: int | None = None,
    send_whatsapp: bool = True,
    send_email: bool = True,
):
    """
    Dispara simultaneamente no WhatsApp do grupo de TI e por E-mail corporativo.
    Tratamento de exceções desacoplado para máxima tolerância a falhas.
    """
    from app.services.evolution_service import EvolutionService

    # 1. WhatsApp Evolution API
    if send_whatsapp:
        try:
            EvolutionService.send_whatsapp_message(whatsapp_text)
        except Exception as e:
            print(f"[WhatsApp Dual Notify Error] {e}")

    # 2. E-mail Corporativo SMTP
    if send_email:
        try:
            send_noc_email(
                subject=email_subject,
                header_title=email_title,
                details_html=email_details_html,
                status_type=status_type,
                ticket_id=ticket_id,
            )
        except Exception as e:
            print(f"[Email Dual Notify Error] {e}")

