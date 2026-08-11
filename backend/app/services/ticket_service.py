"""
Service TicketService — regras de negócio do Helpdesk.

Regra de Ouro: Técnico NÃO fecha chamado diretamente.
Fluxo: IN_PROGRESS → solve() → PENDING_VALIDATION → gestor valida → CLOSED ou REJECTED.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.ticket import Ticket, TicketStatus
from app.models.ticket_interaction import TicketInteraction
from app.models.user import User
from app.auth.jwt_handler import create_validation_token, decode_token
from app.config import settings


class TicketService:

    @staticmethod
    def solve_ticket(db: Session, ticket: Ticket, technician: User, solution_message: str) -> Ticket:
        """
        Técnico marca chamado como resolvido.
        1. Registra a interação com is_solution=True
        2. Muda status para PENDING_VALIDATION
        3. Gera magic links (approve/reject) para o gestor
        4. Dispara e-mail ao gestor do solicitante
        """
        # Registrar interação de solução
        interaction = TicketInteraction(
            ticket_id=ticket.id,
            user_id=technician.id,
            message=solution_message,
            is_solution=True,
        )
        db.add(interaction)

        # Mudar status
        ticket.status = TicketStatus.PENDING_VALIDATION
        ticket.solved_at = datetime.now(timezone.utc)
        ticket.technician_id = technician.id

        # Buscar gestor do solicitante
        requester = db.query(User).filter(User.id == ticket.requester_id).first()
        manager = None
        if requester and requester.manager_id:
            manager = db.query(User).filter(User.id == requester.manager_id).first()

        if manager and manager.email:
            # Gerar tokens de validação (uso único)
            approve_token = create_validation_token(ticket.id, manager.id, "approve")
            reject_token = create_validation_token(ticket.id, manager.id, "reject")

            ticket.validation_token = approve_token  # Armazena para referência

            # Montar URLs de validação
            base_url = settings.app_base_url
            approve_url = f"{base_url}/validate?token={approve_token}&action=approve"
            reject_url = f"{base_url}/validate?token={reject_token}&action=reject"

            # Disparar e-mail ao gestor (assíncrono)
            try:
                from app.services.email_service import send_validation_email
                send_validation_email(
                    ticket=ticket,
                    requester_name=requester.display_name,
                    manager_email=manager.email,
                    manager_name=manager.display_name,
                    technician_name=technician.display_name,
                    solution=solution_message,
                    approve_url=approve_url,
                    reject_url=reject_url,
                )
            except Exception as e:
                # Log do erro mas não bloqueia o fluxo
                print(f"[WARN] Falha ao enviar e-mail de validação: {e}")

        db.commit()
        db.refresh(ticket)
        return ticket

    @staticmethod
    def validate_ticket(db: Session, ticket_id: int, token: str, action: str, rejection_reason: str | None = None) -> Ticket:
        """
        Gestor valida a solução via magic link.
        - approve: fecha o chamado (CLOSED)
        - reject: volta para o técnico (IN_PROGRESS)
        """
        # Decodificar token
        payload = decode_token(token)
        if not payload or payload.get("type") != "validation":
            raise ValueError("Token de validação inválido ou expirado")

        if payload.get("ticket_id") != ticket_id:
            raise ValueError("Token não corresponde ao chamado")

        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise ValueError("Chamado não encontrado")

        if ticket.status != TicketStatus.PENDING_VALIDATION:
            raise ValueError(f"Chamado não está aguardando validação (status: {ticket.status.value})")

        manager_id = payload.get("manager_id")

        if action == "approve":
            ticket.status = TicketStatus.CLOSED
            ticket.closed_at = datetime.now(timezone.utc)
            ticket.validation_token = None  # Invalida o token

            interaction = TicketInteraction(
                ticket_id=ticket.id,
                user_id=manager_id,
                message="Solucao aprovada pelo gestor.",
                is_solution=False,
            )
            db.add(interaction)

        elif action == "reject":
            ticket.status = TicketStatus.IN_PROGRESS
            ticket.solved_at = None
            ticket.validation_token = None

            msg = f"Solucao rejeitada pelo gestor."
            if rejection_reason:
                msg += f" Motivo: {rejection_reason}"

            interaction = TicketInteraction(
                ticket_id=ticket.id,
                user_id=manager_id,
                message=msg,
                is_solution=False,
            )
            db.add(interaction)
        else:
            raise ValueError("Ação inválida. Use 'approve' ou 'reject'.")

        db.commit()
        db.refresh(ticket)
        return ticket
