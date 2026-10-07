"""
Script de Teste de Conectividade SMTP — TIHFSA
Validação de Layout Bulletproof para Microsoft Outlook (Desktop, Web e Dark Mode)
Hotel Fasano Salvador — TI Corporativa
"""

import os
import sys
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

# Adiciona backend ao path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

# Carrega variáveis de ambiente
config = {}
for env_path in [".env", "backend/.env", "../.env"]:
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    config[k.strip()] = v.strip()
        break

smtp_host = config.get("SMTP_HOST", "smtp-mail.outlook.com")
smtp_port = int(config.get("SMTP_PORT", 587))
smtp_user = config.get("SMTP_USER", "")
smtp_pass = config.get("SMTP_PASSWORD", "")
from_name = config.get("SMTP_FROM_NAME", "TIHFSA - Hotel Fasano Salvador")
destinatarios = [config.get("ADMIN_EMAIL", "ti-hfsa@fasano.com.br"), "diego.reis@fasano.com.br"]

print("=" * 65)
print(" TIHFSA — Teste de Layout de E-mail Bulletproof (Outlook MSO)")
print("=" * 65)
print(f" * Servidor SMTP:     {smtp_host}:{smtp_port}")
print(f" * Usuário Remetente: {smtp_user}")
print(f" * Destinatários:     {', '.join(destinatarios)}")
print("-" * 65)

now_str = datetime.now().strftime("%d/%m/%Y às %H:%M:%S")

from app.services.email_service import render_bulletproof_email

content = f"""
<p style="margin: 0 0 14px; font-size: 14px; color: #334155;">
    Este é o novo modelo de e-mail corporativo do <strong>TIHFSA</strong>, projetado especificamente para renderizar perfeitamente no <strong>Microsoft Outlook</strong> (Desktop e Web), clientes móveis e <strong>Dark Mode</strong> sem distorções visuais.
</p>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 16px 0;">
    <tr>
        <td style="padding: 14px 18px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #334155;">
            <strong>Servidor SMTP:</strong> {smtp_host}:{smtp_port}<br>
            <strong>Criptografia:</strong> STARTTLS (TLS 1.2/1.3)<br>
            <strong>Compatibilidade:</strong> Microsoft Outlook (Word Engine) + Dark Mode<br>
            <strong>Data e Hora:</strong> {now_str}
        </td>
    </tr>
</table>

<p style="margin: 16px 0 10px; font-weight: 700; color: #0f172a; text-align: center; font-size: 14px;">
    Demonstração: Como você avalia a resolução deste chamado?
</p>
"""

csat_demo = """
<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 10px auto 16px;">
    <tr>
        <td align="center" style="padding: 3px;">
            <a href="https://fassa29/avaliacao?demo=1" style="display: block; width: 75px; padding: 10px 4px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; text-decoration: none; text-align: center; font-family: 'Segoe UI', Arial, sans-serif;">
                <span style="font-size: 18px; color: #dc2626;">★</span><br>
                <span style="font-size: 10px; font-weight: 700; color: #991b1b;">1 - Péssimo</span>
            </a>
        </td>
        <td align="center" style="padding: 3px;">
            <a href="https://fassa29/avaliacao?demo=2" style="display: block; width: 75px; padding: 10px 4px; background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; text-decoration: none; text-align: center; font-family: 'Segoe UI', Arial, sans-serif;">
                <span style="font-size: 18px; color: #ea580c;">★</span><br>
                <span style="font-size: 10px; font-weight: 700; color: #9a3412;">2 - Ruim</span>
            </a>
        </td>
        <td align="center" style="padding: 3px;">
            <a href="https://fassa29/avaliacao?demo=3" style="display: block; width: 75px; padding: 10px 4px; background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; text-decoration: none; text-align: center; font-family: 'Segoe UI', Arial, sans-serif;">
                <span style="font-size: 18px; color: #ca8a04;">★</span><br>
                <span style="font-size: 10px; font-weight: 700; color: #854d0e;">3 - Regular</span>
            </a>
        </td>
        <td align="center" style="padding: 3px;">
            <a href="https://fassa29/avaliacao?demo=4" style="display: block; width: 75px; padding: 10px 4px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; text-decoration: none; text-align: center; font-family: 'Segoe UI', Arial, sans-serif;">
                <span style="font-size: 18px; color: #16a34a;">★</span><br>
                <span style="font-size: 10px; font-weight: 700; color: #166534;">4 - Bom</span>
            </a>
        </td>
        <td align="center" style="padding: 3px;">
            <a href="https://fassa29/avaliacao?demo=5" style="display: block; width: 75px; padding: 10px 4px; background-color: #dcfce7; border: 1px solid #86efac; border-radius: 8px; text-decoration: none; text-align: center; font-family: 'Segoe UI', Arial, sans-serif;">
                <span style="font-size: 18px; color: #15803d;">★</span><br>
                <span style="font-size: 10px; font-weight: 700; color: #14532d;">5 - Excelente</span>
            </a>
        </td>
    </tr>
</table>
"""

html_body = render_bulletproof_email(
    header_title="TIHFSA — Padrão Corporativo de E-mails",
    header_subtitle="Hotel Fasano Salvador • TI & Operações",
    badge_text="LAYOUT OUTLOOK COMPATÍVEL",
    badge_bg="#dcfce7",
    badge_color="#15803d",
    content_html=content,
    action_html=csat_demo,
    footer_text="E-mail gerado com tecnologia Bulletproof HTML/MSO para homologação de notificações.",
)

msg = MIMEMultipart("alternative")
msg["Subject"] = f"[TIHFSA] Validação de Layout Outlook — {now_str}"
msg["From"] = f"{from_name} <{smtp_user}>"
msg["To"] = ", ".join(destinatarios)
msg.attach(MIMEText(html_body, "html", "utf-8"))

try:
    print("[1/2] Conectando e autenticando via STARTTLS...")
    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(smtp_user, smtp_pass)
        print("[2/2] Transmitindo mensagem para os destinatários...")
        server.sendmail(smtp_user, destinatarios, msg.as_string())
    print("\n" + "=" * 65)
    print(" [SUCESSO] Novo e-mail bulletproof enviado com sucesso!")
    print(" Verifique no Outlook Desktop para conferir o novo layout nítido.")
    print("=" * 65)
except Exception as e:
    print(f"\n[ERRO] Falha ao enviar: {type(e).__name__}: {e}")
    sys.exit(1)
