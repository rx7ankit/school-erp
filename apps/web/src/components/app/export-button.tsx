"use client";
import * as React from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportXlsx, type Sheet } from "@/lib/export";

/** One-click Excel download. `build` runs on click so it always exports what is on screen now. */
export function ExportButton({ fileName, build, label = "Export Excel", size = "default" }: {
  fileName: string; build: () => Sheet[]; label?: string; size?: "default" | "sm";
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button variant="secondary" size={size} loading={busy} onClick={async () => {
      setBusy(true);
      try { await exportXlsx(fileName, build()); toast.success("Excel file downloaded"); }
      catch { toast.error("Could not create the file. Try again."); }
      finally { setBusy(false); }
    }}>{!busy && <Download />}{label}</Button>
  );
}
