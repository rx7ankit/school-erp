from fastapi import APIRouter

from app.api.v1 import academic, admissions, audit, auth, files, health, owner, parent_app, parents, staff, students

api_router = APIRouter(prefix="/api/v1")
for r in (
    health.router,
    auth.router,
    owner.router,
    staff.router,
    academic.router,
    audit.router,
    files.router,
    students.router,
    admissions.router,
    parents.router,
    parent_app.router,
):
    api_router.include_router(r)
