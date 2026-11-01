"""Audit trail. Call log_audit() inside the same transaction as the change it describes."""

import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.enums import AuditCategory


@dataclass
class Actor:
    id: uuid.UUID | None
    name: str
    role: str
    school_id: uuid.UUID | None
    ip: str | None = None
    user_agent: str | None = None


def change(field: str, before: object, after: object) -> dict:
    return {"field": field, "from": "" if before is None else str(before), "to": "" if after is None else str(after)}


def log_audit(
    db: AsyncSession,
    actor: Actor,
    category: AuditCategory,
    action: str,
    summary: str,
    *,
    entity_type: str | None = None,
    entity_id: object | None = None,
    entity_label: str | None = None,
    changes: list[dict] | None = None,
    sensitive: bool = False,
    school_id: uuid.UUID | None = None,
) -> None:
    db.add(
        AuditLog(
            school_id=school_id if school_id is not None else actor.school_id,
            actor_id=actor.id,
            actor_name=actor.name,
            actor_role=actor.role,
            category=category.value,
            action=action,
            summary=summary,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            entity_label=entity_label,
            changes=changes or None,
            sensitive=sensitive,
            ip=actor.ip,
            user_agent=actor.user_agent,
        )
    )
