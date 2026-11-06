import uuid
from dataclasses import dataclass, field

from app.models.enums import ALL_PERMISSIONS, ClassRole, UserKind
from app.services.audit import Actor


@dataclass(frozen=True)
class ClassAssignment:
    class_id: uuid.UUID
    role: str
    subject_id: uuid.UUID | None


@dataclass
class Principal:
    """Who is calling. Loaded fresh on every request, so a permission change takes effect at once."""

    user_id: uuid.UUID
    session_id: uuid.UUID
    kind: str
    school_id: uuid.UUID | None
    name: str
    email: str
    must_change_password: bool
    permissions: set[str] = field(default_factory=set)
    assignments: list[ClassAssignment] = field(default_factory=list)
    school_status: str | None = None

    @property
    def is_owner(self) -> bool:
        return self.kind == UserKind.owner.value

    @property
    def is_staff(self) -> bool:
        return self.kind == UserKind.staff.value

    @property
    def full_access(self) -> bool:
        """All three permissions. This replaces the old admin flag: there is no separate admin."""
        return self.is_staff and set(ALL_PERMISSIONS) <= self.permissions

    @property
    def is_admin(self) -> bool:
        """Kept for code and app builds that still say "admin": full access (or the platform owner)."""
        return self.is_owner or self.full_access

    def has(self, permission: str) -> bool:
        return self.is_staff and permission in self.permissions

    def is_class_teacher_of(self, class_id: uuid.UUID) -> bool:
        return self.is_staff and (
            self.full_access
            or any(a.class_id == class_id and a.role == ClassRole.class_teacher.value for a in self.assignments)
        )

    def is_assigned_to(self, class_id: uuid.UUID) -> bool:
        return self.is_staff and (self.full_access or any(a.class_id == class_id for a in self.assignments))

    def role_label(self) -> str:
        if self.is_owner:
            return "Platform owner"
        if self.full_access:
            return "Admin"
        return "Parent" if self.kind == UserKind.parent.value else "Staff"

    def actor(self, ip: str | None = None, user_agent: str | None = None) -> Actor:
        return Actor(self.user_id, self.name, self.role_label(), self.school_id, ip, user_agent)
