"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, CheckCheck, Megaphone, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { ClassTeacherTag, SubjectTag } from "@/components/app/messages/bits";
import { InactiveBanner, LeftNote } from "@/components/app/messages/inactive-banner";
import { ThreadRow } from "@/components/app/messages/thread-row";
import { useChild } from "@/components/parent-child";
import { AttachmentChip, ErrorCard, Loaded, useErrText } from "@/components/parent/live-ui";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { useOpenParentThread, useParentMessages, useParentTeachers, useParentThread, useParentThreads, useParentUnread, useReadParentThread, useSendParentMessage, type ParentThread } from "@/lib/api/hooks/parent-comms";
import { uploadFile } from "@/lib/api/upload";
import { useData, useFmt } from "@/lib/lang-context";
import { useT } from "@/lib/parent-i18n";
import { cn } from "@/lib/utils";

const MAX_FILES = 5, MAX_BYTES = 10 * 1024 * 1024, ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const CLASS_TEACHER = "Class teacher";
const query = "(min-width: 1024px)";
const subscribeDesktop = (cb: () => void) => { const m = window.matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const useDesktop = () => React.useSyncExternalStore(subscribeDesktop, () => window.matchMedia(query).matches, () => false);
const isClassTeacher = (tag: string, subjectId: string | null) => tag === CLASS_TEACHER && subjectId === null;

function Composer({ thread }: { thread: ParentThread }) {
  const t = useT(), err = useErrText();
  const [text, setText] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const send = useSendParentMessage(thread.id);
  function add(list: FileList | null) {
    const next = [...files];
    for (const f of Array.from(list ?? [])) {
      if (next.length >= MAX_FILES) { toast.error(t("pl.maxFiles", { n: MAX_FILES })); break; }
      if (f.size > MAX_BYTES) { toast.error(t("pl.fileBig", { name: f.name })); continue; }
      next.push(f);
    }
    setFiles(next);
    if (input.current) input.current.value = "";
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const attachment_ids: string[] = [];
      for (const f of files) {
        try { attachment_ids.push((await uploadFile(f, "message_attachment", "parent")).id); }
        catch (x) { throw x instanceof ApiError ? new ApiError(x.status, x.code, `${f.name}: ${x.message}`, x.details) : x; }
      }
      await send.mutateAsync({ body, attachment_ids });
      setText(""); setFiles([]);
    } catch (x) { toast.error(err(x)); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-border p-3">
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">{files.map((f, i) => (
          <li key={`${f.name}-${i}`} className="flex max-w-full items-center gap-1.5 rounded-full bg-fill py-1 pl-3 pr-1 text-xs"><Paperclip className="size-3.5 shrink-0" /><span className="max-w-48 truncate">{f.name}</span>
            <button type="button" aria-label={t("pl.removeFile")} onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} className="grid size-5 place-items-center rounded-full hover:bg-separator"><X className="size-3" /></button></li>))}</ul>
      )}
      <div className="flex items-center gap-2">
        <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" tabIndex={-1} aria-label={t("pl.attach")} onChange={(e) => add(e.target.files)} />
        <Button type="button" variant="ghost" size="icon" aria-label={t("pl.attach")} onClick={() => input.current?.click()} disabled={files.length >= MAX_FILES}><Paperclip /></Button>
        <Input aria-label={t("msg.to", { name: thread.teacher_name })} className="rounded-full" placeholder={t("msg.write", { name: thread.teacher_name })} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" variant="brand" size="icon" aria-label={t("msg.send")} loading={busy} disabled={!text.trim()}><Send /></Button>
      </div>
    </form>
  );
}

function BubblesSk() {
  const t = useT();
  return (
    <div role="status" aria-busy="true" className="flex max-h-[55dvh] min-h-48 flex-1 flex-col gap-3 overflow-hidden p-4">
      <span className="sr-only">{t("app.loading")}</span>
      <Skeleton className="h-10 w-3/5 max-w-[75%] rounded-[20px]" />
      <Skeleton className="h-14 w-1/2 max-w-[75%] self-end rounded-[20px]" />
      <Skeleton className="h-10 w-2/5 max-w-[75%] rounded-[20px]" />
      <Skeleton className="h-10 w-1/2 max-w-[75%] self-end rounded-[20px]" />
    </div>
  );
}

function ConversationSk() {
  const t = useT();
  return (
    <Card role="status" aria-busy="true" className="flex min-h-[460px] flex-col overflow-hidden p-0">
      <span className="sr-only">{t("app.loading")}</span>
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Skeleton className="size-10 rounded-full" />
        <div className="min-w-0"><Skeleton className="h-4 w-36" /><Skeleton className="mt-2 h-5 w-24 rounded-full" /></div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Skeleton className="h-10 w-3/5 rounded-[20px]" /><Skeleton className="h-14 w-1/2 self-end rounded-[20px]" /><Skeleton className="h-10 w-2/5 rounded-[20px]" />
      </div>
    </Card>
  );
}

function TeachersSk() {
  const t = useT();
  return (
    <div role="status" aria-busy="true"><span className="sr-only">{t("app.loading")}</span>
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden="true" className="flex items-center gap-3 rounded-2xl p-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1"><Skeleton className="h-4 w-2/5" /><Skeleton className="mt-2 h-5 w-20 rounded-full" /><Skeleton className="mt-2 h-3.5 w-4/5" /></div>
        </div>
      ))}
    </div>
  );
}

function Bubbles({ id }: { id: string }) {
  const t = useT(), f = useFmt();
  const q = useParentMessages(id);
  const end = React.useRef<HTMLDivElement>(null);
  const ordered = React.useMemo(() => [...(q.data?.items ?? [])].reverse(), [q.data]); // the API sends newest first
  React.useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [ordered.length]);
  if (!q.data) return q.isError ? <div className="p-4"><ErrorCard error={q.error} retry={() => void q.refetch()} fetching={q.isFetching} /></div> : <BubblesSk />;
  return (
    <ul className="appear flex max-h-[55dvh] min-h-48 flex-1 flex-col gap-3 overflow-y-auto p-4" aria-label={t("msg.list")}>
      {ordered.length === 0 && <li className="m-auto text-sm text-muted-foreground">{t("msg.hello")}</li>}
      {ordered.map((m) => (
        <li key={m.id} className={cn("flex max-w-[85%] flex-col gap-1 sm:max-w-[75%]", m.mine ? "items-end self-end" : "self-start")}>
          <div className={cn("flex flex-col gap-2 whitespace-pre-line break-words rounded-[20px] px-4 py-2.5 text-sm", m.mine ? "bg-solid text-on-solid" : "bg-fill")}>
            {m.body}
            {m.attachments.length > 0 && <span className="flex flex-wrap gap-1.5">{m.attachments.map((a) => <AttachmentChip key={a.id} a={a} />)}</span>}
          </div>
          <span className="flex items-center gap-1 text-[11px] text-text-tertiary">{f.ist(m.created_at)}{m.mine && (m.seen ? <><CheckCheck className="size-3 text-foreground" /><span className="sr-only">{t("pl.seen")}</span></> : <><Check className="size-3" /><span className="sr-only">{t("pl.sent")}</span></>)}</span>
        </li>
      ))}
      <div ref={end} />
    </ul>
  );
}

function Conversation({ id, childName, childLeft, onBack }: { id: string; childName: string; childLeft: boolean; onBack: () => void }) {
  const t = useT(), f = useFmt(), d = useData();
  const q = useParentThread(id);
  const read = useReadParentThread();
  const unread = q.data?.unread ?? 0;
  const newest = useParentMessages(id).data?.items[0]?.id;
  React.useEffect(() => { if (unread > 0 && !read.isPending) read.mutate(id); }, [id, unread, newest]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!q.data) return q.isError ? <ErrorCard error={q.error} retry={() => void q.refetch()} fetching={q.isFetching} /> : <ConversationSk />;
  const th = q.data;
  const notice = f.lang === "hi" ? th.inactive_notice_hi ?? th.inactive_notice : th.inactive_notice;
  return (
    <Card className="appear flex min-h-[460px] flex-col overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={t("msg.back")} onClick={onBack}><ArrowLeft /></Button>
        <Avatar name={th.teacher_name} className="size-10" />
        <div className="min-w-0">
          <p className="truncate font-bold">{th.teacher_name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">{isClassTeacher(th.tag, th.subject_id) ? <ClassTeacherTag /> : <SubjectTag subject={th.tag} />}{!th.active && <span className="text-xs text-text-tertiary">{t("msg.prevTeacher")}</span>}</div>
        </div>
      </div>
      <Bubbles id={id} />
      {!th.active ? (notice ? <div role="status" className="border-t border-border p-4 text-sm text-muted-foreground">{notice}</div> : <InactiveBanner teacher={th.teacher_name} subject={th.tag} child={childName} />)
        : childLeft ? <LeftNote child={childName} /> : <Composer thread={th} />}
      <span className="sr-only">{d(th.tag)}</span>
    </Card>
  );
}

export function MessagesLive() {
  const t = useT(), d = useData(), err = useErrText();
  const sel = useChild();
  const sid = sel?.child.id ?? "";
  const threads = useParentThreads(sid);
  const teachers = useParentTeachers(sid);
  const unread = useParentUnread();
  const open = useOpenParentThread();
  const desktop = useDesktop();
  const [view, setView] = React.useState<{ childId: string; id: string } | null>(null);
  if (!sel) return null;
  const { child } = sel;
  const picked = view && view.childId === child.id ? view.id : null;
  const left = child.readOnly, name = child.name.split(" ")[0];
  const openTeacher = (tc: { staff_id: string; subject_id: string | null; thread_id: string | null }) => {
    if (tc.thread_id) return setView({ childId: child.id, id: tc.thread_id });
    open.mutate({ staff_id: tc.staff_id, student_id: child.id, subject_id: tc.subject_id }, { onSuccess: (th) => setView({ childId: child.id, id: th.id }), onError: (e) => toast.error(err(e)) });
  };
  const rows = threads.data?.items ?? [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const previous = rows.filter((r) => !r.active);

  return (
    <>
      <PageHeader title={t("msg.title")} />
      {left && <p role="status" className="mt-5 rounded-2xl bg-fill px-4 py-3 text-sm text-muted-foreground">{t("pl.leftNote", { name })}</p>}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr] lg:items-start">
        <div className={picked ? "hidden min-w-0 flex-col gap-5 lg:flex" : "flex min-w-0 flex-col gap-5"}>
          <Link href="/parent/notices" className="flex items-center gap-3 rounded-[20px] bg-card p-4 hover:bg-card-hover">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-fill text-foreground"><Megaphone className="size-5" /></span>
            <span className="min-w-0 flex-1"><span className="block font-bold">{t("upd.title")}</span></span>
            {(unread.data?.updates ?? 0) > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-foreground px-1.5 text-[11px] font-bold tabular-nums text-background"><span className="sr-only">{t("upd.unread")}</span>{unread.data!.updates}</span>}
          </Link>
          <section aria-labelledby="teachers-h">
            <h2 id="teachers-h" className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">{t("msg.teachers")}</h2>
            <Card className="flex flex-col gap-0.5 p-2">
              <Loaded q={teachers} loading={<TeachersSk />} className="flex flex-col gap-0.5">
                {(list) => list.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{t("msg.noTeachers")}</p> : (<>
                  {list.map((tc) => {
                    const th = tc.thread_id ? byId.get(tc.thread_id) : undefined;
                    const ct = isClassTeacher(tc.tag, tc.subject_id);
                    return <ThreadRow key={`${tc.staff_id}-${tc.subject_id ?? "ct"}`} avatarName={tc.name} title={tc.name} subject={ct ? "" : d(tc.tag)} classTeacher={ct}
                      preview={th?.last_message_preview ?? undefined} at={th?.last_message_at ?? undefined} unread={(th?.unread ?? 0) > 0}
                      selected={!!tc.thread_id && picked === tc.thread_id} onClick={() => openTeacher(tc)} />;
                  })}
                </>)}
              </Loaded>
            </Card>
          </section>
          {previous.length > 0 && (
            <section aria-labelledby="prev-h">
              <h2 id="prev-h" className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">{t("msg.previous")}</h2>
              <Card className="flex flex-col gap-0.5 p-2">
                {previous.map((th) => (
                  <ThreadRow key={th.id} avatarName={th.teacher_name} title={th.teacher_name} subject={isClassTeacher(th.tag, th.subject_id) ? "" : d(th.tag)} inactiveNote={t("msg.noLonger", { subject: d(th.tag) })} at={th.last_message_at ?? undefined}
                    selected={picked === th.id} onClick={() => setView({ childId: child.id, id: th.id })} />
                ))}
              </Card>
            </section>
          )}
          {threads.isError && !threads.data && <ErrorCard error={threads.error} retry={() => void threads.refetch()} fetching={threads.isFetching} />}
        </div>
        {picked ? <div className="min-w-0"><Conversation key={picked} id={picked} childName={name} childLeft={left} onBack={() => setView(null)} /></div>
          : desktop && <Card className="grid min-h-48 place-items-center text-sm text-muted-foreground">{t("pl.pickTeacher")}</Card>}
      </div>
    </>
  );
}
