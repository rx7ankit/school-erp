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

/* messaging, notifications, files */
export type BroadcastOut = S["BroadcastOut"];
export type BroadcastIn = S["BroadcastIn"];
export type ThreadOut = S["ThreadOut"];
export type MessageOut = S["MessageOut"];
export type AttachmentRef = S["AttachmentRef"];
export type NotificationOut = S["NotificationOut"];
export type InboxOut = S["InboxOut"];
export type StudentListItem = S["StudentListItem"];
export type FileOut = S["FileOut"];
export type UploadOut = S["UploadOut"];
export type DownloadOut = S["DownloadOut"];

/* owner billing, school billing, dashboard */
export type SchoolPatch = S["SchoolPatch"];
export type PlatformInvoiceOut = S["PlatformInvoiceOut"];
export type RevenueStats = S["RevenueStats"];
export type GenerateOut = S["GenerateOut"];
export type MarkPaidIn = S["MarkPaidIn"];
export type SchoolBilling = S["SchoolBilling"];
export type Dashboard = S["Dashboard"];
