import { BookOpen, CalendarDays, CheckSquare, GraduationCap, Home, Library, MessageSquare, School, UserPlus, Users, Wallet, type LucideIcon } from "lucide-react";
import type { Access } from "@/lib/permissions";

export interface NavItem { href: string; label: string; icon: LucideIcon; access: Access; }

/** One list drives the sidebar for every role. Items the user cannot use are filtered out. */
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, access: "staff" },
  { href: "/classes", label: "Classes", icon: School, access: "staff" },
  { href: "/students", label: "Students", icon: GraduationCap, access: "staff" },
  { href: "/attendance", label: "Attendance", icon: CheckSquare, access: "class_teacher" },
  { href: "/results", label: "Results", icon: BookOpen, access: "class_teacher" },
  { href: "/messages", label: "Messages", icon: MessageSquare, access: "assigned_class" },
  { href: "/admissions", label: "Admissions", icon: UserPlus, access: "academic.manage" },
  { href: "/academic", label: "Academic", icon: CalendarDays, access: "academic.manage" },
  { href: "/fees", label: "Fees", icon: Wallet, access: "fees.manage" },
  { href: "/library", label: "Library", icon: Library, access: "library.manage" },
  { href: "/staff", label: "Staff", icon: Users, access: "staff.manage" },
];
