from fastapi import APIRouter

from app.api.v1 import academic, audit, auth, files, health, owner, staff

api_router = APIRouter(prefix="/api/v1")
for r in (health.router, auth.router, owner.router, staff.router, academic.router, audit.router, files.router):
    api_router.include_router(r)
