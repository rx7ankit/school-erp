from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.db.redis import redis
from app.db.session import engine

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Is the process up. Used by the container health check."""
    return {"status": "ok"}


@router.get("/health/ready")
async def ready():
    """Can it reach Postgres and Redis. Used by the uptime monitor."""
    problems: dict[str, str] = {}
    try:
        async with engine.connect() as c:
            await c.execute(text("select 1"))
    except Exception as e:  # noqa: BLE001
        problems["database"] = type(e).__name__
    try:
        await redis.ping()
    except Exception as e:  # noqa: BLE001
        problems["redis"] = type(e).__name__
    if problems:
        return JSONResponse({"status": "degraded", "problems": problems}, status_code=503)
    return {"status": "ok"}
