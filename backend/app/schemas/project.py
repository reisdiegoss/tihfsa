from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


# ----------------------------------------------------
# Schemas para Usuários Resumidos
# ----------------------------------------------------
class UserMiniSummary(BaseModel):
    id: int
    display_name: str
    email: Optional[str] = None
    role: Optional[str] = None

    class Config:
        from_attributes = True


# ----------------------------------------------------
# Schemas para Ativos CMDB Vinculados (Resumo)
# ----------------------------------------------------
class AssetMiniSummary(BaseModel):
    id: int
    asset_tag: Optional[str] = None
    name: str
    type: str
    brand: Optional[str] = None
    model: Optional[str] = None
    ip_address: Optional[str] = None
    location_name: Optional[str] = None

    class Config:
        from_attributes = True


# ----------------------------------------------------
# Schemas para Linha do Tempo / Timeline de Projetos
# ----------------------------------------------------
class ProjectTimelineCreate(BaseModel):
    content: str = Field(..., min_length=1)
    event_type: str = "comment"  # comment, system, task, ticket, asset, status


class ProjectTimelineResponse(BaseModel):
    id: int
    project_id: int
    author_id: Optional[int] = None
    author: Optional[UserMiniSummary] = None
    event_type: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# ----------------------------------------------------
# Schemas para Chamados Vinculados (Resumo)
# ----------------------------------------------------
class ProjectTicketSummary(BaseModel):
    id: int
    title: str
    status: str
    priority: str
    support_level: Optional[str] = None
    requester_name: Optional[str] = None
    technician_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ----------------------------------------------------
# Schemas para Tarefas de Projetos
# ----------------------------------------------------
class ProjectTaskBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    status: str = Field(default="A Fazer")
    priority: str = Field(default="Média")
    is_blocked: bool = False
    blocked_reason: Optional[str] = None
    assigned_to_id: Optional[int] = None
    asset_id: Optional[int] = None
    checklist: Optional[List[dict]] = []
    due_date: Optional[date] = None
    order: int = 0


class ProjectTaskCreate(ProjectTaskBase):
    create_ticket: bool = False
    ticket_category_id: Optional[int] = None


class ProjectTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    is_blocked: Optional[bool] = None
    blocked_reason: Optional[str] = None
    assigned_to_id: Optional[int] = None
    asset_id: Optional[int] = None
    ticket_id: Optional[int] = None
    checklist: Optional[List[dict]] = None
    due_date: Optional[date] = None
    order: Optional[int] = None


class ProjectTaskResponse(ProjectTaskBase):
    id: int
    project_id: int
    ticket_id: Optional[int] = None
    ticket: Optional[ProjectTicketSummary] = None
    asset: Optional[AssetMiniSummary] = None
    assigned_to: Optional[UserMiniSummary] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ----------------------------------------------------
# Schemas para Projetos
# ----------------------------------------------------
class ProjectBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    status: str = Field(default="Planejamento")
    priority: str = Field(default="Média")
    category: str = Field(default="Infraestrutura")
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    budget: Optional[Decimal] = Decimal("0.00")
    spent: Optional[Decimal] = Decimal("0.00")
    manager_id: Optional[int] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    progress: Optional[int] = Field(None, ge=0, le=100)
    budget: Optional[Decimal] = None
    spent: Optional[Decimal] = None
    manager_id: Optional[int] = None


class ProjectResponse(ProjectBase):
    id: int
    code: str
    progress: int
    completed_at: Optional[datetime] = None
    created_by_id: Optional[int] = None
    manager: Optional[UserMiniSummary] = None
    created_by: Optional[UserMiniSummary] = None
    members: List[UserMiniSummary] = []
    tasks_count: int = 0
    tasks_completed_count: int = 0
    tickets_count: int = 0
    assets_count: int = 0
    members_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectDetailResponse(ProjectResponse):
    tasks: List[ProjectTaskResponse] = []
    tickets: List[ProjectTicketSummary] = []
    assets: List[AssetMiniSummary] = []
    timeline: List[ProjectTimelineResponse] = []

    class Config:
        from_attributes = True


# ----------------------------------------------------
# Ações Rápidas de Chamados, Membros e Ativos
# ----------------------------------------------------
class ProjectCreateTicketRequest(BaseModel):
    title: str = Field(..., max_length=300)
    description: Optional[str] = None
    priority: str = Field(default="Média")
    support_level: str = Field(default="N1")
    technician_id: Optional[int] = None
    category_id: Optional[int] = None
    create_task: bool = True  # Se deve criar também um cartão no Kanban do projeto


class ProjectLinkTicketRequest(BaseModel):
    ticket_id: int


class ProjectMemberRequest(BaseModel):
    user_id: int


class ProjectAssetRequest(BaseModel):
    asset_id: int
