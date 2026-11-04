from fastapi import APIRouter

from app.api.v1 import academic, audit, auth, files, health, owner, parent_app, parents, staff, students

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
    parents.router,
    parent_app.router,
):
    api_router.include_router(r)

from app.api.v1 import certificates as _certificates  # noqa: E402
from app.api.v1 import timetable as _timetable  # noqa: E402

api_router.include_router(_timetable.router)
api_router.include_router(_certificates.router)

from app.api.v1 import attendance as _attendance  # noqa: E402
from app.api.v1 import leave as _leave  # noqa: E402
from app.api.v1 import parent_attendance as _parent_attendance  # noqa: E402

for _r in (_attendance.router, _leave.router, _parent_attendance.router):
    api_router.include_router(_r)

# Results, exam date sheet and teacher feedback
from app.api.v1 import datesheet as _datesheet  # noqa: E402
from app.api.v1 import feedback as _feedback  # noqa: E402
from app.api.v1 import results as _results  # noqa: E402

for _r in (
    _results.router,
    _results.parent_router,
    _datesheet.router,
    _datesheet.parent_router,
    _feedback.router,
    _feedback.parent_router,
):
    api_router.include_router(_r)

from app.api.v1 import messaging as _messaging  # noqa: E402
from app.api.v1 import notifications as _notifications  # noqa: E402
from app.api.v1 import parent_messaging as _parent_messaging  # noqa: E402

for _r in (_messaging.router, _parent_messaging.router, _notifications.staff_router, _notifications.parent_router):
    api_router.include_router(_r)

# Fees
from app.api.v1 import fees as _fees  # noqa: E402
from app.api.v1 import fees_parent as _fees_parent  # noqa: E402

for _r in (_fees.router, _fees_parent.router):
    api_router.include_router(_r)

# Year-end rollover, platform billing, analytics
from app.api.v1 import analytics as _analytics  # noqa: E402
from app.api.v1 import owner_billing as _owner_billing  # noqa: E402
from app.api.v1 import rollover as _rollover  # noqa: E402
from app.api.v1 import school_billing as _school_billing  # noqa: E402

for _r in (_rollover.router, _owner_billing.router, _school_billing.router, _analytics.router):
    api_router.include_router(_r)

# Library
from app.api.v1 import library as _library  # noqa: E402

api_router.include_router(_library.router)
