"use client";
import * as React from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useClasses } from "@/lib/api/hooks/academic";
import { errorText } from "@/lib/api/hooks/staff";
import { classLabel } from "@/components/app/academic-live-ui";

/** Download button for the API's Excel files: asks the API (with the Bearer token), saves the file, shows a spinner meanwhile. */
export function DownloadButton({ run, label = "Export Excel", size = "default", variant = "secondary" }: {
  run: () => Promise<string>; label?: string; size?: "default" | "sm"; variant?: "secondary" | "ghost";
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button variant={variant} size={size} loading={busy} onClick={async () => {
      setBusy(true);
      try { const name = await run(); toast.success("Excel file downloaded", { description: name }); }
      catch (e) { toast.error("Could not download the file", { description: errorText(e) }); }
      finally { setBusy(false); }
    }}>{!busy && <Download />}{label}</Button>
  );
}

/** Classes of the current year as a select. `all` adds an "All classes" first option. */
export function ClassSelect({ value, onChange, all, id, name, placeholder, className, "aria-label": aria }: {
  value: string; onChange: (v: string) => void; all?: string; id?: string; name?: string; placeholder?: string; className?: string; "aria-label"?: string;
}) {
  const classes = useClasses();
  return (
    <NativeSelect id={id} name={name} aria-label={aria} className={className} value={value} onChange={(e) => onChange(e.target.value)} disabled={classes.isPending}>
      {all && <option value="">{all}</option>}
      {!all && <option value="" disabled>{placeholder ?? "Choose a class"}</option>}
      {(classes.data?.items ?? []).map((c) => <option key={c.id} value={c.id}>Class {classLabel(c)}</option>)}
    </NativeSelect>
  );
}

export function Problem({ text }: { text: string | null | undefined }) {
  return text ? <p role="alert" className="text-sm text-danger">{text}</p> : null;
}

/** Short date in IST for an API date (plain YYYY-MM-DD). */
export const dash = (v: string | null | undefined) => v || "—";
