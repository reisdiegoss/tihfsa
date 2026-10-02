"""
Router Departments — CRUD completo de departamentos/setores do hotel.
Permite criação manual, edição, contagem de colaboradores e exclusão segura.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from pydantic import BaseModel, ConfigDict

from app.database import get_db
from app.auth.dependencies import get_current_user, require_technician
from app.models.user import User
from app.models.department import Department


class DepartmentBase(BaseModel):
    name: str


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(DepartmentBase):
    pass


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    ad_ou_dn: str | None = None
    is_active: bool
    users_count: int = 0


router = APIRouter(prefix="/api/v1/departments", tags=["Departamentos"])


@router.get("/", response_model=list[DepartmentResponse])
def list_departments(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista todos os departamentos ativos com a contagem de usuários vinculados."""
    depts = db.query(Department).filter(Department.is_active == True).order_by(Department.name).all()
    res = []
    for d in depts:
        count = db.query(User).filter(User.department_id == d.id, User.is_active == True).count()
        res.append(DepartmentResponse(
            id=d.id,
            name=d.name,
            ad_ou_dn=d.ad_ou_dn,
            is_active=d.is_active,
            users_count=count,
        ))
    return res


@router.post("/", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    data: DepartmentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Cria um novo setor/departamento manualmente."""
    name_clean = data.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="O nome do setor não pode ser vazio.")

    existing = db.query(Department).filter(func.lower(Department.name) == name_clean.lower()).first()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            db.commit()
            count = db.query(User).filter(User.department_id == existing.id, User.is_active == True).count()
            return DepartmentResponse(id=existing.id, name=existing.name, ad_ou_dn=existing.ad_ou_dn, is_active=True, users_count=count)
        raise HTTPException(status_code=400, detail=f"Já existe um setor chamado '{name_clean}'.")

    dept = Department(name=name_clean, is_active=True)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return DepartmentResponse(id=dept.id, name=dept.name, ad_ou_dn=dept.ad_ou_dn, is_active=True, users_count=0)


@router.put("/{dept_id}", response_model=DepartmentResponse)
def update_department(
    dept_id: int,
    data: DepartmentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Edita o nome de um setor/departamento."""
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Setor não encontrado.")

    name_clean = data.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="O nome do setor não pode ser vazio.")

    # Verifica se já existe outro com o mesmo nome
    conflict = db.query(Department).filter(
        func.lower(Department.name) == name_clean.lower(),
        Department.id != dept_id
    ).first()
    if conflict:
        raise HTTPException(status_code=400, detail=f"Já existe outro setor chamado '{name_clean}'.")

    dept.name = name_clean
    dept.is_active = True
    db.commit()
    db.refresh(dept)
    count = db.query(User).filter(User.department_id == dept.id, User.is_active == True).count()
    return DepartmentResponse(id=dept.id, name=dept.name, ad_ou_dn=dept.ad_ou_dn, is_active=dept.is_active, users_count=count)


@router.delete("/{dept_id}")
def delete_department(
    dept_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_technician),
):
    """Exclui com segurança um setor, desvinculando colaboradores e gerentes sem quebrar integridade referencial."""
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Setor não encontrado.")

    # 1. Desvincular membros do departamento
    db.query(User).filter(User.department_id == dept_id).update({User.department_id: None})

    # 2. Desvincular gestores associados na tabela associativa
    try:
        db.execute(text("DELETE FROM department_managers WHERE department_id = :d_id"), {"d_id": dept_id})
    except Exception:
        pass

    dept_name = dept.name
    db.delete(dept)
    db.commit()
    return {"message": f"Setor '{dept_name}' excluído com sucesso."}

