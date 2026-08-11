"""
Models Category e Subcategory — categorização de chamados.

Categorias pré-definidas: Hardware, Software, Rede, Telefonia, TV/Entretenimento, Infraestrutura.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(300), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    subcategories = relationship("Subcategory", back_populates="category", order_by="Subcategory.name")

    def __repr__(self):
        return f"<Category {self.id}: {self.name}>"


class Subcategory(Base):
    __tablename__ = "subcategories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(300), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)

    category = relationship("Category", back_populates="subcategories")

    def __repr__(self):
        return f"<Subcategory {self.id}: {self.name}>"
