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
