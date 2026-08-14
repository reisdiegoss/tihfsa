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
            zabbix_group_id=cat.zabbix_group_id,
            zabbix_group_name=cat.zabbix_group_name,
            is_global=cat.is_global,
            subcategories=subs,
            problem_types=cat_pts,
        ))
    return result


@router.post("/zabbix-sync")
def sync_zabbix_host_groups(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Sincroniza os Host Groups do Zabbix criando ou vinculando Categorias no TIHFSA."""
    from app.services.zabbix_service import ZabbixService

    zabbix_groups = ZabbixService.get_host_groups()
    if not zabbix_groups:
        return {"status": "warning", "message": "Nenhum grupo de host retornado pelo Zabbix ou falha de conexão", "synced_count": 0}

    synced_count = 0
    for grp in zabbix_groups:
        grp_id = str(grp.get("groupid"))
        grp_name = grp.get("name")
        if not grp_name:
            continue

        # Tenta achar categoria por zabbix_group_id ou nome
        cat = db.query(Category).filter(
            (Category.zabbix_group_id == grp_id) | (Category.name.ilike(grp_name))
        ).first()

        if not cat:
            cat = Category(
                name=grp_name,
                description=f"Grupo de Hosts sincronizado do Zabbix (ID: {grp_id})",
                zabbix_group_id=grp_id,
                zabbix_group_name=grp_name,
            )
            db.add(cat)
            synced_count += 1
        else:
            cat.zabbix_group_id = grp_id
            cat.zabbix_group_name = grp_name
            synced_count += 1

    db.commit()
    return {"status": "success", "message": f"{synced_count} categorias sincronizadas com Grupos do Zabbix!", "synced_count": synced_count}


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    name: str,
    description: str | None = None,
    is_global: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Cria uma nova categoria."""
    cat = Category(name=name, description=description, is_global=is_global)
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


@router.delete("/problems/{problem_id}")
def delete_problem_type(
    problem_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Desativa/remove um tipo de problema de uma categoria."""
    pt = db.query(ProblemType).filter(ProblemType.id == problem_id).first()
    if not pt:
        raise HTTPException(status_code=404, detail="Tipo de problema não encontrado")

    pt.is_active = False
    db.commit()
    return {"status": "deleted", "message": f"Problema '{pt.name}' removido com sucesso."}
