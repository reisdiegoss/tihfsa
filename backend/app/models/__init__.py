"""Models package - importa todos os models para registro no Base.metadata."""
from app.models.user import User
from app.models.department import Department
from app.models.asset import Asset
from app.models.ticket import Ticket
from app.models.ticket_interaction import TicketInteraction
from app.models.category import Category, Subcategory

__all__ = [
    "User",
    "Department",
    "Asset",
    "Ticket",
    "TicketInteraction",
    "Category",
    "Subcategory",
]
