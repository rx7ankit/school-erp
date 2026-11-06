import { ScrollText, BarChart3, BookOpen, CalendarClock, FileCheck2, CalendarDays, CheckSquare, GraduationCap, Home, KeyRound, MessageSquare, Star, School, TrendingUp, Users, Wallet, type LucideIcon } from "lucide-react";
import type { Access } from "@/lib/permissions";

export interface NavItem { href: string; label: string; icon: LucideIcon; access: Access; /** Shown only on the real API. */ liveOnly?: boolean; /** On the real API the server decides what each role may do, so more roles can open the page (read-only where needed). */ liveAccess?: Access[]; }

/** One list drives the sidebar for every role. Items the user cannot use are filtered out. */
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, access: "staff" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, access: "staff" },
  { href: "/classes", label: "Classes", icon: School, access: "staff" },
  { href: "/students", label: "Students", icon: GraduationCap, access: "staff" },
  { href: "/attendance", label: "Attendance", icon: CheckSquare, access: "class_teacher", liveAccess: ["assigned_class"] },
  { href: "/results", label: "Results", icon: BookOpen, access: "class_teacher", liveAccess: ["assigned_class", "academic.manage"] },
  { href: "/timetable", label: "Timetable", icon: CalendarClock, access: "staff" },
  { href: "/leave", label: "Leave", icon: FileCheck2, access: "class_teacher" },
  { href: "/messages", label: "Messages", icon: MessageSquare, access: "assigned_class", liveAccess: ["assigned_class", "academic.manage"] },
  { href: "/parents", label: "Parents", icon: KeyRound, access: "academic.manage" },
  { href: "/promotion", label: "Promotion", icon: TrendingUp, access: "academic.manage" },
  { href: "/feedback", label: "Feedback", icon: Star, access: "academic.manage", liveAccess: ["assigned_class"] },
  { href: "/academic", label: "Academic", icon: CalendarDays, access: "academic.manage" },
  { href: "/fees", label: "Fees", icon: Wallet, access: "fees.manage" },
  { href: "/audit", label: "Audit log", icon: ScrollText, access: "admin" },
  { href: "/staff", label: "Staff", icon: Users, access: "people.manage" },
];
