"""
Router Surveys — Pesquisa de Satisfação CSAT (1 a 5 Estrelas) e Indicadores de Atendimento.
Hotel Fasano Salvador — TI Corporativa
"""
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.satisfaction_survey import TicketSatisfactionSurvey
from app.models.ticket import Ticket
from app.auth.dependencies import require_technician, get_current_user

router = APIRouter(tags=["CSAT Surveys"])


class SurveyPublicResponse(BaseModel):
    ticket_id: int
    ticket_title: str
    requester_name: str
    technician_name: Optional[str] = None
    solution: Optional[str] = None
    rating: Optional[int] = None
    comment: Optional[str] = None
    answered: bool
    answered_at: Optional[datetime] = None


class SurveySubmitPayload(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Nota de 1 a 5 estrelas")
    comment: Optional[str] = Field(None, max_length=1000, description="Comentário opcional")


class CSATMetricsResponse(BaseModel):
    total_surveys: int
    answered_surveys: int
    response_rate_pct: float
    average_rating: float
    satisfaction_pct: float  # Notas 4 e 5
    rating_distribution: dict
    recent_comments: List[dict]


@router.get("/api/v1/public/surveys/{token}", response_model=SurveyPublicResponse, summary="Obter dados públicos da pesquisa CSAT pelo token")
def get_survey_by_token(token: str, db: Session = Depends(get_db)):
    """Carrega as informações do chamado para o formulário de avaliação sem exigir login."""
    survey = db.query(TicketSatisfactionSurvey).filter(TicketSatisfactionSurvey.token == token).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Pesquisa de satisfação não encontrada ou token inválido.")

    ticket = db.query(Ticket).filter(Ticket.id == survey.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado vinculado não encontrado.")

    tech_name = ticket.technician.display_name if ticket.technician else "Equipe de TI"
    req_name = ticket.requester.display_name if ticket.requester else "Colaborador"

    # Busca última solução registrada
    last_solution = ""
    for it in reversed(ticket.interactions or []):
        if it.is_solution:
            last_solution = it.message
            break

    return SurveyPublicResponse(
        ticket_id=ticket.id,
        ticket_title=ticket.title,
        requester_name=req_name,
        technician_name=tech_name,
        solution=last_solution or ticket.closure_reason,
        rating=survey.rating,
        comment=survey.comment,
        answered=survey.answered_at is not None,
        answered_at=survey.answered_at,
    )


@router.post("/api/v1/public/surveys/{token}", response_model=SurveyPublicResponse, summary="Registrar voto de 1 a 5 estrelas na pesquisa CSAT")
def submit_survey(token: str, payload: SurveySubmitPayload, db: Session = Depends(get_db)):
    """Salva a avaliação e o comentário opcional do solicitante."""
    survey = db.query(TicketSatisfactionSurvey).filter(TicketSatisfactionSurvey.token == token).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Pesquisa de satisfação não encontrada ou token inválido.")

    now = datetime.now(timezone.utc)
    survey.rating = payload.rating
    survey.comment = (payload.comment or "").strip() or None
    survey.answered_at = now

    db.commit()
    db.refresh(survey)

    ticket = db.query(Ticket).filter(Ticket.id == survey.ticket_id).first()
    tech_name = ticket.technician.display_name if ticket and ticket.technician else "Equipe de TI"
    req_name = ticket.requester.display_name if ticket and ticket.requester else "Colaborador"

    return SurveyPublicResponse(
        ticket_id=survey.ticket_id,
        ticket_title=ticket.title if ticket else "",
        requester_name=req_name,
        technician_name=tech_name,
        solution=ticket.closure_reason if ticket else None,
        rating=survey.rating,
        comment=survey.comment,
        answered=True,
        answered_at=survey.answered_at,
    )


@router.get("/api/v1/reports/csat", response_model=CSATMetricsResponse, summary="Indicadores de Satisfação CSAT para o Dashboard")
def get_csat_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    """Retorna métricas consolidadas de CSAT e comentários recentes para o painel de TI."""
    total = db.query(TicketSatisfactionSurvey).count()
    answered_surveys = db.query(TicketSatisfactionSurvey).filter(TicketSatisfactionSurvey.answered_at != None).all()
    answered_count = len(answered_surveys)

    if answered_count == 0:
        return CSATMetricsResponse(
            total_surveys=total,
            answered_surveys=0,
            response_rate_pct=0.0,
            average_rating=5.0,
            satisfaction_pct=100.0,
            rating_distribution={"1": 0, "2": 0, "3": 0, "4": 0, "5": 0},
            recent_comments=[],
        )

    ratings = [s.rating for s in answered_surveys if s.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else 0.0

    satisfied = sum(1 for r in ratings if r >= 4)
    satisfaction_pct = round((satisfied / len(ratings)) * 100, 1) if ratings else 0.0
    response_rate = round((answered_count / total) * 100, 1) if total > 0 else 0.0

    distribution = {str(i): 0 for i in range(1, 6)}
    for r in ratings:
        if 1 <= r <= 5:
            distribution[str(r)] += 1

    # Comentários recentes
    recent_comments = []
    surveys_with_comments = (
        db.query(TicketSatisfactionSurvey)
        .filter(TicketSatisfactionSurvey.comment != None, TicketSatisfactionSurvey.comment != "")
        .order_by(TicketSatisfactionSurvey.answered_at.desc())
        .limit(10)
        .all()
    )

    for sc in surveys_with_comments:
        tk = db.query(Ticket).filter(Ticket.id == sc.ticket_id).first()
        recent_comments.append({
            "ticket_id": sc.ticket_id,
            "ticket_title": tk.title if tk else "",
            "requester_name": tk.requester.display_name if tk and tk.requester else "Colaborador",
            "technician_name": tk.technician.display_name if tk and tk.technician else "Equipe TI",
            "rating": sc.rating,
            "comment": sc.comment,
            "answered_at": sc.answered_at.isoformat() if sc.answered_at else None,
        })

    return CSATMetricsResponse(
        total_surveys=total,
        answered_surveys=answered_count,
        response_rate_pct=response_rate,
        average_rating=avg_rating,
        satisfaction_pct=satisfaction_pct,
        rating_distribution=distribution,
        recent_comments=recent_comments,
    )
