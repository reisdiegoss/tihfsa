"""
Model ProblemType — problemas predefinidos para uma subcategoria.
"""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class ProblemType(Base):
    __tablename__ = "problem_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    subcategory_id = Column(Integer, ForeignKey("subcategories.id"), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)

    subcategory = relationship("Subcategory", back_populates="problem_types")
    category = relationship("Category", back_populates="problem_types")
    tickets = relationship("Ticket", back_populates="problem_type")

    def __repr__(self):
        return f"<ProblemType {self.id}: {self.name}>"
