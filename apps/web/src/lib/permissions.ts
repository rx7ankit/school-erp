export type Permission = "academic.manage" | "fees.manage" | "announcements.manage" | "people.manage";
export type ClassRole = "class_teacher" | "subject_teacher";

export const PERMISSION_LABELS: Record<Permission, string> = {
  "academic.manage": "Academic",
  "fees.manage": "Fees",
  "announcements.manage": "Announcements",
  "people.manage": "People & access",
};

export interface StaffUser {
  id: string;
  name: string;
  designation: string;
  isAdmin: boolean;
  permissions: Permission[];
  classes: { classId: string; role: ClassRole; subject?: string }[];
}

/**
 * What a nav item or action needs:
 *  - a Permission key
 *  - "class_teacher": class teacher of at least one class (or of the given class)
 *  - "assigned_class": any teacher assignment (or the given class)
 *  - "staff": any signed-in staff
 */
export type Access = Permission | "class_teacher" | "assigned_class" | "staff" | "admin";

/** Admin bypasses everything. */
export function hasAccess(user: StaffUser | null, access: Access, classId?: string): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  switch (access) {
    case "admin":
      return false; // admins already returned true above; nobody else
    case "staff":
      return true;
    case "class_teacher":
      return user.classes.some((c) => c.role === "class_teacher" && (!classId || c.classId === classId));
    case "assigned_class":
      return user.classes.some((c) => !classId || c.classId === classId);
    default:
      return user.permissions.includes(access);
  }
}

/** Classes the user may act on for a given access level. Admin gets all. */
export function classIdsFor(user: StaffUser, access: "class_teacher" | "assigned_class", all: string[]): string[] {
  if (user.isAdmin) return all;
  return user.classes.filter((c) => access === "assigned_class" || c.role === "class_teacher").map((c) => c.classId);
}
