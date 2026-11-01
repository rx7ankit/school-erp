"use client";
import * as React from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportXlsx, type Sheet } from "@/lib/export";
import { logAudit } from "@/lib/audit";

/** One-click Excel download. `build` runs on click so it always exports what is on screen now. */
export function ExportButton({ fileName, build, label = "Export Excel", size = "default", onDone }: {
  fileName: string; build: () => Sheet[]; label?: string; size?: "default" | "sm"; onDone?: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button variant="secondary" size={size} loading={busy} onClick={async () => {
      setBusy(true);
      try { const sheets = build(); await exportXlsx(fileName, sheets); logAudit({ category: "exports", action: "export.created", summary: `Exported ${fileName.replace(/-/g, " ")} to Excel (${sheets.reduce((a, s) => a + s.rows.length, 0)} rows)`, entity: `${fileName}.xlsx` }); toast.success("Excel file downloaded"); onDone?.(); }
      catch { toast.error("Could not create the file. Try again."); }
      finally { setBusy(false); }
    }}>{!busy && <Download />}{label}</Button>
  );
}
