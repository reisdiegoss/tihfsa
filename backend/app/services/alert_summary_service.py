"""
Serviço de Cobrança e Resumo Operacional de Chamados em Aberto.
Consulta chamados não finalizados (Novo, Em Andamento, Aguardando Validação)
e envia resumo de cobrança para a equipe de TI via WhatsApp e E-mail.
"""
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.ticket import Ticket, TicketStatus, TicketPriority
from app.models.integration_config import EvolutionConfig
from app.services.evolution_service import EvolutionService
from app.services.email_service import send_noc_email
from app.config import settings

def send_open_tickets_summary(db: Session = None, force: bool = False) -> dict:
    """
    Gera e envia o resumo com a cobrança dos chamados em aberto para o time de TI.
    Envia para o WhatsApp do grupo de TI e para o e-mail corporativo (ti-hfsa@fasano.com.br).
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        # Verificar configurações
        config = db.query(EvolutionConfig).first()
        if not force:
            if config and not config.summary_reminder_active:
                return {"status": "skipped", "message": "Cobrança automática desativada nas configurações."}

        # Buscar chamados não finalizados
        open_tickets = (
            db.query(Ticket)
            .filter(Ticket.status.in_([TicketStatus.NEW, TicketStatus.IN_PROGRESS, TicketStatus.PENDING_VALIDATION]))
            .order_by(Ticket.priority.desc(), Ticket.created_at.asc())
            .all()
        )

        total_open = len(open_tickets)
        if total_open == 0:
            if force:
                msg = "✅ *RESUMO DE CHAMADOS — TI FASANO*\n\nParabéns equipe! Não há nenhum chamado pendente ou aberto no momento. Todos os chamados estão devidamente finalizados."
                if config and config.summary_reminder_whatsapp and config.is_active:
                    EvolutionService.send_whatsapp_message(msg)
                return {"status": "success", "open_count": 0, "message": "Nenhum chamado pendente no momento."}
            return {"status": "skipped", "open_count": 0, "message": "Fila zerada. Nenhuma notificação necessária."}

        # Agrupar chamados por status
        tz_br = timezone(timedelta(hours=-3))
        now_br = datetime.now(tz_br)
        hora_str = now_br.strftime("%d/%m/%Y às %H:%M")

        new_list = [t for t in open_tickets if t.status == TicketStatus.NEW]
        in_progress_list = [t for t in open_tickets if t.status == TicketStatus.IN_PROGRESS]
        pending_val_list = [t for t in open_tickets if t.status == TicketStatus.PENDING_VALIDATION]

        # ── 1. Construir Mensagem WhatsApp ────────────────────────────────────
        wa_lines = [
            f"📋 *RESUMO OPERACIONAL DE CHAMADOS — TI FASANO* 📋",
            f"🕒 *Posição em:* {hora_str}",
            f"📊 *Total de Chamados Pendentes:* *{total_open}*",
            "",
            "⚠️ *ATENÇÃO EQUIPE DE TI:*",
            "Favor verificar o andamento e realizar o encerramento dos chamados abaixo, especialmente aqueles que já foram atendidos ou reestabelecidos e aguardam validação final!",
            ""
        ]

        if pending_val_list:
            wa_lines.append(f"⏳ *AGUARDANDO VALIDAÇÃO ({len(pending_val_list)}):*")
            for t in pending_val_list[:10]:
                titulo_curto = (t.title[:45] + "...") if len(t.title) > 48 else t.title
                wa_lines.append(f"• *#{t.id}* [{t.priority.value}] {titulo_curto}")
            if len(pending_val_list) > 10:
                wa_lines.append(f"  _... e mais {len(pending_val_list) - 10} chamados._")
            wa_lines.append("")

        if new_list:
            wa_lines.append(f"🚨 *NOVOS / NÃO INICIADOS ({len(new_list)}):*")
            for t in new_list[:10]:
                titulo_curto = (t.title[:45] + "...") if len(t.title) > 48 else t.title
                wa_lines.append(f"• *#{t.id}* [{t.priority.value}] {titulo_curto}")
            if len(new_list) > 10:
                wa_lines.append(f"  _... e mais {len(new_list) - 10} chamados._")
            wa_lines.append("")

        if in_progress_list:
            wa_lines.append(f"⚙️ *EM ATENDIMENTO ({len(in_progress_list)}):*")
            for t in in_progress_list[:10]:
                titulo_curto = (t.title[:45] + "...") if len(t.title) > 48 else t.title
                wa_lines.append(f"• *#{t.id}* [{t.priority.value}] {titulo_curto}")
            if len(in_progress_list) > 10:
                wa_lines.append(f"  _... e mais {len(in_progress_list) - 10} chamados._")
            wa_lines.append("")

        base_url = settings.app_base_url or "https://192.168.168.26"
        wa_lines.append(f"🔗 *Acesse o painel para gerenciar e encerrar:* {base_url}/admin/tickets")
        wa_msg = "\n".join(wa_lines)

        # ── 2. Construir HTML de E-mail ───────────────────────────────────────
        table_rows = []
        for t in open_tickets:
            created_local = t.created_at.astimezone(tz_br) if t.created_at.tzinfo else t.created_at
            data_str = created_local.strftime("%d/%m %H:%M")
            
            # Badge de Status
            if t.status == TicketStatus.PENDING_VALIDATION:
                status_color = "#b45309"
                status_bg = "#fef3c7"
            elif t.status == TicketStatus.NEW:
                status_color = "#b91c1c"
                status_bg = "#fee2e2"
            else:
                status_color = "#1d4ed8"
                status_bg = "#dbeafe"

            prio_color = "#991b1b" if t.priority == TicketPriority.CRITICAL else ("#c2410c" if t.priority == TicketPriority.HIGH else "#475569")

            table_rows.append(f"""
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 8px; font-weight: bold; color: #1e293b;">#{t.id}</td>
                <td style="padding: 10px 8px; font-size: 13px; color: #334155;">{t.title}</td>
                <td style="padding: 10px 8px; font-size: 12px; font-weight: bold; color: {prio_color};">{t.priority.value}</td>
                <td style="padding: 10px 8px;">
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; background: {status_bg}; color: {status_color};">
                        {t.status.value}
                    </span>
                </td>
                <td style="padding: 10px 8px; font-size: 12px; color: #64748b;">{data_str}</td>
            </tr>
            """)

        mail_details_html = f"""
        <p style="font-size: 14px; margin-bottom: 8px;">Olá equipe de TI,</p>
        <p style="font-size: 13px; color: #334155; margin-bottom: 16px;">
            Atualmente constam <strong>{total_open} chamados não finalizados</strong> no sistema TIHFSA. 
            <br>
            <span style="color: #b91c1c; font-weight: bold;">
                ⚠️ Solicitamos a atenção de todos para dar andamento, validar os dispositivos restabelecidos e concluir o encerramento dos chamados.
            </span>
        </p>
        
        <div style="margin: 16px 0; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                <thead>
                    <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 11px; text-transform: uppercase;">
                        <th style="padding: 8px;">ID</th>
                        <th style="padding: 8px;">Título / Equipamento</th>
                        <th style="padding: 8px;">Prioridade</th>
                        <th style="padding: 8px;">Status</th>
                        <th style="padding: 8px;">Data/Hora</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(table_rows)}
                </tbody>
            </table>
        </div>
        """

        # ── 3. Disparo das Notificações ───────────────────────────────────────
        wa_success = False
        email_success = False

        send_wa = True
        if config and hasattr(config, "summary_reminder_whatsapp"):
            send_wa = config.summary_reminder_whatsapp

        if send_wa:
            try:
                wa_res = EvolutionService.send_whatsapp_message(wa_msg)
                wa_success = bool(wa_res)
            except Exception as e:
                print(f"[Summary WhatsApp Error] {e}")

        send_em = True
        if config and hasattr(config, "summary_reminder_email"):
            send_em = config.summary_reminder_email

        if send_em:
            try:
                email_success = send_noc_email(
                    subject=f"📋 [RESUMO TI] {total_open} Chamados Pendentes — Cobrança Operacional ({hora_str})",
                    header_title=f"Resumo Operacional: {total_open} Chamados Pendentes",
                    details_html=mail_details_html,
                    status_type="info",
                )
            except Exception as e:
                print(f"[Summary Email Error] {e}")

        return {
            "status": "success",
            "open_count": total_open,
            "whatsapp_sent": wa_success,
            "email_sent": email_success,
            "message": f"Resumo enviado com sucesso para {total_open} chamados pendentes.",
        }

    finally:
        if should_close:
            db.close()
