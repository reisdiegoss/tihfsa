import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Table, Column, Integer, String, Text, Date, DateTime, Numeric, ForeignKey, Boolean, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
from app.database import Base


class ProjectStatus(str, enum.Enum):
    PLANEJAMENTO = "Planejamento"
    EM_ANDAMENTO = "Em Andamento"
    PAUSADO = "Pausado"
    CONCLUIDO = "Concluído"
    CANCELADO = "Cancelado"


class ProjectPriority(str, enum.Enum):
    BAIXA = "Baixa"
    MEDIA = "Média"
    ALTA = "Alta"
    CRITICA = "Crítica"


class TaskStatus(str, enum.Enum):
    A_FAZER = "A Fazer"
    EM_ANDAMENTO = "Em Andamento"
    EM_REVISAO = "Em Revisão"
    CONCLUIDO = "Concluído"


class TaskPriority(str, enum.Enum):
    BAIXA = "Baixa"
    MEDIA = "Média"
    ALTA = "Alta"
    URGENTE = "Urgente"


# Tabelas Associativas N:N
project_members = Table(
    "project_members",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)

project_assets = Table(
    "project_assets",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("asset_id", Integer, ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True),
)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(30), unique=True, index=True, nullable=False)  # Ex: PRJ-001
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    status = Column(String(50), default=ProjectStatus.PLANEJAMENTO.value, nullable=False, index=True)
    priority = Column(String(50), default=ProjectPriority.MEDIA.value, nullable=False, index=True)
    category = Column(String(100), default="Infraestrutura", nullable=False, index=True)
    
    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    progress = Column(Integer, default=0, nullable=False)  # 0 a 100 %
    budget = Column(Numeric(12, 2), default=0.0, nullable=True)
    spent = Column(Numeric(12, 2), default=0.0, nullable=True)

    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relacionamentos
    manager = relationship("User", foreign_keys=[manager_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    members = relationship("User", secondary=project_members, backref="assigned_projects")
    assets = relationship("Asset", secondary=project_assets, backref="assigned_projects")
    tasks = relationship("ProjectTask", back_populates="project", cascade="all, delete-orphan", order_by="ProjectTask.order")
    tickets = relationship("Ticket", back_populates="project", foreign_keys="Ticket.project_id")
    timeline = relationship("ProjectTimeline", back_populates="project", cascade="all, delete-orphan", order_by="desc(ProjectTimeline.created_at)")


class ProjectTask(Base):
    __tablename__ = "project_tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default=TaskStatus.A_FAZER.value, nullable=False, index=True)
    priority = Column(String(50), default=TaskPriority.MEDIA.value, nullable=False)
    
    is_blocked = Column(Boolean, default=False, nullable=False)
    blocked_reason = Column(Text, nullable=True)
    
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True, index=True)
    due_date = Column(Date, nullable=True)
    order = Column(Integer, default=0, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relacionamentos
    project = relationship("Project", back_populates="tasks")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    ticket = relationship("Ticket", foreign_keys=[ticket_id])


class ProjectTimeline(Base):
    __tablename__ = "project_timeline"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(50), default="comment", nullable=False)  # comment, system, task, ticket, asset, status
    content = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relacionamentos
    project = relationship("Project", back_populates="timeline")
    author = relationship("User", foreign_keys=[author_id])
