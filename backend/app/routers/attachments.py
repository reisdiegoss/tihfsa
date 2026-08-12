"""
Router Attachments — upload de imagens e PDFs para chamados.
"""
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.ticket import Ticket
from app.models.ticket_attachment import TicketAttachment
from app.schemas.ticket import TicketAttachmentResponse

router = APIRouter(prefix="/api/v1/tickets", tags=["Anexos"])

UPLOAD_DIR = "uploads"
ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]


@router.post("/{ticket_id}/attachments", response_model=TicketAttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Faz upload de um anexo (imagem ou PDF) para o chamado.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Formato de arquivo não suportado. Use JPG, PNG ou PDF.")

    # Criar pasta específica para o ticket se não existir
    ticket_upload_dir = os.path.join(UPLOAD_DIR, "tickets", str(ticket_id))
    os.makedirs(ticket_upload_dir, exist_ok=True)

    # Gerar nome único para o arquivo
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(ticket_upload_dir, unique_filename)

    # Salvar o arquivo
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar arquivo: {e}")

    # Converter para caminho relativo web-friendly
    web_path = f"/uploads/tickets/{ticket_id}/{unique_filename}"

    # Registrar no banco
    attachment = TicketAttachment(
        ticket_id=ticket_id,
        file_name=file.filename or "Anexo",
        file_path=web_path,
        content_type=file.content_type,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return attachment
