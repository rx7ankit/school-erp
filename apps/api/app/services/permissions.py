"""The three permissions and what "full access" means."""

from collections.abc import Iterable

from app.models.enums import ALL_PERMISSIONS, LEGACY_STAFF_PERMISSION, Permission


def is_full_access(permissions: Iterable[str]) -> bool:
    """All three permissions: the old "admin"."""
    return set(ALL_PERMISSIONS) <= set(permissions)


def for_clients(permissions: Iterable[str]) -> list[str]:
    """The permission list sent to apps. App builds from before the change still look for `staff.manage`, so whoever
    holds `academic.manage` also lists it. Remove this once every client has moved to the three permissions."""
    out = set(permissions)
    if Permission.academic.value in out:
        out.add(LEGACY_STAFF_PERMISSION)
    return sorted(out)


def from_clients(values: Iterable[str]) -> set[str]:
    """Permissions sent by a client: the retired `staff.manage` counts as `academic.manage`."""
    return {Permission.academic.value if v == LEGACY_STAFF_PERMISSION else v for v in values}
