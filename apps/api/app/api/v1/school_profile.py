"""The school's own look: its logo. Admin only; everyone in the school sees it through /auth/me."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, require_admin
from app.core.errors import NotFound
from app.core.principal import Principal
from app.models.school import School
from app.schemas.auth import PhotoOut, PhotoSetIn
from app.services.profile_media import file_url, ready_file

router = APIRouter(prefix="/school", tags=["school"])


@router.put("/logo", response_model=PhotoOut)
async def set_logo(body: PhotoSetIn, p: Principal = Depends(require_admin), db: AsyncSession = Depends(db_session)):
    """Upload the picture at `/files/upload-url` with purpose `school_logo`, confirm it, then send the file id here.
    A null file id removes the logo."""
    school = await db.get(School, p.school_id)
    if school is None:
        raise NotFound("School not found.")
    school.logo_file_id = None if body.file_id is None else (await ready_file(db, p, body.file_id, "school_logo")).id
    await db.flush()
    return PhotoOut(url=await file_url(db, school.logo_file_id))
