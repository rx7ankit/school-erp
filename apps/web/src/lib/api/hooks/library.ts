"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { BookDetail, BookIn, BookOut, BookPatch, CopyOut, IssueIn, LibrarySettings, LoanFilter, LoanOut, Page, ReturnIn, StaffOut, StudentListItem } from "../types";

export const PAGE = 25;
const ROOT = ["library"] as const;

export interface BookFilter { q: string; category: string; availableOnly: boolean }
export interface LoanQuery { status: LoanFilter; q: string; student_id?: string; staff_id?: string }

export const useBooks = (f: BookFilter, offset: number) =>
  useQuery({
    queryKey: [...ROOT, "books", f, offset], enabled: isLive, placeholderData: keepPreviousData,
    queryFn: ({ signal }) => api.get<Page<BookOut>>("/library/books", { q: f.q.trim() || undefined, category: f.category || undefined, available_only: f.availableOnly || undefined, limit: PAGE, offset }, signal),
  });
export const useBook = (id: string | null) =>
  useQuery({ queryKey: [...ROOT, "book", id], enabled: isLive && !!id, queryFn: () => api.get<BookDetail>(`/library/books/${id}`) });
export const useLoans = (f: LoanQuery, offset: number) =>
  useQuery({
    queryKey: [...ROOT, "loans", f, offset], enabled: isLive, placeholderData: keepPreviousData,
    queryFn: ({ signal }) => api.get<Page<LoanOut>>("/library/loans", { status: f.status, q: f.q.trim() || undefined, student_id: f.student_id, staff_id: f.staff_id, limit: PAGE, offset }, signal),
  });
export const useLibrarySettings = () => useQuery({ queryKey: [...ROOT, "settings"], enabled: isLive, queryFn: () => api.get<LibrarySettings>("/library/settings") });
/** Looks a copy up by its accession number. Only runs when a number is typed. */
export const useCopyLookup = (accession: string) =>
  useQuery({ queryKey: [...ROOT, "copy", accession], enabled: isLive && accession.trim().length > 0, retry: false, queryFn: () => api.get<CopyOut>("/library/copies/lookup", { accession_no: accession.trim() }) });
/** Borrower search. Needs the student (or staff) list, which the API only gives to staff with the right permission. */
export const useStudentSearch = (q: string) =>
  useQuery({ queryKey: [...ROOT, "students", q], enabled: isLive && q.trim().length >= 2, retry: false, queryFn: () => api.get<Page<StudentListItem>>("/students", { q: q.trim(), limit: 8 }) });
export const useStaffSearch = (q: string) =>
  useQuery({ queryKey: [...ROOT, "staff", q], enabled: isLive && q.trim().length >= 2, retry: false, queryFn: () => api.get<Page<StaffOut>>("/staff", { q: q.trim() }) });

function useLibMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ROOT }), qc.invalidateQueries({ queryKey: ["dashboard"] })]) });
}
export const useAddBook = () => useLibMutation((b: BookIn) => api.post<BookDetail>("/library/books", b));
export const useEditBook = () => useLibMutation((v: { id: string; body: BookPatch }) => api.patch<BookOut>(`/library/books/${v.id}`, v.body));
export const useDeleteBook = () => useLibMutation((id: string) => api.delete(`/library/books/${id}`));
export const useAddCopies = () => useLibMutation((v: { id: string; count: number; accession_no?: string | null }) => api.post<CopyOut[]>(`/library/books/${v.id}/copies`, { count: v.count, accession_no: v.accession_no || null }));
export const useSetCopyStatus = () => useLibMutation((v: { id: string; status: "available" | "lost" | "damaged" }) => api.patch<CopyOut>(`/library/copies/${v.id}`, { status: v.status }));
export const useIssue = () => useLibMutation((b: IssueIn) => api.post<LoanOut>("/library/loans", b));
export const useReturn = () => useLibMutation((v: { id: string; body: ReturnIn }) => api.post<LoanOut>(`/library/loans/${v.id}/return`, v.body));
export const useRenew = () => useLibMutation((id: string) => api.post<LoanOut>(`/library/loans/${id}/renew`));
export const useSaveSettings = () => useLibMutation((b: LibrarySettings) => api.put<LibrarySettings>("/library/settings", b));
