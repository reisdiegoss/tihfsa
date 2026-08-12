"""
Model Department — setores do hotel importados do AD.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.database import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    ad_ou_dn = Column(String(300), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # FK — Gestor do departamento
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    dept_manager = relationship("User", foreign_keys=[manager_id])
    members = relationship("User", back_populates="department", foreign_keys="User.department_id")

    def __repr__(self):
        return f"<Department {self.id}: {self.name}>"
