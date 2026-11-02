"use client";
import * as React from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTr } from "@/lib/lang-context";
import { buildReportCardData, downloadReportCard } from "@/lib/report-card";

/** Builds and downloads one report card PDF. Shared by staff and parents. */
export function ReportCardButton({ studentId, examId, label, variant = "secondary", size = "sm", disabled }: {
  studentId: string; examId: string; label?: string; variant?: "secondary" | "brand" | "default"; size?: "sm" | "default"; disabled?: boolean;
}) {
  const tr = useTr();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button variant={variant} size={size} disabled={disabled} loading={busy} onClick={async () => {
      setBusy(true);
      try {
        await new Promise((r) => setTimeout(r, 400));
        const data = buildReportCardData(studentId, examId);
        if (!data) { toast.error(tr("rc.unavailable", "Report card is not available.")); return; }
        downloadReportCard(data); toast.success(tr("rc.done", "Report card downloaded"));
      } catch { toast.error(tr("rc.fail", "Could not create the report card. Try again.")); }
      finally { setBusy(false); }
    }}>{!busy && <FileDown />}{label ?? tr("rc.default", "Report card")}</Button>
  );
}
