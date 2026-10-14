"""
Schemas Pydantic para o Módulo de Termos de Retirada e Responsabilidade de Equipamentos.
Hotel Fasano Salvador — TI Corporativa
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


DEFAULT_TERMS_LEGAL_TEXT = (
    "Pelo presente Termo de Responsabilidade e Retirada de Equipamentos, declaro ter recebido do Hotel Fasano Salvador, "
    "a título de empréstimo para uso estritamente corporativo e desempenho de minhas atribuições funcionais, "
    "o(s) equipamento(s) e acessório(s) acima discriminados, em perfeito estado de conservação e funcionamento.\n\n"
    "Comprometo-me a:\n"
    "1. Zelar pela guarda, conservação e integridade do(s) bem(ns), utilizando-o(s) com cautela e estrita observância das normas internas de segurança e TI;\n"
    "2. Comunicar imediatamente à Gerência de TI qualquer defeito, avaria, furto, roubo ou extravio ocorrido com o equipamento;\n"
    "3. Não transferir, emprestar ou ceder a terceiros a posse ou uso do(s) equipamento(s) sob minha responsabilidade;\n"
    "4. Devolver integralmente o(s) equipamento(s) e seus respectivos acessórios ao setor de Tecnologia da Informação quando solicitado, "
    "ou imediatamente por ocasião de transferência de setor, desligamento ou rescisão contratual;\n"
    "5. Reconheço que o equipamento permanece como patrimônio do Hotel Fasano Salvador, respondendo por eventuais danos causados por dolo, "
    "negligência, imprudência ou mau uso comprovado.\n\n"
    "Para fins de validade e fé pública interna, este termo é firmado eletronicamente com aposição de assinatura na tela "
    "e validação biométrica facial registrada em ambiente controlado."
)


# ==========================================================
# ITEM SCHEMAS
# ==========================================================

class EquipmentTermItemBase(BaseModel):
    item_name: str = Field(..., max_length=200, description="Nome ou descrição do equipamento")
    category: Optional[str] = Field("Periférico / Acessório", max_length=100)
    asset_id: Optional[int] = Field(None, description="Vínculo opcional com inventário de ativos")
    asset_tag: Optional[str] = Field(None, max_length=50, description="Etiqueta de Patrimônio")
    serial_number: Optional[str] = Field(None, max_length=100, description="Número de Série")
    quantity: int = Field(1, ge=1)
    condition: str = Field("Em perfeito estado de funcionamento", max_length=100)
    accessories: Optional[str] = Field(None, max_length=255, description="Acessórios inclusos: carregador, cabo, capa...")
    notes: Optional[str] = None


class EquipmentTermItemCreate(EquipmentTermItemBase):
    pass


class EquipmentTermItemUpdate(BaseModel):
    item_name: Optional[str] = None
    category: Optional[str] = None
    asset_id: Optional[int] = None
    asset_tag: Optional[str] = None
    serial_number: Optional[str] = None
    quantity: Optional[int] = None
    condition: Optional[str] = None
    accessories: Optional[str] = None
    is_returned: Optional[bool] = None
    notes: Optional[str] = None


class EquipmentTermItemResponse(EquipmentTermItemBase):
    id: int
    term_id: int
    is_returned: bool

    class Config:
        from_attributes = True


# ==========================================================
# TEMPLATE SCHEMAS (BUILDER ESTILO WORD)
# ==========================================================

class EquipmentTermTemplateBase(BaseModel):
    title: str = Field(..., max_length=200, description="Título do modelo de documento")
    category: str = Field("Geral", max_length=100, description="Categoria do documento (ex: Comunicação, Telefonia, Notebook, Acesso)")
    description: Optional[str] = Field(None, max_length=300)
    content_html: str = Field(..., description="Conteúdo formatado em HTML com tags {{nome_colaborador}}, etc.")
    default_items: Optional[str] = Field(None, description="JSON serializado com itens pré-configurados sugeridos")
    is_active: bool = True


class EquipmentTermTemplateCreate(EquipmentTermTemplateBase):
    pass


class EquipmentTermTemplateUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    content_html: Optional[str] = None
    default_items: Optional[str] = None
    is_active: Optional[bool] = None


class EquipmentTermTemplateResponse(EquipmentTermTemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==========================================================
# TERM SCHEMAS
# ==========================================================

class EquipmentTermBase(BaseModel):
    template_id: Optional[int] = None
    term_type: str = Field("retirada", max_length=50, description="retirada, emprestimo, devolucao")
    beneficiary_type: str = Field("ad_user", max_length=20, description="ad_user ou external_user")
    user_id: Optional[int] = None
    beneficiary_name: str = Field(..., max_length=200)
    beneficiary_document: Optional[str] = Field(None, max_length=50)
    department_id: Optional[int] = None
    department_name: Optional[str] = Field(None, max_length=150)
    beneficiary_email: Optional[str] = Field(None, max_length=150)
    beneficiary_phone: Optional[str] = Field(None, max_length=50)
    has_ad_account: bool = True
    expected_return_date: Optional[datetime] = None
    legal_text: Optional[str] = None
    notes: Optional[str] = None



class EquipmentTermCreate(EquipmentTermBase):
    items: List[EquipmentTermItemCreate] = Field(..., min_length=1)


class EquipmentTermUpdate(BaseModel):
    beneficiary_name: Optional[str] = None
    beneficiary_document: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    beneficiary_email: Optional[str] = None
    beneficiary_phone: Optional[str] = None
    expected_return_date: Optional[datetime] = None
    notes: Optional[str] = None
    legal_text: Optional[str] = None


class EquipmentTermSignRequest(BaseModel):
    signature_data: str = Field(..., description="Assinatura manuscrita em Base64 (data:image/png;base64,...)")
    facial_photo_data: Optional[str] = Field(None, description="Foto da face capturada em Base64 (data:image/jpeg;base64,...)")
    facial_verified: bool = Field(True, description="Indicador se a detecção facial teve sucesso")
    facial_confidence: Optional[float] = Field(None, description="Score de confiança do modelo neural (0 a 1)")
    signer_device: Optional[str] = Field(None, max_length=255)


class EquipmentTermReturnRequest(BaseModel):
    return_condition: Optional[str] = Field("Devolvido em perfeito estado", max_length=100)
    return_notes: Optional[str] = None
    item_ids: Optional[List[int]] = Field(None, description="IDs dos itens a dar baixa, ou None para todos")


class EquipmentTermResponse(BaseModel):
    id: int
    term_number: str
    status: str
    term_type: str
    template_id: Optional[int] = None
    beneficiary_type: str
    user_id: Optional[int] = None

    beneficiary_name: str
    beneficiary_document: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    beneficiary_email: Optional[str] = None
    beneficiary_phone: Optional[str] = None
    has_ad_account: bool
    technician_id: Optional[int] = None
    technician_name: str
    signed_at: Optional[datetime] = None
    signature_url: Optional[str] = None
    facial_photo_url: Optional[str] = None
    facial_verified: bool
    facial_confidence: Optional[float] = None
    signer_ip: Optional[str] = None
    signer_device: Optional[str] = None
    returned_at: Optional[datetime] = None
    return_technician_id: Optional[int] = None
    return_technician_name: Optional[str] = None
    return_condition: Optional[str] = None
    return_notes: Optional[str] = None
    expected_return_date: Optional[datetime] = None
    legal_text: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[EquipmentTermItemResponse] = []

    class Config:
        from_attributes = True


class EquipmentTermStats(BaseModel):
    total: int
    pending_signature: int
    signed: int
    returned: int
    cancelled: int
