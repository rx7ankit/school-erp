"""The five permissions, what "full access" means, and the presets a school can tick in one tap."""

from collections.abc import Iterable

from app.models.enums import ALL_PERMISSIONS, LEGACY_STAFF_PERMISSION, Permission


def is_full_access(permissions: Iterable[str]) -> bool:
    """All five permissions: the old "admin"."""
    return set(ALL_PERMISSIONS) <= set(permissions)


def for_clients(permissions: Iterable[str]) -> list[str]:
    """The permission list sent to apps. App builds from before the change still look for `staff.manage`, so whoever
    holds `people.manage` also lists it. Remove this once every client uses the four permissions."""
    out = set(permissions)
    if Permission.people.value in out:
        out.add(LEGACY_STAFF_PERMISSION)
    return sorted(out)


def from_clients(values: Iterable[str]) -> set[str]:
    """Permissions sent by a client: the retired `staff.manage` counts as `people.manage`."""
    return {Permission.people.value if v == LEGACY_STAFF_PERMISSION else v for v in values}


# What each permission means, in words the apps can show next to a tick box.
DESCRIPTIONS: dict[str, tuple[str, str]] = {
    Permission.academic.value: ("Academic", "Classes, students, timetable, results and certificates."),
    Permission.fees.value: ("Fees", "Fee setup, invoices, payments and dues."),
    Permission.library.value: ("Library", "Books, issuing and returning, fines."),
    Permission.announcements.value: (
        "Announcements",
        "Write notices and circulars to the whole school or any class.",
    ),
    Permission.people.value: ("People & access", "Staff accounts and logins, permissions, and teacher assignments."),
}

# One-tap starting points. They only tick boxes; the person can still be adjusted afterwards.
PRESETS: list[tuple[str, str, str, tuple[str, ...]]] = [
    ("full", "Full access", "Everything, including who can do what.", tuple(ALL_PERMISSIONS)),
    (
        "academic_head",
        "Academic head",
        "Runs classes, teachers and notices.",
        (Permission.academic.value, Permission.announcements.value, Permission.people.value),
    ),
    ("front_office", "Front office", "Sends notices and circulars.", (Permission.announcements.value,)),
    ("accountant", "Accountant", "Fees only.", (Permission.fees.value,)),
    ("librarian", "Librarian", "Library only.", (Permission.library.value,)),
    ("teacher", "Teacher", "No extra access: sees their own classes.", ()),
]
