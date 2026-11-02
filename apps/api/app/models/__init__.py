"""Import every model so Alembic and SQLAlchemy see them."""

from app.models import (  # noqa: F401  # noqa: F401,E402  # noqa: F401,E402
    academic,
    attendance,  # noqa: F401,E402
    audit,
    billing,
    certificate,
    enums,
    fees,  # noqa: F401,E402
    file,
    library,
    messaging,
    notification,
    results,  # noqa: F401,E402
    rollover,
    school,
    student,
    timetable,
    user,
)
