"""Schemas de Ticket e TicketInteraction."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TicketCreate(BaseModel):
    title: str
    description: str | None = None
    priority: str = "Média"
    requester_id: int
    technician_id: int | None = None
    asset_id: int | None = None
    category_id: int | None = None
    subcategory_id: int | None = None


class TicketUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    technician_id: int | None = None
    asset_id: int | None = None
    category_id: int | None = None
    subcategory_id: int | None = None


class TicketSolve(BaseModel):
    """Payload quando o técnico marca o chamado como resolvido."""
    solution_message: str


class TicketValidate(BaseModel):
    """Payload para validação do gestor (via magic link ou formulário)."""
    action: str  # "approve" ou "reject"
    token: str | None = None
    rejection_reason: str | None = None


class InteractionCreate(BaseModel):
    message: str
    is_solution: bool = False


class InteractionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    message: str
    is_solution: bool
    user_id: int
    created_at: datetime


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None = None
    status: str
    priority: str
    requester_id: int
    technician_id: int | None = None
    asset_id: int | None = None
    category_id: int | None = None
    subcategory_id: int | None = None
    created_at: datetime
    updated_at: datetime
    solved_at: datetime | None = None
    closed_at: datetime | None = None


class TicketDetail(TicketResponse):
    """Ticket com dados expandidos para a tela de detalhe."""
    requester_name: str | None = None
    technician_name: str | None = None
    asset_name: str | None = None
    category_name: str | None = None
    subcategory_name: str | None = None
    interactions: list[InteractionResponse] = []


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None


class SubcategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    category_id: int


class CategoryWithSubs(CategoryResponse):
    subcategories: list[SubcategoryResponse] = []
