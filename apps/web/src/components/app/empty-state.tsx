import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[20px] bg-card px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-fill text-muted-foreground"><Icon className="size-5" /></div>
      <h3 className="text-[17px] font-bold">{title}</h3>
      {text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action}
    </div>
  );
}
