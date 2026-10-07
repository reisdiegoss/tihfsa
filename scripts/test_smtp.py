"""
Script de Teste de Conectividade SMTP — TIHFSA
Hotel Fasano Salvador — TI Corporativa
"""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

# 1. Carrega variáveis de ambiente de .env ou backend/.env
config = {}
env_files = [".env", "backend/.env", "../.env"]

for env_path in env_files:
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
admin_email = config.get("ADMIN_EMAIL", "ti-hfsa@fasano.com.br")

print("=" * 65)
print(" TIHFSA — Teste de Validação do Serviço SMTP de E-mail")
print("=" * 65)
print(f" * Servidor SMTP:   {smtp_host}:{smtp_port}")
print(f" * Usuário Remetente: {smtp_user}")
print(f" * Remetente Exibido: {from_name}")
print(f" * Destinatário:      {admin_email}")
print("-" * 65)

if not smtp_user or not smtp_pass:
    print("[ERRO] SMTP_USER ou SMTP_PASSWORD não definidos no arquivo .env!")
    exit(1)

now_str = datetime.now().strftime("%d/%m/%Y às %H:%M:%S")

# 2. Conexão e Autenticação
print("[1/3] Conectando ao servidor SMTP...")
try:
    server = smtplib.SMTP(smtp_host, smtp_port, timeout=20)
    server.ehlo()
    print(" [+] Conexão TCP estabelecida.")

    print("[2/3] Negociando canal seguro STARTTLS (TLS 1.2/1.3)...")
    server.starttls()
    server.ehlo()
    print(" [+] Criptografia TLS ativada.")

    print("[3/3] Autenticando com credenciais corporativas...")
    server.login(smtp_user, smtp_pass)
    print(" [+] Autenticação confirmada com sucesso!")
except Exception as e:
    print(f"\n[FALHA] Não foi possível autenticar no SMTP: {type(e).__name__}: {e}")
    exit(1)

# 3. Disparo do e-mail de teste formatado em HTML
html_body = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="margin: 0; padding: 24px; background-color: #f1f5f9; font-family: Segoe UI, -apple-system, sans-serif; color: #1e293b;">
    <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb); padding: 28px 32px; color: #ffffff;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">TIHFSA — Notificações de Sistema</h1>
            <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Hotel Fasano Salvador | Validação de Conectividade SMTP</p>
        </div>
        <div style="padding: 32px;">
            <div style="display: inline-block; background: #dcfce7; color: #15803d; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 800; margin-bottom: 20px;">
                STATUS: SMTP OPERACIONAL
            </div>
            <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px;">
                Este é um e-mail de teste para validação dos disparos automáticos de notificações do <strong>TIHFSA</strong> (Aprovações de Chamados por Gestores, Validações de Atendimento e Alertas do NOC).
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0; font-size: 13px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 4px 0; color: #64748b; font-weight: 600;">Servidor SMTP:</td><td style="padding: 4px 0; color: #0f172a; font-weight: 700;">{smtp_host}:{smtp_port}</td></tr>
                    <tr><td style="padding: 4px 0; color: #64748b; font-weight: 600;">Conta Remetente:</td><td style="padding: 4px 0; color: #0f172a; font-weight: 700;">{smtp_user}</td></tr>
                    <tr><td style="padding: 4px 0; color: #64748b; font-weight: 600;">Criptografia:</td><td style="padding: 4px 0; color: #0f172a; font-weight: 700;">STARTTLS</td></tr>
                    <tr><td style="padding: 4px 0; color: #64748b; font-weight: 600;">Data do Teste:</td><td style="padding: 4px 0; color: #0f172a; font-weight: 700;">{now_str}</td></tr>
                </table>
            </div>
            <p style="font-size: 12px; color: #64748b; margin: 20px 0 0;">
                As notificações via e-mail do sistema TIHFSA estão funcionando corretamente.
            </p>
        </div>
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px; font-size: 11px; color: #94a3b8; text-align: center;">
            TIHFSA — Hotel Fasano Salvador | Notificação do Sistema
        </div>
    </div>
</body>
</html>"""

destinatarios = [admin_email]
if "diego.reis@fasano.com.br" not in destinatarios:
    destinatarios.append("diego.reis@fasano.com.br")

msg = MIMEMultipart("alternative")
msg["Subject"] = f"[TIHFSA] Teste de Notificações SMTP — {now_str}"
msg["From"] = f"{from_name} <{smtp_user}>"
msg["To"] = ", ".join(destinatarios)
msg.attach(MIMEText(html_body, "html", "utf-8"))

try:
    print(f"Enviando e-mail para: {', '.join(destinatarios)}...")
    server.sendmail(smtp_user, destinatarios, msg.as_string())
    server.quit()
    print("\n" + "=" * 65)
    print(" [SUCESSO] E-mail de teste enviado com êxito!")
    print(f" [OK] Notificação entregue para a fila do Exchange/Office 365.")
    print("=" * 65)
except Exception as e:
    print(f"\n[FALHA] Erro ao transmitir mensagem: {type(e).__name__}: {e}")
    exit(1)
