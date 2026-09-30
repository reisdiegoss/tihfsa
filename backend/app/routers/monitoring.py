"""
Router Monitoring — Central unificada de dados de monitoramento (Helpdesk & NOC) para Wallboard e TVs.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.sla_service import get_helpdesk_monitoring_summary

router = APIRouter(prefix="/api/v1/monitoring", tags=["Monitoring"])


@router.get("/helpdesk/summary", summary="Obter resumo e KPIs de Helpdesk para TV e Monitoramento")
def get_helpdesk_summary_endpoint(
    period_days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    """
    Retorna o resumo em tempo real para o painel de TV (Helpdesk Wallboard)
    e para a aba de Helpdesk do Hub de Monitoramento:
    - Indicadores ao vivo (abertos, novos, em andamento, críticos, sem técnico)
    - Prazos e conformidade de SLA
    - Fila prioritária com cronômetro regressivo
    - Carga de atendimento por técnico
    - Ranking de setores mais demandantes
    """
    return get_helpdesk_monitoring_summary(db=db, period_days=period_days)
