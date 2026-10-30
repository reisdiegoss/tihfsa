"""
Serviço de Notificações para o Módulo de Projetos de TI (TIHFSA).
Dispara notificações simultâneas (Dual Notification):
- WhatsApp: Para o Grupo de TI oficial e/ou diretamente para o WhatsApp do técnico.
- E-mail: Template corporativo com layout responsivo para Gestores e Técnicos envolvidos.
"""
from typing import List, Optional
from datetime import date
from app.config import settings
from app.services.evolution_service import EvolutionService
from app.services.email_service import send_system_email, render_bulletproof_email


def _get_project_url(project_id: int) -> str:
    base = settings.app_base_url.rstrip("/")
    return f"{base}/admin/projects"


def notify_project_created(project, author_name: str, members: Optional[List] = None):
    """
    Notifica a criação de um novo projeto de TI no grupo de WhatsApp e por e-mail aos envolvidos.
    """
    due_str = project.due_date.strftime("%d/%m/%Y") if project.due_date else "A definir"
    project_url = _get_project_url(project.id)

    # 1. WhatsApp para o Grupo de TI
    wa_msg = (
        f"🚀 *NOVO PROJETO DE TI INICIADO*\n\n"
        f"📋 *Projeto:* [{project.code}] {project.title}\n"
        f"🏷️ *Categoria:* {project.category}\n"
        f"⚡ *Prioridade:* {project.priority}\n"
        f"📊 *Etapa Inicial:* {project.status}\n"
        f"📅 *Prazo de Entrega:* {due_str}\n"
        f"👤 *Cadastrado por:* {author_name}\n"
    )
    if project.description:
        wa_msg += f"\n📝 *Escopo:* {project.description[:180]}...\n"

    wa_msg += f"\n🔗 *Acessar Quadro:* {project_url}"

    try:
        EvolutionService.send_whatsapp_message(wa_msg)
    except Exception as e:
        print(f"[Project Notification Error] WhatsApp grupo: {e}")

    # 2. E-mail para os envolvidos (Gestor e Membros)
    recipients = []
    if getattr(project, "manager", None) and project.manager.email:
        recipients.append(project.manager)
    if members:
        for m in members:
            if getattr(m, "email", None) and m.email not in [r.email for r in recipients]:
                recipients.append(m)

    if recipients:
        subject = f"[TIHFSA Projetos] Novo Projeto: [{project.code}] {project.title}"
        content_html = f"""
        <p style="font-size: 14px; color: #334155; margin-bottom: 16px;">
            Olá, equipe! Um novo projeto de tecnologia foi cadastrado no portfólio da TI do Hotel Fasano Salvador:
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
            <tr>
                <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: bold; width: 140px;">Projeto</td>
                <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">[{project.code}] {project.title}</td>
            </tr>
            <tr>
                <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: bold;">Categoria</td>
                <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">{project.category}</td>
            </tr>
            <tr>
                <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: bold;">Prioridade</td>
                <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">{project.priority}</td>
            </tr>
            <tr>
                <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: bold;">Previsão de Entrega</td>
                <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">{due_str}</td>
            </tr>
            <tr>
                <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: bold;">Responsável / Criador</td>
                <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">{author_name}</td>
            </tr>
        </table>
        """
        action_html = f"""
        <center>
            <a href="{project_url}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px;">
                Abrir Quadro do Projeto
            </a>
        </center>
        """
        html_body = render_bulletproof_email(
            header_title=f"Novo Projeto: {project.code}",
            header_subtitle="Portfólio de Infraestrutura & Tecnologia",
            badge_text=project.status.upper(),
            badge_bg="#dbeafe",
            badge_color="#1e40af",
            content_html=content_html,
            action_html=action_html,
        )

        for recipient in recipients:
            try:
                send_system_email(
                    to_email=recipient.email,
                    subject=subject,
                    html_body=html_body,
                    notification_type="PROJECT_CREATED",
                    recipient_name=recipient.display_name,
                )
            except Exception as e:
                print(f"[Project Notification Error] Email para {recipient.email}: {e}")


def notify_project_status_changed(project, old_status: str, new_status: str, author_name: str):
    """
    Notifica a movimentação do projeto no Kanban (ex: Planejamento -> Em Andamento -> Concluído).
    """
    project_url = _get_project_url(project.id)
    is_concluded = new_status == "Concluído"

    emoji = "✅" if is_concluded else "🔄"
    title_text = "PROJETO CONCLUÍDO COM SUCESSO!" if is_concluded else "ANDAMENTO DO PROJETO ATUALIZADO"

    wa_msg = (
        f"{emoji} *{title_text}*\n\n"
        f"📋 *Projeto:* [{project.code}] {project.title}\n"
        f"📊 *Etapa:* ~{old_status}~ ➔ *{new_status}*\n"
        f"📈 *Progresso das Tarefas:* {project.progress}%\n"
        f"👤 *Atualizado por:* {author_name}\n"
    )

    if is_concluded:
        wa_msg += f"\n🎉 Parabéns à equipe pelas entregas concluídas e homologadas!\n"

    wa_msg += f"\n🔗 *Ver no Kanban:* {project_url}"

    try:
        EvolutionService.send_whatsapp_message(wa_msg)
    except Exception as e:
        print(f"[Project Notification Error] WhatsApp status: {e}")

    # E-mail se concluído ou pausado
    if is_concluded or new_status == "Pausado":
        badge_bg = "#dcfce7" if is_concluded else "#fef3c7"
        badge_color = "#166534" if is_concluded else "#92400e"

        content_html = f"""
        <p style="font-size: 14px; color: #334155;">
            A etapa do projeto <strong>[{project.code}] {project.title}</strong> foi atualizada para <strong>{new_status}</strong> por {author_name}.
        </p>
        <p style="font-size: 13px; color: #64748b;">
            Progresso geral das entregas: <strong>{project.progress}%</strong>
        </p>
        """
        action_html = f"""
        <center>
            <a href="{project_url}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px;">
                Ver Detalhes do Projeto
            </a>
        </center>
        """
        html_body = render_bulletproof_email(
            header_title=f"Projeto {project.code}: {new_status}",
            header_subtitle="Atualização de Etapa no Kanban",
            badge_text=new_status.upper(),
            badge_bg=badge_bg,
            badge_color=badge_color,
            content_html=content_html,
            action_html=action_html,
        )

        recipients = []
        if getattr(project, "manager", None) and project.manager.email:
            recipients.append(project.manager)
        if getattr(project, "members", None):
            for m in project.members:
                if getattr(m, "email", None) and m.email not in [r.email for r in recipients]:
                    recipients.append(m)

        for recipient in recipients:
            try:
                send_system_email(
                    to_email=recipient.email,
                    subject=f"[TIHFSA Projetos] {emoji} [{project.code}] {new_status}: {project.title}",
                    html_body=html_body,
                    notification_type="PROJECT_STATUS_UPDATE",
                    recipient_name=recipient.display_name,
                )
            except Exception as e:
                print(f"[Project Notification Error] Email status para {recipient.email}: {e}")


def notify_task_blocked(project, task_title: str, reason: str, author_name: str):
    """
    Notifica impedimento ou bloqueio em uma tarefa do projeto (WhatsApp no grupo de TI + e-mail).
    """
    project_url = _get_project_url(project.id)

    wa_msg = (
        f"⚠️ *ALERTA DE IMPEDIMENTO / BLOQUEIO NA TI*\n\n"
        f"📋 *Projeto:* [{project.code}] {project.title}\n"
        f"📌 *Atividade:* {task_title}\n"
        f"🛑 *Motivo do Bloqueio:* {reason or 'Aguardando peças ou terceiros'}\n"
        f"👤 *Sinalizado por:* {author_name}\n\n"
        f"🔗 *Acessar Projeto:* {project_url}"
    )

    try:
        EvolutionService.send_whatsapp_message(wa_msg)
    except Exception as e:
        print(f"[Project Notification Error] WhatsApp bloqueio: {e}")


def notify_member_assigned(project, member, author_name: str):
    """
    Notifica o técnico que ele foi designado para a equipe de um projeto.
    """
    project_url = _get_project_url(project.id)

    # 1. WhatsApp direto para o técnico se tiver telefone cadastrado
    if getattr(member, "phone", None):
        wa_tech = (
            f"👋 Olá *{member.display_name}*!\n\n"
            f"Você foi integrado à equipe técnica do projeto de TI:\n"
            f"📋 *[{project.code}] {project.title}*\n"
            f"🏷️ *Categoria:* {project.category} | *Prioridade:* {project.priority}\n"
            f"👤 *Atribuído por:* {author_name}\n\n"
            f"🔗 *Ver atividades no Kanban:* {project_url}"
        )
        try:
            EvolutionService.send_whatsapp_message(wa_tech, recipient=member.phone, recipient_name=member.display_name)
        except Exception as e:
            print(f"[Project Notification Error] WhatsApp tech {member.display_name}: {e}")

    # 2. E-mail para o técnico
    if getattr(member, "email", None):
        content_html = f"""
        <p style="font-size: 14px; color: #334155;">
            Olá <strong>{member.display_name}</strong>, você foi alocado na equipe de execução do projeto <strong>[{project.code}] {project.title}</strong> por {author_name}.
        </p>
        <p style="font-size: 13px; color: #64748b;">
            Acesse o quadro para visualizar o checklist de tarefas e os equipamentos envolvidos.
        </p>
        """
        action_html = f"""
        <center>
            <a href="{project_url}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px;">
                Acessar Projeto
            </a>
        </center>
        """
        html_body = render_bulletproof_email(
            header_title=f"Novo Projeto Atribuído",
            header_subtitle=f"[{project.code}] {project.title}",
            badge_text="EQUIPE DO PROJETO",
            badge_bg="#e0e7ff",
            badge_color="#3730a3",
            content_html=content_html,
            action_html=action_html,
        )
        try:
            send_system_email(
                to_email=member.email,
                subject=f"[TIHFSA Projetos] Você foi atribuído ao projeto [{project.code}] {project.title}",
                html_body=html_body,
                notification_type="PROJECT_MEMBER_ASSIGNED",
                recipient_name=member.display_name,
            )
        except Exception as e:
            print(f"[Project Notification Error] Email tech {member.email}: {e}")


def notify_deadline_warning(project, days_remaining: int):
    """
    Notifica no grupo de TI e aos técnicos que o prazo de entrega do projeto está próximo ou expirado.
    """
    project_url = _get_project_url(project.id)
    due_str = project.due_date.strftime("%d/%m/%Y") if project.due_date else "Sem data"

    if days_remaining < 0:
        headline = "🚨 *PROJETO COM PRAZO EXPIRADO!*"
        detail = f"O prazo de entrega era *{due_str}* (atrasado há {abs(days_remaining)} dias)."
    elif days_remaining == 0:
        headline = "⏰ *PROJETO COM ENTREGA PREVISTA PARA HOJE!*"
        detail = f"A data limite de entrega é *HOJE ({due_str})*."
    else:
        headline = f"⏳ *ATENÇÃO AO PRAZO DO PROJETO ({days_remaining} dias restantes)*"
        detail = f"A data prevista de entrega é *{due_str}*."

    wa_msg = (
        f"{headline}\n\n"
        f"📋 *Projeto:* [{project.code}] {project.title}\n"
        f"📅 *Prazo:* {detail}\n"
        f"📊 *Etapa Atual:* {project.status} ({project.progress}% concluído)\n\n"
        f"🔗 *Acessar Quadro:* {project_url}"
    )

    try:
        EvolutionService.send_whatsapp_message(wa_msg)
    except Exception as e:
        print(f"[Project Notification Error] WhatsApp deadline: {e}")

