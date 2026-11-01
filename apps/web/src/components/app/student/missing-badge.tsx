import { Badge } from "@/components/ui/badge";

/** Shows what key details are still empty. Renders nothing visible-bad when the record is complete. */
export function MissingBadge({ missing }: { missing: string[] }) {
  if (missing.length === 0) return <span className="text-xs text-text-tertiary">Complete</span>;
  return (
    <Badge tone="warning" title={`Missing: ${missing.join(", ")}`}>
      {missing[0]} missing{missing.length > 1 ? ` +${missing.length - 1}` : ""}
    </Badge>
  );
}
