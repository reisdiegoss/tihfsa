"""
Model Department — setores do hotel importados do AD.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, Table
from sqlalchemy.orm import relationship

from app.database import Base

# Association Table — Múltiplos Gerentes por Setor e Múltiplos Setores por Gerente
department_managers = Table(
    "department_managers",
    Base.metadata,
    Column("department_id", Integer, ForeignKey("departments.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    ad_ou_dn = Column(String(300), nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # FK — Gestor principal legada (opcional)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    dept_manager = relationship("User", foreign_keys=[manager_id])
    managers = relationship("User", secondary=department_managers, back_populates="managed_departments")
    members = relationship("User", back_populates="department", foreign_keys="User.department_id")

    def __repr__(self):
        return f"<Department {self.id}: {self.name}>"
