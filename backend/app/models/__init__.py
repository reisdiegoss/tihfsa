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
from app.models.network_map import NetworkMap
from app.models.floor import Floor
from app.models.sla import SLAConfig, SLACategoryRule
from app.models.monitoring import AgentCheckin
from app.models.system_setting import SystemSetting
from app.models.satisfaction_survey import TicketSatisfactionSurvey
from app.models.qrcode import QRCodeItem, QRCodeConfig

__all__ = [
    "User",
    "Department",
    "Location",
    "Floor",
    "Asset",
    "Ticket",
    "TicketInteraction",
    "TicketAttachment",
    "Category",
    "Subcategory",
    "ProblemType",
    "AssetTypeModel",
    "EvolutionConfig",
    "NetworkMap",
    "QRCodeItem",
    "QRCodeConfig",
    "SLAConfig",
    "SLACategoryRule",
    "AgentCheckin",
    "SystemSetting",
    "TicketSatisfactionSurvey",
]

