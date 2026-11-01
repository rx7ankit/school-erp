import uuid
from datetime import datetime

from app.schemas.common import ORM


class AuditOut(ORM):
    id: uuid.UUID
    at: datetime
    actor_id: uuid.UUID | None
    actor_name: str
    actor_role: str
    category: str
    action: str
    summary: str
    entity_type: str | None
    entity_id: str | None
    entity_label: str | None
    changes: list | None
    sensitive: bool
