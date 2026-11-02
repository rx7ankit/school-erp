"use client";
import * as React from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/api/download";
import { errorText } from "@/lib/api/hooks/staff";

/** One readable line for a failed call (the API's message and its field messages). */
export function Problem({ error }: { error: unknown }) {
  return error ? <p role="alert" className="text-sm text-danger">{typeof error === "string" ? error : errorText(error)}</p> : null;
}

/** Value that follows `value` after the person stops typing. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Downloads an Excel file from the API (needs the Bearer token, so it is fetched, not linked). */
export function ExcelButton({ path, params, fallbackName, label = "Export Excel", size = "default", disabled }: {
  path: string; params?: Record<string, string | number | boolean | undefined | null>; fallbackName: string; label?: string; size?: "default" | "sm"; disabled?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button variant="secondary" size={size} loading={busy} disabled={disabled} onClick={async () => {
      setBusy(true);
      try { const name = await downloadFile(path, params, fallbackName); toast.success("Excel file downloaded", { description: name }); }
      catch (e) { toast.error("Could not download the file", { description: errorText(e) }); }
      finally { setBusy(false); }
    }}>{!busy && <Download />}{label}</Button>
  );
}

/** Page number that goes back to the first page whenever the filters (`key`) change, without an effect. */
export function useKeyedPage(key: string) {
  const [s, set] = React.useState({ key, page: 0 });
  const page = s.key === key ? s.page : 0;
  const setPage: React.Dispatch<React.SetStateAction<number>> = (v) => set({ key, page: typeof v === "function" ? v(page) : v });
  return [page, setPage] as const;
}

/** First day of the month of an IST date. */
export const monthStartOf = (today: string) => `${today.slice(0, 8)}01`;

/** Calendar date plus n days, as "YYYY-MM-DD" (UTC maths on plain dates is safe). */
export function addDays(on: string, n: number): string {
  const d = new Date(`${on}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
