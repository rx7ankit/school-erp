import { Card } from "@/components/ui/card";

export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-1.5 p-5">
      <span className="text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">{label}</span>
      <span className="text-[30px] font-bold leading-[1.1] tracking-[-0.03em] tabular-nums">{value}</span>
      {hint && <span className="text-[13px] text-muted-foreground">{hint}</span>}
    </Card>
  );
}
