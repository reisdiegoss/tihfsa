"""
Router Knowledge Base — Base de Conhecimento e Procedimentos Operacionais.

Implementa controle estrito de acesso baseado em papéis (RBAC):
- Solicitante / Visitante Público: Apenas artigos e categorias de autoatendimento ('requester')
- Técnico N1/N2/N3: Acesso a 'requester' e 'technician' (com filtro por nível de suporte)
- Administrador: Acesso 100% irrestrito incluindo 'admin' (onboarding de novos hotéis, deploys, AD)
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.database import get_db
from app.auth.dependencies import get_optional_user, require_admin, require_technician, _get_user_roles
from app.models.user import User
from app.models.knowledge_base import KnowledgeCategory, KnowledgeArticle
from app.schemas.knowledge_base import (
    KnowledgeCategoryOut, KnowledgeCategoryCreate, KnowledgeCategoryUpdate,
    KnowledgeArticleListOut, KnowledgeArticleDetailOut,
    KnowledgeArticleCreate, KnowledgeArticleUpdate,
    KnowledgeFeedbackIn,
)
from app.services.knowledge_seed import slugify, seed_knowledge_base

router = APIRouter(prefix="/api/v1/kb", tags=["Knowledge Base"])


def _resolve_user_clearance(user: Optional[User]) -> str:
    """
    Retorna o nível de permissão máximo do usuário:
    - 'admin': pode ver tudo
    - 'technician': pode ver requester + technician
    - 'requester': pode ver apenas requester
    """
    if not user:
        return "requester"
    roles = _get_user_roles(user)
    if "admin" in roles:
        return "admin"
    if "technician" in roles or user.support_level:
        return "technician"
    return "requester"


# ─── CATEGORIAS ───────────────────────────────────────────────

@router.get("/categories", response_model=List[KnowledgeCategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Lista categorias autorizadas para o perfil do usuário atual.
    """
    clearance = _resolve_user_clearance(current_user)

    query = db.query(KnowledgeCategory).filter(KnowledgeCategory.is_active == True)

    if clearance == "requester":
        query = query.filter(KnowledgeCategory.min_role == "requester")
    elif clearance == "technician":
        query = query.filter(KnowledgeCategory.min_role.in_(["requester", "technician"]))
    # admin vê todas

    categories = query.order_by(KnowledgeCategory.order_index).all()

    # Calcular contagem de artigos visíveis por categoria
    result = []
    for cat in categories:
        art_query = db.query(func.count(KnowledgeArticle.id)).filter(
            KnowledgeArticle.category_id == cat.id,
            KnowledgeArticle.is_published == True,
        )
        if clearance == "requester":
            art_query = art_query.filter(KnowledgeArticle.target_role == "requester")
        elif clearance == "technician":
            art_query = art_query.filter(KnowledgeArticle.target_role.in_(["requester", "technician"]))

        count = art_query.scalar() or 0
        cat_out = KnowledgeCategoryOut(
            id=cat.id,
            name=cat.name,
            slug=cat.slug,
            icon=cat.icon,
            description=cat.description,
            min_role=cat.min_role,
            order_index=cat.order_index,
            is_active=cat.is_active,
            created_at=cat.created_at,
            articles_count=count,
        )
        result.append(cat_out)

    return result


@router.post("/categories", response_model=KnowledgeCategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: KnowledgeCategoryCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Cria uma nova categoria (Apenas Admin)."""
    slug = payload.slug or slugify(payload.name)
    existing = db.query(KnowledgeCategory).filter(KnowledgeCategory.slug == slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Já existe uma categoria com este nome ou slug.")

    cat = KnowledgeCategory(
        name=payload.name,
        slug=slug,
        icon=payload.icon,
        description=payload.description,
        min_role=payload.min_role,
        order_index=payload.order_index,
        is_active=payload.is_active,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


# ─── ARTIGOS ──────────────────────────────────────────────────

@router.get("/articles", response_model=List[KnowledgeArticleListOut])
def list_articles(
    q: Optional[str] = Query(None, description="Busca textual por título, resumo, conteúdo ou tags"),
    category_id: Optional[int] = Query(None),
    category_slug: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    target_role: Optional[str] = Query(None),
    support_level: Optional[str] = Query(None, description="Filtro N1, N2, N3"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Retorna os artigos publicados autorizados para o perfil do usuário conectado.
    """
    clearance = _resolve_user_clearance(current_user)

    query = db.query(KnowledgeArticle).join(KnowledgeCategory).filter(
        KnowledgeArticle.is_published == True,
        KnowledgeCategory.is_active == True,
    )

    # Regras de RBAC estritas
    if clearance == "requester":
        query = query.filter(
            KnowledgeCategory.min_role == "requester",
            KnowledgeArticle.target_role == "requester",
        )
    elif clearance == "technician":
        query = query.filter(
            KnowledgeCategory.min_role.in_(["requester", "technician"]),
            KnowledgeArticle.target_role.in_(["requester", "technician"]),
        )
    # admin tem acesso total

    # Filtros opcionais
    if category_id:
        query = query.filter(KnowledgeArticle.category_id == category_id)
    if category_slug:
        query = query.filter(KnowledgeCategory.slug == category_slug)
    if target_role and clearance == "admin":
        query = query.filter(KnowledgeArticle.target_role == target_role)
    if support_level and support_level != "ALL":
        query = query.filter(
            or_(
                KnowledgeArticle.support_level == support_level,
                KnowledgeArticle.support_level == "ALL",
            )
        )

    # Busca textual (Case-insensitive)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                KnowledgeArticle.title.ilike(term),
                KnowledgeArticle.summary.ilike(term),
                KnowledgeArticle.content.ilike(term),
            )
        )

    articles = query.order_by(KnowledgeArticle.order_index, KnowledgeArticle.views_count.desc()).all()

    # Filtro em memória para tags se especificado
    if tag:
        tag_lower = tag.lower().strip()
        articles = [a for a in articles if any(tag_lower in (t or "").lower() for t in (a.tags or []))]

    result = []
    for a in articles:
        result.append(
            KnowledgeArticleListOut(
                id=a.id,
                category_id=a.category_id,
                category_name=a.category.name if a.category else None,
                category_icon=a.category.icon if a.category else None,
                title=a.title,
                slug=a.slug,
                summary=a.summary,
                target_role=a.target_role,
                support_level=a.support_level,
                tags=a.tags or [],
                is_published=a.is_published,
                views_count=a.views_count,
                helpful_count=a.helpful_count,
                unhelpful_count=a.unhelpful_count,
                order_index=a.order_index,
                updated_at=a.updated_at,
            )
        )

    return result


@router.get("/articles/{id_or_slug}", response_model=KnowledgeArticleDetailOut)
def get_article(
    id_or_slug: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Obtém um artigo detalhado por ID ou slug, validando permissão de perfil e incrementando contagem de leitura.
    """
    clearance = _resolve_user_clearance(current_user)

    if id_or_slug.isdigit():
        art = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == int(id_or_slug)).first()
    else:
        art = db.query(KnowledgeArticle).filter(KnowledgeArticle.slug == id_or_slug).first()

    if not art:
        raise HTTPException(status_code=404, detail="Artigo não encontrado.")

    # Validação de RBAC
    if clearance == "requester":
        if art.target_role != "requester" or (art.category and art.category.min_role != "requester"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso restrito ao perfil técnico ou administrativo.",
            )
    elif clearance == "technician":
        if art.target_role == "admin" or (art.category and art.category.min_role == "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso restrito ao perfil de Administrador.",
            )

    # Incrementar visualizações de forma atômica
    try:
        art.views_count = (art.views_count or 0) + 1
        db.commit()
    except Exception:
        db.rollback()

    return KnowledgeArticleDetailOut(
        id=art.id,
        category_id=art.category_id,
        category_name=art.category.name if art.category else None,
        category_icon=art.category.icon if art.category else None,
        title=art.title,
        slug=art.slug,
        summary=art.summary,
        content=art.content,
        target_role=art.target_role,
        support_level=art.support_level,
        tags=art.tags or [],
        is_published=art.is_published,
        views_count=art.views_count,
        helpful_count=art.helpful_count,
        unhelpful_count=art.unhelpful_count,
        order_index=art.order_index,
        created_at=art.created_at,
        updated_at=art.updated_at,
        created_by_id=art.created_by_id,
        author_name=art.author.display_name if art.author else "Equipe TI Fasano",
    )


@router.post("/articles/{article_id}/feedback")
def submit_article_feedback(
    article_id: int,
    payload: KnowledgeFeedbackIn,
    db: Session = Depends(get_db),
):
    """
    Registra avaliação de utilidade do artigo (Útil / Não Útil).
    """
    art = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not art:
        raise HTTPException(status_code=404, detail="Artigo não encontrado.")

    if payload.is_helpful:
        art.helpful_count = (art.helpful_count or 0) + 1
    else:
        art.unhelpful_count = (art.unhelpful_count or 0) + 1

    db.commit()
    return {"status": "success", "helpful_count": art.helpful_count, "unhelpful_count": art.unhelpful_count}


@router.post("/articles", response_model=KnowledgeArticleDetailOut, status_code=status.HTTP_201_CREATED)
def create_article(
    payload: KnowledgeArticleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    """
    Cria um novo artigo na base de conhecimento (Técnicos ou Admins).
    """
    clearance = _resolve_user_clearance(current_user)
    if payload.target_role == "admin" and clearance != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem criar artigos de perfil Admin.")

    slug = payload.slug or slugify(payload.title)
    existing = db.query(KnowledgeArticle).filter(KnowledgeArticle.slug == slug).first()
    if existing:
        slug = f"{slug}-{int(func.extract('epoch', func.now()))}"

    art = KnowledgeArticle(
        category_id=payload.category_id,
        title=payload.title,
        slug=slug,
        summary=payload.summary,
        content=payload.content,
        target_role=payload.target_role,
        support_level=payload.support_level,
        tags=payload.tags or [],
        is_published=payload.is_published,
        order_index=payload.order_index,
        created_by_id=current_user.id,
    )
    db.add(art)
    db.commit()
    db.refresh(art)

    return KnowledgeArticleDetailOut(
        id=art.id,
        category_id=art.category_id,
        category_name=art.category.name if art.category else None,
        category_icon=art.category.icon if art.category else None,
        title=art.title,
        slug=art.slug,
        summary=art.summary,
        content=art.content,
        target_role=art.target_role,
        support_level=art.support_level,
        tags=art.tags or [],
        is_published=art.is_published,
        views_count=0,
        helpful_count=0,
        unhelpful_count=0,
        order_index=art.order_index,
        created_at=art.created_at,
        updated_at=art.updated_at,
        created_by_id=art.created_by_id,
        author_name=current_user.display_name,
    )


@router.put("/articles/{article_id}", response_model=KnowledgeArticleDetailOut)
def update_article(
    article_id: int,
    payload: KnowledgeArticleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    """
    Atualiza um artigo existente (Técnicos ou Admins).
    """
    art = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not art:
        raise HTTPException(status_code=404, detail="Artigo não encontrado.")

    clearance = _resolve_user_clearance(current_user)
    if (art.target_role == "admin" or payload.target_role == "admin") and clearance != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem editar artigos de perfil Admin.")

    if payload.category_id is not None:
        art.category_id = payload.category_id
    if payload.title is not None:
        art.title = payload.title
    if payload.slug is not None:
        art.slug = slugify(payload.slug)
    if payload.summary is not None:
        art.summary = payload.summary
    if payload.content is not None:
        art.content = payload.content
    if payload.target_role is not None:
        art.target_role = payload.target_role
    if payload.support_level is not None:
        art.support_level = payload.support_level
    if payload.tags is not None:
        art.tags = payload.tags
    if payload.is_published is not None:
        art.is_published = payload.is_published
    if payload.order_index is not None:
        art.order_index = payload.order_index

    db.commit()
    db.refresh(art)

    return KnowledgeArticleDetailOut(
        id=art.id,
        category_id=art.category_id,
        category_name=art.category.name if art.category else None,
        category_icon=art.category.icon if art.category else None,
        title=art.title,
        slug=art.slug,
        summary=art.summary,
        content=art.content,
        target_role=art.target_role,
        support_level=art.support_level,
        tags=art.tags or [],
        is_published=art.is_published,
        views_count=art.views_count,
        helpful_count=art.helpful_count,
        unhelpful_count=art.unhelpful_count,
        order_index=art.order_index,
        created_at=art.created_at,
        updated_at=art.updated_at,
        created_by_id=art.created_by_id,
        author_name=art.author.display_name if art.author else current_user.display_name,
    )


@router.delete("/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article(
    article_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Exclui um artigo (Apenas Admin)."""
    art = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not art:
        raise HTTPException(status_code=404, detail="Artigo não encontrado.")

    db.delete(art)
    db.commit()
    return None


@router.post("/seed")
def trigger_seed(
    overwrite: bool = Query(False, description="Sobrescrever artigos existentes com o template padrão"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Executa o povoamento inicial ou atualização dos artigos da Base de Conhecimento (Apenas Admin).
    """
    result = seed_knowledge_base(db, overwrite=overwrite)
    return {"status": "success", "result": result}
