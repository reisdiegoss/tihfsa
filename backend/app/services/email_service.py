"""
Service EmailService — Motor de Envio de E-mails Corporativos TIHFSA.
Layout Bulletproof testado contra Microsoft Outlook (Desktop, Web, Mobile e Dark Mode).
Suporte a validação por gestores, alertas de infraestrutura NOC e pesquisa CSAT de 1 a 5 estrelas.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import settings
from app.database import SessionLocal
from app.models.system_setting import SystemSetting


def get_support_email() -> str:
    """Retorna o e-mail configurado para a equipe de suporte/TI."""
    try:
        db = SessionLocal()
        setting = db.query(SystemSetting).first()
        if setting and setting.support_notification_email:
            email = setting.support_notification_email.strip()
            db.close()
            return email
        db.close()
    except Exception:
        pass
    return settings.admin_email or "ti-hfsa@fasano.com.br"


def get_email_header_branding() -> tuple[str, str, str]:
    """Retorna (título_cabeçalho, subtítulo_cabeçalho, título_corpo) personalizados."""
    try:
        db = SessionLocal()
        setting = db.query(SystemSetting).first()
        if setting:
            title = setting.email_header_title or "TIHFSA — Hotel Fasano Salvador"
            sub = setting.email_header_subtitle or "Central de Serviços & Suporte de TI"
            body = setting.email_body_title or "Notificação de Atendimento"
            db.close()
            return title.strip(), sub.strip(), body.strip()
        db.close()
    except Exception:
        pass
    return "TIHFSA — Hotel Fasano Salvador", "Central de Serviços & Suporte de TI", "Notificação de Atendimento"


def render_bulletproof_email(
    header_title: str,
    header_subtitle: str,
    badge_text: str,
    badge_bg: str,
    badge_color: str,
    content_html: str,
    action_html: str = "",
    footer_text: str = "",
    body_title: str | None = None,
) -> str:
    """
    Gera HTML estritamente em tabelas e MSO conditionals para compatibilidade
    absoluta com o motor do Microsoft Outlook (Word) e clientes modernos (Dark Mode).
    """
    brand_title, brand_sub, default_body = get_email_header_branding()
    
    main_title = brand_title if brand_title else "TIHFSA — Hotel Fasano Salvador"
    sub_title = brand_sub if brand_sub else (header_subtitle or "Central de Serviços & Suporte de TI")
    
    # Título do corpo da mensagem (prioridade: explícito > cabeçalho da ação > padrão configurado)
    main_body_title = body_title or header_title or default_body
    
    footer = footer_text or f"{main_title} | Notificação do Sistema"

    return f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
    <![endif]-->
    <style type="text/css">
        body, table, td, a {{ -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
        table, td {{ mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
        body {{ height: 100% !important; margin: 0 !important; padding: 20px 0 !important; width: 100% !important; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }}
    </style>
</head>
<body bgcolor="#f1f5f9" style="margin: 0; padding: 20px 0; background-color: #f1f5f9;">
    <!-- Container Principal Centralizado -->
    <center>
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="600" align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;">
        <tr><td style="padding:0;">
        <![endif]-->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.04);">
            <!-- Cabeçalho com cor sólida corporativa (compatível com Word/Outlook) -->
            <tr>
                <td bgcolor="#1e3a8a" style="background-color: #1e3a8a; padding: 24px 30px; text-align: left;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                            <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 700; color: #ffffff !important; line-height: 1.3;">
                                {main_title}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding-top: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #bfdbfe !important; line-height: 1.4;">
                                {sub_title}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <!-- Corpo da Mensagem -->
            <tr>
                <td style="padding: 28px 30px; background-color: #ffffff;">
                    <!-- Badge de Status -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                        <tr>
                            <td bgcolor="{badge_bg}" style="background-color: {badge_bg}; padding: 6px 14px; border-radius: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 800; color: {badge_color} !important; text-transform: uppercase; letter-spacing: 0.5px;">
                                {badge_text}
                            </td>
                        </tr>
                    </table>

                    <!-- Título em Destaque do Corpo do E-mail -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                        <tr>
                            <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 17px; font-weight: 700; color: #0f172a; line-height: 1.35;">
                                {main_body_title}
                            </td>
                        </tr>
                    </table>

                    <!-- Conteúdo Principal -->
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #334155;">
                        {content_html}
                    </div>

                    <!-- Bloco de Ações / Botões -->
                    {action_html}
                </td>
            </tr>

            <!-- Rodapé Institucional -->
            <tr>
                <td bgcolor="#f8fafc" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 30px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                    {footer}
                </td>
            </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td></tr></table>
        <![endif]-->
    </center>
</body>
</html>"""


def log_notification(
    channel: str,
    notification_type: str,
    recipient: str,
    subject: str,
    body: str,
    ticket_id: int | None = None,
    recipient_name: str | None = None,
    status: str = "SENT",
    error_message: str | None = None,
):
    """Registra histórico de notificação para auditoria e reenvio."""
    try:
        from datetime import datetime, timezone
        from app.database import SessionLocal
        from app.models.notification_log import NotificationLog

        db = SessionLocal()
        now = datetime.now(timezone.utc)
        entry = NotificationLog(
            channel=channel,
            notification_type=notification_type,
            recipient=recipient,
            recipient_name=recipient_name,
            subject=subject,
            body=body,
            ticket_id=ticket_id,
            status=status,
            error_message=error_message,
            resend_count=0,
            last_attempt_at=now,
            created_at=now,
        )
        db.add(entry)
        db.commit()
        db.close()
    except Exception as ex:
        print(f"[WARN] Erro ao gravar NotificationLog: {ex}")


def send_system_email(
    to_email: str,
    subject: str,
    html_body: str,
    notification_type: str = "SYSTEM_EMAIL",
    ticket_id: int | None = None,
    recipient_name: str | None = None,
) -> bool:
    """Envia um e-mail com protocolo STARTTLS via servidor SMTP configurado e audita no banco."""
    if not settings.smtp_user or not settings.smtp_password:
        err = "SMTP não configurado no .env"
        print(f"[WARN] {err}. E-mail '{subject}' não enviado para {to_email}.")
        log_notification("EMAIL", notification_type, to_email, subject, html_body, ticket_id, recipient_name, status="FAILED", error_message=err)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_user}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        print(f"[INFO] E-mail enviado com sucesso para {to_email}: {subject}")
        log_notification("EMAIL", notification_type, to_email, subject, html_body, ticket_id, recipient_name, status="SENT")
        return True
    except Exception as e:
        err = str(e)
        print(f"[ERROR] Falha ao enviar e-mail para {to_email}: {err}")
        log_notification("EMAIL", notification_type, to_email, subject, html_body, ticket_id, recipient_name, status="FAILED", error_message=err)
        return False


def send_validation_email(
    ticket,
    requester_name: str,
    manager_email: str,
    manager_name: str,
    technician_name: str,
    solution: str,
    approve_url: str,
    reject_url: str,
) -> bool:
    """Envia e-mail de validação para o gestor com botões Aprovar e Recusar."""
    content = f"""
    <p style="margin: 0 0 14px;">Olá <strong>{manager_name}</strong>,</p>
    <p style="margin: 0 0 16px;">O chamado abaixo foi resolvido pela equipe técnica e aguarda a sua aprovação formal:</p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px;">
        <tr>
            <td style="padding: 14px 18px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.6;">
                <strong>Protocolo:</strong> #{ticket.id} — {ticket.title}<br>
                <strong>Solicitante:</strong> {requester_name}<br>
                <strong>Técnico Responsável:</strong> {technician_name}
            </td>
        </tr>
    </table>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
        <tr>
            <td style="padding: 14px 18px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #166534; line-height: 1.6;">
                <strong style="color: #15803d;">💡 Solução Aplicada:</strong><br>
                <span style="color: #334155;">{solution}</span>
            </td>
        </tr>
    </table>
    """

    action_buttons = f"""
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 24px auto 10px;">
        <tr>
            <td align="center" style="padding: 0 8px;">
                <a href="{approve_url}" style="display: inline-block; padding: 12px 26px; background-color: #16a34a; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif;">
                    ✅ Aprovar Solução
                </a>
            </td>
            <td align="center" style="padding: 0 8px;">
                <a href="{reject_url}" style="display: inline-block; padding: 12px 26px; background-color: #dc2626; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif;">
                    ❌ Recusar
                </a>
            </td>
        </tr>
    </table>
    """

    html = render_bulletproof_email(
        header_title=f"🎯 Validação de Chamado #{ticket.id}",
        header_subtitle="TIHFSA — Hotel Fasano Salvador",
        badge_text="AGUARDANDO VALIDAÇÃO DO GESTOR",
        badge_bg="#fef3c7",
        badge_color="#92400e",
        content_html=content,
        action_html=action_buttons,
        footer_text="Links seguros válidos por 72 horas. Este é um e-mail automático do sistema TIHFSA.",
    )

    return send_system_email(
        to_email=manager_email,
        subject=f"[TIHFSA] Validação Chamado #{ticket.id} — {ticket.title}",
        html_body=html,
    )


def send_ticket_created_notification(ticket, requester_name: str, requester_email: str) -> bool:
    """Envia confirmação de abertura de chamado para o solicitante com o número do protocolo."""
    base_url = settings.app_base_url or "https://fassa29"
    content = f"""
    <p style="margin: 0 0 14px;">Olá <strong>{requester_name}</strong>,</p>
    <p style="margin: 0 0 16px;">Seu chamado foi registrado com sucesso em nosso sistema de atendimento de TI.</p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px;">
        <tr>
            <td style="padding: 14px 18px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.6;">
                <strong>Protocolo:</strong> #{ticket.id}<br>
                <strong>Título:</strong> {ticket.title}<br>
                <strong>Prioridade:</strong> {ticket.priority.value if hasattr(ticket.priority, 'value') else ticket.priority}<br>
                <strong>Status Inicial:</strong> Novo (Na Fila de Atendimento)
            </td>
        </tr>
    </table>
    <p style="margin: 0; font-size: 13px; color: #64748b;">
        Nossa equipe técnica já foi notificada. Você receberá atualizações por e-mail a cada avanço no atendimento.
    </p>
    """

    action_btn = f"""
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 22px auto 6px;">
        <tr>
            <td align="center">
                <a href="{base_url}/app" style="display: inline-block; padding: 12px 28px; background-color: #1e3a8a; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif;">
                    Acompanhar Chamado no Portal
                </a>
            </td>
        </tr>
    </table>
    """

    html = render_bulletproof_email(
        header_title=f"📋 Chamado Registrado #{ticket.id}",
        header_subtitle="TIHFSA — Hotel Fasano Salvador",
        badge_text="CHAMADO REGISTRADO",
        badge_bg="#e0f2fe",
        badge_color="#0369a1",
        content_html=content,
        action_html=action_btn,
    )

    return send_system_email(
        to_email=requester_email,
        subject=f"[TIHFSA] Chamado #{ticket.id} Registrado com Sucesso — {ticket.title}",
        html_body=html,
    )


def send_ticket_assigned_notification(ticket, requester_name: str, requester_email: str, technician_name: str) -> bool:
    """Envia notificação ao solicitante informando que um técnico assumiu o chamado."""
    base_url = settings.app_base_url or "https://fassa29"
    content = f"""
    <p style="margin: 0 0 14px;">Olá <strong>{requester_name}</strong>,</p>
    <p style="margin: 0 0 16px;">O técnico <strong>{technician_name}</strong> assumiu o atendimento do seu chamado:</p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px;">
        <tr>
            <td style="padding: 14px 18px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.6;">
                <strong>Protocolo:</strong> #{ticket.id}<br>
                <strong>Chamado:</strong> {ticket.title}<br>
                <strong>Técnico Responsável:</strong> {technician_name}<br>
                <strong>Status:</strong> Em Andamento
            </td>
        </tr>
    </table>
    <p style="margin: 0; font-size: 13px; color: #64748b;">
        O analista iniciou os procedimentos necessários e entrará em contato caso precise de detalhes adicionais.
    </p>
    """

    action_btn = f"""
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 22px auto 6px;">
        <tr>
            <td align="center">
                <a href="{base_url}/app" style="display: inline-block; padding: 12px 28px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif;">
                    Ver Detalhes do Atendimento
                </a>
            </td>
        </tr>
    </table>
    """

    html = render_bulletproof_email(
        header_title=f"👨‍💻 Chamado em Atendimento #{ticket.id}",
        header_subtitle="TIHFSA — Hotel Fasano Salvador",
        badge_text="TÉCNICO DESIGNADO",
        badge_bg="#e0e7ff",
        badge_color="#3730a3",
        content_html=content,
        action_html=action_btn,
    )

    return send_system_email(
        to_email=requester_email,
        subject=f"[TIHFSA] Técnico Designado para Chamado #{ticket.id} ({technician_name})",
        html_body=html,
    )


def send_ticket_solved_csat_notification(
    ticket,
    requester_name: str,
    requester_email: str,
    technician_name: str,
    solution: str,
    csat_token: str,
    warranty_days: int = 7,
) -> bool:
    """
    Envia e-mail de conclusão ao solicitante com a solução adotada,
    aviso de garantia de reabertura (X dias) e as 5 ESTRELAS CLICÁVEIS para pesquisa CSAT.
    """
    base_url = settings.app_base_url or "https://fassa29"
    csat_base_url = f"{base_url}/avaliacao?token={csat_token}"

    content = f"""
    <p style="margin: 0 0 14px;">Olá <strong>{requester_name}</strong>,</p>
    <p style="margin: 0 0 16px;">Seu chamado foi finalizado com sucesso pela equipe técnica:</p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 16px;">
        <tr>
            <td style="padding: 14px 18px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.6;">
                <strong>Protocolo:</strong> #{ticket.id} — {ticket.title}<br>
                <strong>Técnico:</strong> {technician_name}
            </td>
        </tr>
    </table>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 0 8px 8px 0; margin-bottom: 22px;">
        <tr>
            <td style="padding: 14px 18px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #166534; line-height: 1.6;">
                <strong style="color: #15803d;">💡 Solução Aplicada:</strong><br>
                <span style="color: #334155;">{solution or 'Atendimento concluído e verificado com sucesso.'}</span>
            </td>
        </tr>
    </table>

    <!-- Bloco de Garantia de Serviço -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #eff6ff; border: 1px dashed #60a5fa; border-radius: 8px; margin-bottom: 24px;">
        <tr>
            <td style="padding: 12px 16px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e40af; line-height: 1.5;">
                🛡️ <strong>Garantia de Atendimento ({warranty_days} dias):</strong> Caso o problema persista ou retorne nos próximos {warranty_days} dias, você pode reabrir este mesmo chamado diretamente pelo portal corporativo sem burocracia.
            </td>
        </tr>
    </table>

    <!-- Pesquisa de Satisfação CSAT -->
    <p style="margin: 0 0 10px; font-weight: 700; color: #0f172a; text-align: center; font-size: 15px;">
        Como você avalia o atendimento recebido?
    </p>
    <p style="margin: 0 0 16px; font-size: 12px; color: #64748b; text-align: center;">
        Clique em uma das opções abaixo para registrar seu voto (leva menos de 5 segundos):
    </p>
    """

    csat_stars_html = f"""
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 10px auto 20px;">
        <tr>
            <td align="center" style="padding: 3px;">
                <a href="{csat_base_url}&rating=1" style="display: block; width: 75px; padding: 10px 4px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; text-decoration: none; text-align: center; font-family: 'Segoe UI', Arial, sans-serif;">
                    <span style="font-size: 18px; color: #dc2626;">★</span><br>
                    <span style="font-size: 10px; font-weight: 700; color: #991b1b;">1 - Péssimo</span>
                </a>
            </td>
            <td align="center" style="padding: 3px;">
                <a href="{csat_base_url}&rating=2" style="display: block; width: 75px; padding: 10px 4px; background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; text-decoration: none; text-align: center; font-family: 'Segoe UI', Arial, sans-serif;">
                    <span style="font-size: 18px; color: #ea580c;">★</span><br>
                    <span style="font-size: 10px; font-weight: 700; color: #9a3412;">2 - Ruim</span>
                </a>
            </td>
            <td align="center" style="padding: 3px;">
                <a href="{csat_base_url}&rating=3" style="display: block; width: 75px; padding: 10px 4px; background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; text-decoration: none; text-align: center; font-family: 'Segoe UI', Arial, sans-serif;">
                    <span style="font-size: 18px; color: #ca8a04;">★</span><br>
                    <span style="font-size: 10px; font-weight: 700; color: #854d0e;">3 - Regular</span>
                </a>
            </td>
            <td align="center" style="padding: 3px;">
                <a href="{csat_base_url}&rating=4" style="display: block; width: 75px; padding: 10px 4px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; text-decoration: none; text-align: center; font-family: 'Segoe UI', Arial, sans-serif;">
                    <span style="font-size: 18px; color: #16a34a;">★</span><br>
                    <span style="font-size: 10px; font-weight: 700; color: #166534;">4 - Bom</span>
                </a>
            </td>
            <td align="center" style="padding: 3px;">
                <a href="{csat_base_url}&rating=5" style="display: block; width: 75px; padding: 10px 4px; background-color: #dcfce7; border: 1px solid #86efac; border-radius: 8px; text-decoration: none; text-align: center; font-family: 'Segoe UI', Arial, sans-serif;">
                    <span style="font-size: 18px; color: #15803d;">★</span><br>
                    <span style="font-size: 10px; font-weight: 700; color: #14532d;">5 - Excelente</span>
                </a>
            </td>
        </tr>
    </table>
    """

    html = render_bulletproof_email(
        header_title=f"✅ Chamado Solucionado #{ticket.id}",
        header_subtitle="TIHFSA — Hotel Fasano Salvador",
        badge_text="ATENDIMENTO CONCLUÍDO",
        badge_bg="#dcfce7",
        badge_color="#15803d",
        content_html=content,
        action_html=csat_stars_html,
        footer_text="Sua avaliação é fundamental para aprimorarmos continuamente os serviços de TI do Fasano Salvador.",
    )

    return send_system_email(
        to_email=requester_email,
        subject=f"[TIHFSA] Chamado #{ticket.id} Solucionado — Avalie o Atendimento",
        html_body=html,
    )


def send_ticket_reopened_notification(ticket, user_name: str, reason: str) -> bool:
    """Notifica a equipe de TI que um chamado foi reaberto sob garantia."""
    base_url = settings.app_base_url or "https://fassa29"
    target_email = get_support_email()

    content = f"""
    <p style="margin: 0 0 14px;">Atenção Equipe de TI,</p>
    <p style="margin: 0 0 16px;">O chamado abaixo foi <strong>reaberto pelo solicitante</strong> dentro da janela de garantia do atendimento:</p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-bottom: 20px;">
        <tr>
            <td style="padding: 14px 18px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.6;">
                <strong>Protocolo:</strong> #{ticket.id} — {ticket.title}<br>
                <strong>Reaberto por:</strong> {user_name}<br>
                <strong>Total de Reaberturas:</strong> {ticket.reopen_count}<br>
                <strong>Motivo / Justificativa:</strong> {reason}
            </td>
        </tr>
    </table>
    """

    action_btn = f"""
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 22px auto 6px;">
        <tr>
            <td align="center">
                <a href="{base_url}/admin/tickets" style="display: inline-block; padding: 12px 28px; background-color: #dc2626; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif;">
                    Atender Chamado Reaberto #{ticket.id}
                </a>
            </td>
        </tr>
    </table>
    """

    html = render_bulletproof_email(
        header_title=f"🔄 Chamado Reaberto sob Garantia #{ticket.id}",
        header_subtitle="TIHFSA — Hotel Fasano Salvador",
        badge_text="CHAMADO REABERTO",
        badge_bg="#fee2e2",
        badge_color="#991b1b",
        content_html=content,
        action_html=action_btn,
    )

    return send_system_email(
        to_email=target_email,
        subject=f"[TIHFSA] [REABERTO] Chamado #{ticket.id} — {ticket.title}",
        html_body=html,
    )


def send_noc_email(
    subject: str,
    header_title: str,
    details_html: str,
    status_type: str = "danger",
    ticket_id: int | None = None,
    to_email: str | None = None,
) -> bool:
    """Envia e-mail formatado do NOC para a equipe de TI via SMTP."""
    target_email = to_email or get_support_email()
    base_url = settings.app_base_url or "https://fassa29"

    if status_type == "danger":
        badge_bg = "#fee2e2"
        badge_color = "#991b1b"
        status_badge = "🚨 DISPOSITIVO OFFLINE / CRÍTICO"
    elif status_type == "warning":
        badge_bg = "#fef3c7"
        badge_color = "#92400e"
        status_badge = "⚠️ ALERTA DE INFRAESTRUTURA"
    elif status_type == "success":
        badge_bg = "#dcfce7"
        badge_color = "#166534"
        status_badge = "✅ DISPOSITIVO RECUPERADO / ONLINE"
    else:
        badge_bg = "#dbeafe"
        badge_color = "#1e40af"
        status_badge = "📋 INFORMATIVO NOC"

    if ticket_id:
        action_btn = f"""
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 22px auto 6px;">
            <tr>
                <td align="center">
                    <a href="{base_url}/admin/tickets" style="display: inline-block; padding: 12px 28px; background-color: #1e3a8a; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif;">
                        Visualizar Chamado #{ticket_id}
                    </a>
                </td>
            </tr>
        </table>
        """
    else:
        action_btn = ""

    html = render_bulletproof_email(
        header_title=header_title,
        header_subtitle="TIHFSA — Monitoramento NOC • Hotel Fasano Salvador",
        badge_text=status_badge,
        badge_bg=badge_bg,
        badge_color=badge_color,
        content_html=details_html,
        action_html=action_btn,
    )

    return send_system_email(
        to_email=target_email,
        subject=subject,
        html_body=html,
    )


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
    """Dispara simultaneamente no WhatsApp do grupo de TI e por E-mail corporativo."""
    from app.services.evolution_service import EvolutionService

    if send_whatsapp:
        try:
            EvolutionService.send_whatsapp_message(whatsapp_text)
        except Exception as e:
            print(f"[WhatsApp Dual Notify Error] {e}")

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
