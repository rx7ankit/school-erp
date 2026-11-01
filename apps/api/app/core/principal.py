import uuid
from dataclasses import dataclass, field

from app.models.enums import ClassRole, UserKind
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
    is_admin: bool
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

    def has(self, permission: str) -> bool:
        """Admins pass every permission check."""
        return self.is_staff and (self.is_admin or permission in self.permissions)

    def is_class_teacher_of(self, class_id: uuid.UUID) -> bool:
        return self.is_staff and (
            self.is_admin
            or any(a.class_id == class_id and a.role == ClassRole.class_teacher.value for a in self.assignments)
        )

    def is_assigned_to(self, class_id: uuid.UUID) -> bool:
        return self.is_staff and (self.is_admin or any(a.class_id == class_id for a in self.assignments))

    def role_label(self) -> str:
        if self.is_owner:
            return "Platform owner"
        if self.is_admin:
            return "Admin"
        return "Parent" if self.kind == UserKind.parent.value else "Staff"

    def actor(self, ip: str | None = None, user_agent: str | None = None) -> Actor:
        return Actor(self.user_id, self.name, self.role_label(), self.school_id, ip, user_agent)
