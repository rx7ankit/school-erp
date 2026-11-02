"""Import every model so Alembic and SQLAlchemy see them."""

from app.models import (  # noqa: F401  # noqa: F401,E402  # noqa: F401,E402
    academic,
    attendance,  # noqa: F401,E402
    audit,
    certificate,
    enums,
    fees,  # noqa: F401,E402
    file,
    messaging,
    notification,
    results,  # noqa: F401,E402
    school,
    student,
    timetable,
    user,
)
