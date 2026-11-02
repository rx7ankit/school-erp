import type { components } from "./schema";

/** Response and request shapes, generated from the API (run `pnpm gen:api` after the API changes). */
type S = components["schemas"];
export type Me = S["MeOut"];
export type StaffOut = S["StaffOut"];
export type StaffCreate = S["StaffCreate"];
export type StaffPatch = S["StaffPatch"];
export type SchoolOut = S["SchoolOut"];
export type SchoolCreate = S["SchoolCreate"];
export type OwnerStats = S["OwnerStats"];
export type YearOut = S["YearOut"];
export type ClassOut = S["ClassOut"];
export type SubjectOut = S["SubjectOut"];
export type AssignmentRow = S["AssignmentRow"];
export type AuditOut = S["AuditOut"];
export type Permission = "fees.manage" | "library.manage" | "staff.manage" | "academic.manage";
export interface Page<T> { items: T[]; total: number; }
