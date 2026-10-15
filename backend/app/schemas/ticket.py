"""Schemas de Ticket e TicketInteraction."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TicketCreate(BaseModel):
    title: str
    description: str | None = None
    priority: str = "Média"
    support_level: str = "N1"  # N1, N2, N3 (Governança ITIL 4 / COBIT DSS02)
    requester_id: int
    technician_id: int | None = None
    asset_id: int | None = None
    category_id: int | None = None
    subcategory_id: int | None = None
    problem_type_id: int | None = None


class TicketUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    support_level: str | None = None
    technician_id: int | None = None
    asset_id: int | None = None
    category_id: int | None = None
    subcategory_id: int | None = None
    problem_type_id: int | None = None
    closure_reason: str | None = None


class TicketSolve(BaseModel):
    """Payload quando o técnico marca o chamado como resolvido."""
    solution_message: str


class TicketValidate(BaseModel):
    """Payload para validação do gestor (via magic link ou formulário)."""
    action: str  # "approve" ou "reject"
    token: str | None = None
    rejection_reason: str | None = None


class TicketTransfer(BaseModel):
    """Payload COBIT DSS02.04 — Transferência de Custódia Técnica com Motivo Obrigatório."""
    target_technician_id: int
    reason: str


class TicketEscalate(BaseModel):
    """Payload COBIT DSS02.05 — Escalação Funcional ou Hierárquica com Diagnóstico."""
    target_level: str  # "N1", "N2", "N3"
    target_technician_id: int | None = None  # None = Fila Geral do Nível
    reason: str  # Justificativa técnica / diagnóstico prévio
    escalation_type: str = "Funcional"  # "Funcional" (Técnica) ou "Hierárquica" (Gerencial)


class TicketBatchStatusUpdate(BaseModel):
    """Payload para atualização de status em massa com auditoria."""
    ticket_ids: list[int]
    status: str
    comment: str | None = None
    closure_reason: str | None = None
    notify_whatsapp: bool = False


class InteractionCreate(BaseModel):
    message: str
    is_solution: bool = False


class InteractionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    message: str
    is_solution: bool
    interaction_type: str = "comment"  # 'comment', 'system', 'take', 'transfer', 'escalate_functional', 'escalate_hierarchical'
    user_id: int
    user_name: str | None = None
    user_role: str | None = None
    attachments: list["TicketAttachmentResponse"] = []
    created_at: datetime


class TicketAttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int | None = None
    interaction_id: int | None = None
    file_name: str
    file_path: str
    content_type: str
    created_at: datetime


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None = None
    status: str
    priority: str
    support_level: str = "N1"  # ITIL 4 Service Desk Tier: N1, N2, N3
    first_response_at: datetime | None = None
    requester_id: int
    technician_id: int | None = None
    asset_id: int | None = None
    category_id: int | None = None
    subcategory_id: int | None = None
    problem_type_id: int | None = None
    created_at: datetime
    updated_at: datetime
    solved_at: datetime | None = None
    closed_at: datetime | None = None
    closure_reason: str | None = None
    reopened_at: datetime | None = None
    reopen_count: int = 0

    # Trilha de Auditoria COBIT DSS02 — Escalação e Transferência
    escalated_at: datetime | None = None
    escalated_by_id: int | None = None
    escalation_reason: str | None = None
    escalation_type: str | None = None
    previous_level: str | None = None
    transferred_at: datetime | None = None
    transferred_by_id: int | None = None
    transfer_reason: str | None = None
    previous_technician_id: int | None = None

    # Campos expandidos (populados na listagem e detalhe)
    requester_name: str | None = None
    technician_name: str | None = None
    category_name: str | None = None
    escalated_by_name: str | None = None
    transferred_by_name: str | None = None
    previous_technician_name: str | None = None


class TicketDetail(TicketResponse):
    """Ticket com dados expandidos para a tela de detalhe."""
    asset_name: str | None = None
    subcategory_name: str | None = None
    can_reopen: bool = False
    warranty_expires_at: datetime | None = None
    satisfaction_rating: int | None = None
    interactions: list[InteractionResponse] = []
    attachments: list[TicketAttachmentResponse] = []


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    zabbix_group_id: str | None = None
    zabbix_group_name: str | None = None
    is_global: bool = False
    is_public: bool = True


class ProblemTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    subcategory_id: int | None = None
    category_id: int | None = None


class SubcategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    category_id: int
    problem_types: list[ProblemTypeResponse] = []


class CategoryWithSubs(CategoryResponse):
    subcategories: list[SubcategoryResponse] = []
    problem_types: list[ProblemTypeResponse] = []
