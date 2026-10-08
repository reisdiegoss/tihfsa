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
from app.models.user import User
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


class CSATTechnicianPerformance(BaseModel):
    technician_id: Optional[int] = None
    technician_name: str
    total_answered: int
    average_rating: float
    satisfaction_pct: float
    rating_distribution: dict
    last_rating_at: Optional[str] = None


class CSATMetricsResponse(BaseModel):
    total_surveys: int
    answered_surveys: int
    response_rate_pct: float
    average_rating: float
    satisfaction_pct: float  # Notas 4 e 5
    rating_distribution: dict
    recent_comments: List[dict]
    technicians_performance: List[CSATTechnicianPerformance] = []


class CSATSurveyItem(BaseModel):
    id: int
    ticket_id: int
    ticket_title: str
    requester_name: str
    requester_email: Optional[str] = None
    department_name: Optional[str] = None
    technician_id: Optional[int] = None
    technician_name: str
    rating: int
    comment: Optional[str] = None
    answered_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class CSATSurveyListResponse(BaseModel):
    items: List[CSATSurveyItem]
    total: int
    limit: int
    offset: int


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
    """Retorna métricas consolidadas de CSAT, comentários recentes e ranking de técnicos para o painel de TI."""
    total = db.query(TicketSatisfactionSurvey).count()
    answered_surveys = (
        db.query(TicketSatisfactionSurvey)
        .filter(TicketSatisfactionSurvey.answered_at != None)
        .order_by(TicketSatisfactionSurvey.answered_at.desc())
        .all()
    )
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
            technicians_performance=[],
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

    # Agrupamento e desempenho por técnico
    tech_data = {}
    for s in answered_surveys:
        if s.rating is None:
            continue
        tk = s.ticket
        tech_id = tk.technician_id if tk and tk.technician_id else 0
        tech_name = tk.technician.display_name if tk and tk.technician else "Equipe TI (Geral)"
        
        if tech_id not in tech_data:
            tech_data[tech_id] = {
                "technician_id": tech_id if tech_id > 0 else None,
                "technician_name": tech_name,
                "ratings": [],
                "last_rating_at": None,
            }
        tech_data[tech_id]["ratings"].append(s.rating)
        if tech_data[tech_id]["last_rating_at"] is None and s.answered_at:
            tech_data[tech_id]["last_rating_at"] = s.answered_at.isoformat()

    technicians_performance = []
    for t_id, data in tech_data.items():
        t_ratings = data["ratings"]
        t_avg = round(sum(t_ratings) / len(t_ratings), 2)
        t_sat = round((sum(1 for r in t_ratings if r >= 4) / len(t_ratings)) * 100, 1)
        t_dist = {str(i): 0 for i in range(1, 6)}
        for r in t_ratings:
            if 1 <= r <= 5:
                t_dist[str(r)] += 1

        technicians_performance.append(
            CSATTechnicianPerformance(
                technician_id=data["technician_id"],
                technician_name=data["technician_name"],
                total_answered=len(t_ratings),
                average_rating=t_avg,
                satisfaction_pct=t_sat,
                rating_distribution=t_dist,
                last_rating_at=data["last_rating_at"],
            )
        )

    # Ordenar técnicos por nota média (decrescente) e volume de atendimentos
    technicians_performance.sort(key=lambda x: (x.average_rating, x.total_answered), reverse=True)

    # Comentários recentes
    recent_comments = []
    surveys_with_comments = [
        s for s in answered_surveys 
        if s.comment and s.comment.strip()
    ][:10]

    for sc in surveys_with_comments:
        tk = sc.ticket
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
        technicians_performance=technicians_performance,
    )


@router.get("/api/v1/reports/csat/surveys", response_model=CSATSurveyListResponse, summary="Listar todas as avaliações CSAT com filtros")
def list_csat_surveys(
    rating: Optional[int] = Query(None, ge=1, le=5, description="Filtrar por nota de 1 a 5 estrelas"),
    technician_id: Optional[int] = Query(None, description="Filtrar por ID do técnico"),
    has_comment: Optional[bool] = Query(None, description="Apenas com comentários"),
    search: Optional[str] = Query(None, description="Busca por solicitante, comentário ou chamado"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    """Retorna listagem detalhada de pesquisas de satisfação com filtros para o módulo administrativo."""
    query = (
        db.query(TicketSatisfactionSurvey)
        .join(Ticket, TicketSatisfactionSurvey.ticket_id == Ticket.id)
        .filter(TicketSatisfactionSurvey.answered_at != None)
    )

    if rating is not None and isinstance(rating, int):
        query = query.filter(TicketSatisfactionSurvey.rating == rating)

    if technician_id is not None and isinstance(technician_id, int):
        query = query.filter(Ticket.technician_id == technician_id)

    if has_comment is True:
        query = query.filter(TicketSatisfactionSurvey.comment != None, TicketSatisfactionSurvey.comment != "")

    if search and isinstance(search, str) and search.strip():
        search_term = f"%{search.strip()}%"
        from sqlalchemy import or_
        query = query.join(User, Ticket.requester_id == User.id, isouter=True)
        query = query.filter(
            or_(
                TicketSatisfactionSurvey.comment.ilike(search_term),
                Ticket.title.ilike(search_term),
                User.display_name.ilike(search_term),
                User.email.ilike(search_term),
            )
        )

    total = query.count()
    limit_val = limit if isinstance(limit, int) else 50
    offset_val = offset if isinstance(offset, int) else 0

    surveys = (
        query.order_by(TicketSatisfactionSurvey.answered_at.desc())
        .offset(offset_val)
        .limit(limit_val)
        .all()
    )

    items = []
    for s in surveys:
        tk = s.ticket
        req = tk.requester if tk else None
        tech = tk.technician if tk else None
        dept_name = req.department.name if req and req.department else None

        items.append(
            CSATSurveyItem(
                id=s.id,
                ticket_id=s.ticket_id,
                ticket_title=tk.title if tk else f"Chamado #{s.ticket_id}",
                requester_name=req.display_name if req else "Colaborador",
                requester_email=req.email if req else None,
                department_name=dept_name,
                technician_id=tech.id if tech else None,
                technician_name=tech.display_name if tech else "Não atribuído",
                rating=s.rating or 0,
                comment=s.comment,
                answered_at=s.answered_at,
                created_at=s.created_at,
            )
        )

    return CSATSurveyListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )

