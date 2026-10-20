"""
Model KnowledgeBase — Base de Conhecimento e Procedimentos Operacionais (TIHFSA).

Categorias e Artigos com controle de acesso baseado em papéis (RBAC):
- Requester: Colaborador/solicitante (autoatendimento, PWA, abertura/acompanhamento)
- Technician: Técnico de TI (operações de chamados, N1/N2/N3, CMDB, NOC, termos)
- Admin: Administrador (acesso irrestrito, onboarding de novo hotel, integrações)
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship

from app.database import Base


class KnowledgeCategory(Base):
    __tablename__ = "knowledge_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True)
    slug = Column(String(140), nullable=False, unique=True, index=True)
    icon = Column(String(50), default="HelpCircle", nullable=False)
    description = Column(String(300), nullable=True)
    min_role = Column(String(20), default="requester", nullable=False)  # requester, technician, admin
    order_index = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    articles = relationship(
        "KnowledgeArticle",
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="KnowledgeArticle.order_index"
    )

    def __repr__(self):
        return f"<KnowledgeCategory {self.id}: {self.name} (min_role={self.min_role})>"


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("knowledge_categories.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    slug = Column(String(220), nullable=False, unique=True, index=True)
    summary = Column(String(500), nullable=True)
    content = Column(Text, nullable=False)
    target_role = Column(String(20), default="requester", nullable=False, index=True)  # requester, technician, admin
    support_level = Column(String(10), default="ALL", nullable=False, index=True)      # ALL, N1, N2, N3
    tags = Column(JSON, default=list, nullable=False)
    is_published = Column(Boolean, default=True, nullable=False, index=True)
    views_count = Column(Integer, default=0, nullable=False)
    helpful_count = Column(Integer, default=0, nullable=False)
    unhelpful_count = Column(Integer, default=0, nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
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

    category = relationship("KnowledgeCategory", back_populates="articles")
    author = relationship("User", foreign_keys=[created_by_id])

    def __repr__(self):
        return f"<KnowledgeArticle {self.id}: {self.title} (role={self.target_role}, lvl={self.support_level})>"
