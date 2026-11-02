import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, require_staff
from app.core.config import settings
from app.core.errors import AppError, Forbidden, NotFound
from app.core.ids import uuid7
from app.core.principal import Principal
from app.models.file import Attachment
from app.schemas.file import DownloadOut, FileOut, UploadIn, UploadOut
from app.services.storage import PURPOSES, get_storage, make_key

router = APIRouter(prefix="/files", tags=["files"])


async def _mine_or_admin(db: AsyncSession, p: Principal, file_id: uuid.UUID) -> Attachment:
    a = await db.get(Attachment, file_id)
    if a is None:
        raise NotFound("File not found.")
    if a.uploaded_by != p.user_id and not p.is_admin:
        raise Forbidden("You cannot open this file.")
    return a


@router.post("/upload-url", response_model=UploadOut, status_code=201)
async def upload_url(body: UploadIn, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    """Step 1: ask for a link, then PUT the file to it from the app. The size and type are fixed by this request."""
    rule = PURPOSES.get(body.purpose)
    if rule is None:
        raise AppError("Unknown kind of file.", code="invalid_purpose")
    types, max_bytes = rule
    if body.content_type not in types:
        raise AppError("This kind of file is not allowed here.", code="invalid_file_type")
    if body.size_bytes > max_bytes:
        raise AppError(f"The file is too large. The limit is {max_bytes // (1024 * 1024)} MB.", code="file_too_large")
    file_id = uuid7()
    key = make_key(p.school_id, body.purpose, file_id, body.filename)
    db.add(
        Attachment(
            id=file_id,
            school_id=p.school_id,
            purpose=body.purpose,
            filename=body.filename[:200],
            content_type=body.content_type,
            size_bytes=body.size_bytes,
            storage_key=key,
            uploaded_by=p.user_id,
        )
    )
    await db.flush()
    ttl = settings.upload_url_ttl_seconds
    url = await get_storage().upload_url(key, body.content_type, ttl)
    return UploadOut(id=file_id, upload_url=url, headers={"Content-Type": body.content_type}, expires_in=ttl)


@router.post("/{file_id}/complete", response_model=FileOut)
async def complete(file_id: uuid.UUID, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    """Step 2: after the upload, confirm. We check the file is really there and matches what was promised."""
    a = await _mine_or_admin(db, p, file_id)
    if a.status == "ready":
        return a
    obj = await get_storage().head(a.storage_key)
    if obj is None:
        raise AppError("The file was not uploaded. Please try again.", code="upload_missing")
    if obj.size != a.size_bytes:
        await get_storage().delete(a.storage_key)
        raise AppError("The uploaded file does not match. Please try again.", code="upload_mismatch")
    a.status, a.confirmed_at = "ready", datetime.now(UTC)
    await db.flush()
    return a


@router.get("/{file_id}", response_model=FileOut)
async def details(file_id: uuid.UUID, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    return await _mine_or_admin(db, p, file_id)


@router.get("/{file_id}/url", response_model=DownloadOut)
async def download(file_id: uuid.UUID, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    a = await _mine_or_admin(db, p, file_id)
    if a.status != "ready":
        raise NotFound("File not found.")
    ttl = settings.download_url_ttl_seconds
    return DownloadOut(url=await get_storage().download_url(a.storage_key, a.filename, ttl), expires_in=ttl)
