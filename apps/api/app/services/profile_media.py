"""Photos and logos: a file the person uploaded, shown back as a short-lived link."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, NotFound
from app.core.principal import Principal
from app.models.file import Attachment
from app.services.storage import get_storage

LINK_TTL_SECONDS = 6 * 60 * 60


async def file_url(db: AsyncSession, file_id: uuid.UUID | None) -> str | None:
    if file_id is None:
        return None
    a = await db.get(Attachment, file_id)
    if a is None or a.status != "ready":
        return None
    return await get_storage().download_url(a.storage_key, a.filename, LINK_TTL_SECONDS)


async def ready_file(db: AsyncSession, p: Principal, file_id: uuid.UUID, purpose: str) -> Attachment:
    """The file must be this person's own, of the right kind, and confirmed."""
    a = await db.get(Attachment, file_id)
    if a is None or a.uploaded_by != p.user_id:
        raise NotFound("File not found.")
    if a.purpose != purpose or a.status != "ready":
        raise AppError(
            f"Upload the picture first (purpose {purpose}) and confirm it.", code="invalid_photo", status=422
        )
    return a
