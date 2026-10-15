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
    notify_requester_on_update: bool = True
    notify_ti_on_create: bool = True
    notify_ti_on_close: bool = True
    notify_ti_on_update: bool = True
    notify_technician_on_assign: bool = True
    
    # Configurações do PWA (Instalação no Celular / Desktop)
    pwa_name: str = "TIHFSA — Hotel Fasano Salvador"
    pwa_short_name: str = "TIHFSA"
    pwa_theme_color: str = "#0f172a"
    pwa_bg_color: str = "#0f172a"
    pwa_icon_url: str = "/icons/icon-512.png"


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
        notify_requester_on_update=setting.notify_requester_on_update if getattr(setting, 'notify_requester_on_update', None) is not None else True,
        notify_ti_on_create=setting.notify_ti_on_create if getattr(setting, 'notify_ti_on_create', None) is not None else True,
        notify_ti_on_close=setting.notify_ti_on_close if getattr(setting, 'notify_ti_on_close', None) is not None else True,
        notify_ti_on_update=setting.notify_ti_on_update if getattr(setting, 'notify_ti_on_update', None) is not None else True,
        notify_technician_on_assign=setting.notify_technician_on_assign if setting.notify_technician_on_assign is not None else True,
        pwa_name=getattr(setting, 'pwa_name', None) or "TIHFSA — Hotel Fasano Salvador",
        pwa_short_name=getattr(setting, 'pwa_short_name', None) or "TIHFSA",
        pwa_theme_color=getattr(setting, 'pwa_theme_color', None) or "#0f172a",
        pwa_bg_color=getattr(setting, 'pwa_bg_color', None) or "#0f172a",
        pwa_icon_url=getattr(setting, 'pwa_icon_url', None) or "/icons/icon-512.png",
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
    setting.notify_requester_on_update = payload.notify_requester_on_update
    setting.notify_ti_on_create = payload.notify_ti_on_create
    setting.notify_ti_on_close = payload.notify_ti_on_close
    setting.notify_ti_on_update = payload.notify_ti_on_update
    setting.notify_technician_on_assign = payload.notify_technician_on_assign
    
    # Salvar configurações PWA
    setting.pwa_name = (payload.pwa_name or "").strip() or "TIHFSA — Hotel Fasano Salvador"
    setting.pwa_short_name = (payload.pwa_short_name or "").strip() or "TIHFSA"
    setting.pwa_theme_color = (payload.pwa_theme_color or "").strip() or "#0f172a"
    setting.pwa_bg_color = (payload.pwa_bg_color or "").strip() or "#0f172a"
    if payload.pwa_icon_url:
        setting.pwa_icon_url = payload.pwa_icon_url.strip()

    db.commit()
    db.refresh(setting)

    # Sincroniza arquivos físicos do manifesto e ícones PWA
    try:
        sync_pwa_files(setting)
    except Exception as e:
        print(f"[WARN] Falha ao sincronizar PWA no update_general_settings: {e}")

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
        notify_requester_on_update=setting.notify_requester_on_update,
        notify_ti_on_create=setting.notify_ti_on_create,
        notify_ti_on_close=setting.notify_ti_on_close,
        notify_ti_on_update=setting.notify_ti_on_update,
        notify_technician_on_assign=setting.notify_technician_on_assign,
        pwa_name=setting.pwa_name or "TIHFSA — Hotel Fasano Salvador",
        pwa_short_name=setting.pwa_short_name or "TIHFSA",
        pwa_theme_color=setting.pwa_theme_color or "#0f172a",
        pwa_bg_color=setting.pwa_bg_color or "#0f172a",
        pwa_icon_url=setting.pwa_icon_url or "/icons/icon-512.png",
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


def build_pwa_manifest_dict(setting: SystemSetting | None) -> dict:
    """
    Constrói o dicionário do Web App Manifest com o ícone customizado aplicado
    a todas as resoluções (192, 512, 180) e propósitos ('any' e 'maskable')
    para plena compatibilidade com Android WebAPK, Chrome, Edge e iOS.
    """
    name = (setting.pwa_name if setting and setting.pwa_name else "TIHFSA — Hotel Fasano Salvador")
    short_name = (setting.pwa_short_name if setting and setting.pwa_short_name else "TIHFSA")
    theme_color = (setting.pwa_theme_color if setting and setting.pwa_theme_color else "#0f172a")
    bg_color = (setting.pwa_bg_color if setting and setting.pwa_bg_color else "#0f172a")
    icon_url = (setting.pwa_icon_url if setting and setting.pwa_icon_url else "/icons/icon-512.png")

    icons = [
        {
            "src": icon_url,
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "any"
        },
        {
            "src": icon_url,
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "maskable"
        },
        {
            "src": icon_url,
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any"
        },
        {
            "src": icon_url,
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "maskable"
        },
        {
            "src": icon_url,
            "sizes": "180x180",
            "type": "image/png",
            "purpose": "any"
        }
    ]

    return {
        "name": name,
        "short_name": short_name,
        "description": "Sistema Integrado de Gestão de TI, Helpdesk, NOC e Termos Digitais do Hotel Fasano Salvador",
        "id": "/?source=pwa",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "display_override": ["standalone", "window-controls-overlay"],
        "background_color": bg_color,
        "theme_color": theme_color,
        "orientation": "portrait-primary",
        "icons": icons
    }


def sync_pwa_files(setting: SystemSetting | None):
    """
    Sincroniza os arquivos físicos do manifesto (manifest.webmanifest) e copia o ícone
    customizado para as pastas públicas e canônicas (/icons/icon-192.png, icon-512.png, etc.).
    """
    import os
    import shutil
    import json

    manifest_dict = build_pwa_manifest_dict(setting)
    manifest_json_str = json.dumps(manifest_dict, ensure_ascii=False, indent=2)

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

    target_manifest_files = [
        os.path.abspath(os.path.join(base_dir, "..", "frontend", "public", "manifest.webmanifest")),
        os.path.abspath(os.path.join(base_dir, "..", "frontend", "dist", "manifest.webmanifest")),
        "/var/www/tihfsa/manifest.webmanifest",
    ]

    for m_path in target_manifest_files:
        try:
            if os.path.exists(os.path.dirname(m_path)):
                with open(m_path, "w", encoding="utf-8") as f:
                    f.write(manifest_json_str)
        except Exception:
            pass

    # Se o ícone for customizado em /uploads/, encontra o arquivo fonte no disco e replica
    if setting and setting.pwa_icon_url and setting.pwa_icon_url.startswith("/uploads/"):
        rel_icon_path = setting.pwa_icon_url.lstrip("/")
        possible_sources = [
            os.path.abspath(os.path.join(base_dir, rel_icon_path)),
            os.path.abspath(os.path.join(base_dir, "..", rel_icon_path)),
            f"/root/TIHFSA/{rel_icon_path}",
            f"/root/TIHFSA/backend/{rel_icon_path}",
            f"/var/www/tihfsa/{rel_icon_path}",
        ]

        found_src = None
        for p in possible_sources:
            if os.path.exists(p) and os.path.isfile(p):
                found_src = p
                break

        if found_src:
            target_icon_dirs = [
                os.path.abspath(os.path.join(base_dir, "..", "frontend", "public", "icons")),
                os.path.abspath(os.path.join(base_dir, "..", "frontend", "dist", "icons")),
                "/var/www/tihfsa/icons",
            ]
            for idir in target_icon_dirs:
                try:
                    if os.path.exists(os.path.dirname(idir)):
                        os.makedirs(idir, exist_ok=True)
                        for std_name in ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]:
                            shutil.copy(found_src, os.path.join(idir, std_name))
                except Exception:
                    pass


@router.get("/pwa-manifest", summary="Obter Manifesto PWA dinâmico com base nos parâmetros configurados")
def get_pwa_manifest(db: Session = Depends(get_db)):
    """
    Retorna o Web App Manifest gerado dinamicamente com o nome, cores e ícones
    salvos pelo administrador do sistema em Parâmetros Gerais.
    """
    setting = db.query(SystemSetting).first()
    return build_pwa_manifest_dict(setting)


from fastapi import UploadFile, File
import os
import shutil
import uuid

@router.post("/pwa-icon", summary="Fazer upload de novo ícone para o aplicativo PWA")
def upload_pwa_icon(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not file.filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".svg")):
        raise HTTPException(status_code=400, detail="Formato de imagem inválido. Use PNG, JPG ou WebP.")

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    upload_pwa_dir = os.path.join(base_dir, "uploads", "pwa")
    os.makedirs(upload_pwa_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1].lower() or ".png"
    unique_filename = f"pwa-icon-{uuid.uuid4().hex[:10]}{ext}"
    dest_path = os.path.join(upload_pwa_dir, unique_filename)

    file_content = file.file.read()
    with open(dest_path, "wb") as buffer:
        buffer.write(file_content)

    icon_url = f"/uploads/pwa/{unique_filename}"

    setting = db.query(SystemSetting).first()
    if not setting:
        setting = SystemSetting()
        db.add(setting)

    setting.pwa_icon_url = icon_url
    db.commit()
    db.refresh(setting)

    # Sincroniza arquivos físicos e substitui os ícones canônicos
    try:
        sync_pwa_files(setting)
    except Exception as e:
        print(f"[WARN] Falha ao sincronizar PWA no upload_pwa_icon: {e}")

    return {"success": True, "icon_url": icon_url, "message": "Ícone do aplicativo atualizado com sucesso!"}



