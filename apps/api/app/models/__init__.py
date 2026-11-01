"""Import every model so Alembic and SQLAlchemy see them."""

from app.models import academic, audit, enums, school, student, user  # noqa: F401
