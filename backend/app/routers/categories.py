"""
Router Categories — CRUD de categorias e subcategorias de chamados.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.category import Category, Subcategory
from app.models.problem_type import ProblemType
from app.schemas.ticket import CategoryResponse, SubcategoryResponse, CategoryWithSubs, ProblemTypeResponse

router = APIRouter(prefix="/api/v1/categories", tags=["Categorias"])


@router.get("/", response_model=list[CategoryWithSubs])
def list_categories(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista todas as categorias com suas subcategorias e problem_types."""
    categories = db.query(Category).filter(Category.is_active == True).order_by(Category.name).all()  # noqa: E712
    result = []
    for cat in categories:
        subs = []
        for s in cat.subcategories:
            if s.is_active:
                pts = [ProblemTypeResponse.model_validate(pt) for pt in s.problem_types if pt.is_active]
                sub_resp = SubcategoryResponse.model_validate(s)
                sub_resp.problem_types = pts
                subs.append(sub_resp)
                
        cat_pts = [ProblemTypeResponse.model_validate(pt) for pt in cat.problem_types if pt.is_active]
        result.append(CategoryWithSubs(
            id=cat.id,
            name=cat.name,
            description=cat.description,
            subcategories=subs,
            problem_types=cat_pts,
        ))
    return result


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    name: str,
    description: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Cria uma nova categoria."""
    cat = Category(name=name, description=description)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.post("/{category_id}/subcategories", response_model=SubcategoryResponse, status_code=status.HTTP_201_CREATED)
def create_subcategory(
    category_id: int,
    name: str,
    description: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Cria uma subcategoria dentro de uma categoria."""
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    sub = Subcategory(name=name, description=description, category_id=category_id)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.post("/{category_id}/subcategories/{subcategory_id}/problems", response_model=ProblemTypeResponse, status_code=status.HTTP_201_CREATED)
def create_problem_type_sub(
    subcategory_id: int,
    name: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Cria um problema predefinido dentro de uma subcategoria."""
    sub = db.query(Subcategory).filter(Subcategory.id == subcategory_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subcategoria não encontrada")

    pt = ProblemType(name=name, subcategory_id=subcategory_id)
    db.add(pt)
    db.commit()
    db.refresh(pt)
    return pt


@router.post("/{category_id}/problems", response_model=ProblemTypeResponse, status_code=status.HTTP_201_CREATED)
def create_problem_type_cat(
    category_id: int,
    name: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Cria um problema predefinido dentro de uma categoria (novo fluxo)."""
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    pt = ProblemType(name=name, category_id=category_id)
    db.add(pt)
    db.commit()
    db.refresh(pt)
    return pt
