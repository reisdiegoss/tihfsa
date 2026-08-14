"""
Schemas Pydantic para AssetTypeModel (Tipos de Equipamento dinâmicos com campos personalizados).
"""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CustomFieldDefinition(BaseModel):
    name: str = Field(..., description="Rótulo do campo (ex: 'Memória RAM', 'Frequência Wi-Fi')")
    key: str = Field(..., description="Chave identificadora única (ex: 'ram', 'wifi_freq')")
    field_type: str = Field("text", description="text, number, select, boolean")
    options: list[str] | None = Field(default_factory=list, description="Opções para campo select")
    required: bool = False


class AssetTypeBase(BaseModel):
    name: str
    icon: str = "Server"
    description: str | None = None
    custom_fields: list[CustomFieldDefinition] = Field(default_factory=list)


class AssetTypeCreate(AssetTypeBase):
    pass


class AssetTypeUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    description: str | None = None
    custom_fields: list[CustomFieldDefinition] | None = None
    is_active: bool | None = None


class AssetTypeResponse(AssetTypeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
