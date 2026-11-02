"use client";
import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StarInput } from "@/components/app/charts";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useChild } from "@/components/parent-child";
import { Loaded, ReadOnlyNote, useErrText } from "@/components/parent/live-ui";
import { useParentFeedback, useRateTeacher, type ParentFeedback } from "@/lib/api/hooks/parent";
import { useData, useFmt } from "@/lib/lang-context";
import { useT } from "@/lib/parent-i18n";

type Draft = Record<string, { rating: number; comment: string }>;

function Request({ req, readOnly }: { req: ParentFeedback; readOnly: boolean }) {
  const t = useT(), d = useData(), f = useFmt(), err = useErrText();
  const rate = useRateTeacher();
  const [draft, setDraft] = React.useState<Draft>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const pending = req.targets.filter((x) => x.my_rating == null);
  const answered = pending.length === 0;
  const set = (id: string, p: Partial<{ rating: number; comment: string }>) => setDraft((x) => ({ ...x, [id]: { ...(x[id] ?? { rating: 0, comment: "" }), ...p } }));
  const rated = pending.filter((x) => (draft[x.target_id]?.rating ?? 0) > 0);

  async function send() {
    setBusy(true); setError(null);
    let failed = 0;
    for (const x of rated) {
      try { await rate.mutateAsync({ target_id: x.target_id, student_id: req.student_id, rating: draft[x.target_id].rating, comment: draft[x.target_id].comment }); }
      catch (e) { failed++; setError(err(e)); }
    }
    setBusy(false);
    if (!failed) toast.success(t("fb.toast"));
  }

  return (
    <Card className="flex flex-col gap-5">
      <CardHeader className="mb-0"><div><CardTitle>{d(req.title)}</CardTitle><CardDescription>{t("fb.closes", { date: f.on(req.closes_on) })}</CardDescription></div>
        {answered && <Badge tone="success">{t("fb.sent")}</Badge>}</CardHeader>
      <ul className="flex flex-col gap-5">
        {req.targets.map((tg) => {
          const done = tg.my_rating != null;
          const dr = draft[tg.target_id] ?? { rating: 0, comment: "" };
          return (
            <li key={tg.target_id} className="flex flex-col gap-3 border-t border-border pt-5 first:border-t-0 first:pt-0">
              <div className="flex items-center gap-3"><Avatar name={tg.teacher} /><div><p className="font-medium">{tg.teacher}</p><p className="text-xs text-text-tertiary">{tg.subject ? d(tg.subject) : t("fb.classTeacher")}</p></div></div>
              {done ? (
                <div className="flex flex-col gap-1.5">
                  <StarInput label={t("fb.rating", { name: tg.teacher })} value={tg.my_rating!} onChange={() => {}} disabled />
                  {tg.my_comment && <p className="rounded-xl bg-fill px-3 py-2 text-sm">{tg.my_comment}</p>}
                </div>
              ) : (<>
                <StarInput label={t("fb.rating", { name: tg.teacher })} value={dr.rating} onChange={(v) => set(tg.target_id, { rating: v })} disabled={readOnly || busy} />
                {dr.rating > 0 && (
                  <div className="flex flex-col gap-1">
                    <Textarea aria-label={t("fb.commentLabel", { name: tg.teacher })} placeholder={t("fb.commentPh")} maxLength={500} value={dr.comment} disabled={busy} onChange={(e) => set(tg.target_id, { comment: e.target.value })} className="min-h-20" />
                    <span className="self-end text-xs tabular-nums text-text-tertiary">{dr.comment.length}/500</span>
                  </div>
                )}
              </>)}
            </li>
          );
        })}
      </ul>
      {answered ? <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-5 text-success" /> {t("fb.thanks")}</p> : (<>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button variant="brand" size="lg" disabled={rated.length === 0 || readOnly} loading={busy} className="self-end" onClick={() => void send()}>{t("fb.send")}{rated.length > 0 && ` (${rated.length})`}</Button>
      </>)}
    </Card>
  );
}

export function FeedbackLive() {
  const t = useT();
  const sel = useChild();
  const q = useParentFeedback();
  if (!sel) return null;
  const { child } = sel;
  return (
    <>
      <PageHeader eyebrow={child.name} title={t("fb.title")} dim={t("fb.dim")} />
      {child.readOnly && <ReadOnlyNote name={child.name.split(" ")[0]} />}
      <Loaded q={q}>
        {(rows) => {
          const mine = rows.filter((r) => r.student_id === child.id);
          if (!mine.length) return <Card className="text-sm text-muted-foreground">{t("fb.none")}</Card>;
          return <>{mine.map((r) => <Request key={`${r.request_id}-${r.student_id}`} req={r} readOnly={child.readOnly} />)}</>;
        }}
      </Loaded>
    </>
  );
}
