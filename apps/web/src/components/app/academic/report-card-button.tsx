"use client";
import * as React from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildReportCardData, downloadReportCard } from "@/lib/report-card";

/** Builds and downloads one report card PDF. Shared by staff and parents. */
export function ReportCardButton({ studentId, examId, label = "Report card", variant = "secondary", size = "sm", disabled }: {
  studentId: string; examId: string; label?: string; variant?: "secondary" | "brand" | "default"; size?: "sm" | "default"; disabled?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button variant={variant} size={size} disabled={disabled} loading={busy} onClick={async () => {
      setBusy(true);
      try {
        await new Promise((r) => setTimeout(r, 400));
        const data = buildReportCardData(studentId, examId);
        if (!data) { toast.error("Report card is not available."); return; }
        downloadReportCard(data); toast.success("Report card downloaded");
      } catch { toast.error("Could not create the report card. Try again."); }
      finally { setBusy(false); }
    }}>{!busy && <FileDown />}{label}</Button>
  );
}
