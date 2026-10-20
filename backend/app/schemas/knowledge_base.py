"""
Schemas Pydantic para o Módulo de Base de Conhecimento (TIHFSA).
"""
from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, Field


# ─── CATEGORIAS ───────────────────────────────────────────────

class KnowledgeCategoryBase(BaseModel):
    name: str = Field(..., max_length=120)
    slug: Optional[str] = None
    icon: str = Field(default="HelpCircle", max_length=50)
    description: Optional[str] = Field(None, max_length=300)
    min_role: str = Field(default="requester", description="requester, technician, admin")
    order_index: int = 0
    is_active: bool = True


class KnowledgeCategoryCreate(KnowledgeCategoryBase):
    pass


class KnowledgeCategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    min_role: Optional[str] = None
    order_index: Optional[int] = None
    is_active: Optional[bool] = None


class KnowledgeCategoryOut(KnowledgeCategoryBase):
    id: int
    created_at: datetime
    articles_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ─── ARTIGOS ──────────────────────────────────────────────────

class KnowledgeArticleBase(BaseModel):
    category_id: int
    title: str = Field(..., max_length=200)
    slug: Optional[str] = None
    summary: Optional[str] = Field(None, max_length=500)
    content: str
    target_role: str = Field(default="requester", description="requester, technician, admin")
    support_level: str = Field(default="ALL", description="ALL, N1, N2, N3")
    tags: List[str] = Field(default_factory=list)
    is_published: bool = True
    order_index: int = 0


class KnowledgeArticleCreate(KnowledgeArticleBase):
    pass


class KnowledgeArticleUpdate(BaseModel):
    category_id: Optional[int] = None
    title: Optional[str] = None
    slug: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    target_role: Optional[str] = None
    support_level: Optional[str] = None
    tags: Optional[List[str]] = None
    is_published: Optional[bool] = None
    order_index: Optional[int] = None


class KnowledgeArticleListOut(BaseModel):
    id: int
    category_id: int
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    title: str
    slug: str
    summary: Optional[str] = None
    target_role: str
    support_level: str
    tags: List[str] = []
    is_published: bool
    views_count: int
    helpful_count: int
    unhelpful_count: int
    order_index: int
    updated_at: datetime

    class Config:
        from_attributes = True


class KnowledgeArticleDetailOut(KnowledgeArticleListOut):
    content: str
    created_at: datetime
    created_by_id: Optional[int] = None
    author_name: Optional[str] = None

    class Config:
        from_attributes = True


class KnowledgeFeedbackIn(BaseModel):
    is_helpful: bool
