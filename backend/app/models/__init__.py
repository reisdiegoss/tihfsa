"""Models package - importa todos os models para registro no Base.metadata."""
from app.models.user import User
from app.models.department import Department
from app.models.location import Location
from app.models.asset import Asset
from app.models.ticket import Ticket
from app.models.ticket_interaction import TicketInteraction
from app.models.ticket_attachment import TicketAttachment
from app.models.category import Category, Subcategory
from app.models.problem_type import ProblemType
from app.models.asset_type import AssetTypeModel
from app.models.integration_config import EvolutionConfig

__all__ = [
    "User",
    "Department",
    "Location",
    "Asset",
    "Ticket",
    "TicketInteraction",
    "TicketAttachment",
    "Category",
    "Subcategory",
    "ProblemType",
    "AssetTypeModel",
    "EvolutionConfig",
]
