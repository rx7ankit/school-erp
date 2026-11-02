"use client";
import { logAudit } from "@/lib/audit";
import * as React from "react";
import { CalendarPlus, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { Field } from "@/components/app/field";
import { useCan } from "@/components/app/can";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CLASSES, HOLIDAYS, NOTICES, STUDENTS, SUBJECTS, className } from "@/lib/mock";
import { addExamSheet, clock, useExamSheets } from "@/lib/exam-sheets";
import { notify } from "@/lib/notifications";
import { usePending } from "@/lib/use-pending";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { formatDateOn, formatIST, nowUTC } from "@/lib/time";
import { YearClassesTab } from "@/components/app/academic/year-classes-tab";
import { SubjectsTab } from "@/components/app/academic/subjects-tab";
import { GradingTab } from "@/components/app/academic/grading-tab";
import { ExamsTab } from "@/components/app/academic/exams-tab";
import { TeachersTab } from "@/components/app/academic/assign/teachers-tab";
import { useSession } from "@/components/session-provider";
import { AcademicLive } from "@/components/app/academic-live";


const KIND = { holiday: "danger", exam: "warning", event: "brand" } as const;

export default function AcademicPage() {
  const { live } = useSession();
  return live ? <AcademicLive /> : <AcademicDemo />;
}

function AcademicDemo() {
  const can = useCan();
  const [days, setDays] = React.useState(HOLIDAYS);
  const [notices, setNotices] = React.useState(NOTICES);
  const [dlg, setDlg] = React.useState<"day" | "notice" | "exam" | null>(null);
  const [tab, setTab] = React.useState("calendar");
  const sheets = useExamSheets();
  const { run, is } = usePending(800);
  const [examClasses, setExamClasses] = React.useState<string[]>(CLASSES.map((c) => c.id));
  if (!can("academic.manage")) return <NoAccess need="the Academic permission" />;

  function addDay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    setDays((d) => [...d, { id: crypto.randomUUID(), title: String(f.get("title")), fromOn: String(f.get("from")), toOn: String(f.get("to") || f.get("from")), kind: String(f.get("kind")) }].sort((a, b) => a.fromOn.localeCompare(b.fromOn)));
    logAudit({ category: "academic", action: "calendar.added", summary: `Added "${String(f.get("title"))}" to the calendar (${String(f.get("kind"))}, ${String(f.get("from"))}${f.get("to") ? ` to ${String(f.get("to"))}` : ""})`, entity: String(f.get("title")), href: "/academic" });
    setDlg(null); toast.success("Added");
  }
  function addNotice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const audience = String(f.get("audience")), title = String(f.get("title"));
    run("notice", () => {
      setNotices((n) => [{ id: crypto.randomUUID(), title, body: String(f.get("body")), audience, publishedAt: nowUTC() }, ...n]);
      // Parents get a notification for notices meant for everyone or for parents.
      if (audience !== "staff") notify(STUDENTS.filter((s) => s.status === "active").map((s) => ({ type: "notice" as const, studentId: s.id, params: { title } })));
      logAudit({ category: "academic", action: "notice.published", summary: `Published notice "${title}" to ${audience === "all" ? "everyone" : audience}`, entity: title, href: "/academic" });
      setDlg(null); toast.success("Published");
    });
  }

  return (
    <>
      <PageHeader title="Academic" />
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList><TabsTrigger value="calendar">Calendar</TabsTrigger><TabsTrigger value="exams">Exams</TabsTrigger><TabsTrigger value="notices">Notices</TabsTrigger>
            <TabsTrigger value="years">Years</TabsTrigger><TabsTrigger value="subjects">Subjects</TabsTrigger><TabsTrigger value="teachers">Teachers</TabsTrigger><TabsTrigger value="grading">Grading</TabsTrigger><TabsTrigger value="setup-exams">Exam setup</TabsTrigger></TabsList>
        </div>
        <TabsContent value="calendar" className="flex flex-col gap-4">
          <div className="flex justify-end"><Button variant="accent" onClick={() => setDlg("day")}><CalendarPlus /> Add</Button></div>
          <Card>
            <ul>
              {days.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-4 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0">
                  <div className="w-36 shrink-0 text-sm tabular-nums text-muted-foreground">{formatDateOn(h.fromOn, "short")}{h.toOn !== h.fromOn && ` – ${formatDateOn(h.toOn, "short")}`}</div>
                  <p className="flex-1 font-medium">{h.title}</p>
                  <Badge tone={KIND[h.kind as keyof typeof KIND]} className="capitalize">{h.kind}</Badge>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${h.title}`} onClick={() => { setDays((d) => d.filter((x) => x.id !== h.id)); logAudit({ category: "academic", action: "calendar.removed", summary: `Removed "${h.title}" from the calendar`, entity: h.title, href: "/academic", sensitive: true }); toast.success("Removed"); }}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>
        <TabsContent value="exams" className="flex flex-col gap-4">
          <div className="flex justify-end"><Button variant="brand" onClick={() => setDlg("exam")}><CalendarPlus /> Add</Button></div>
          <div className="grid gap-4 md:grid-cols-2">
            {sheets.map((es) => (
              <Card key={es.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3"><h3 className="text-[17px] font-bold">{es.name}</h3><Badge>{es.classIds.length === CLASSES.length ? "All classes" : es.classIds.map(className).join(", ")}</Badge></div>
                <ul>{es.papers.map((p) => <li key={p.subject} className="flex items-center justify-between border-t border-border py-2 text-sm first:border-t-0"><span className="font-medium">{p.subject}</span><span className="tabular-nums text-muted-foreground">{formatDateOn(p.dateOn, "short")} · {clock(p.time)}</span></li>)}</ul>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="notices" className="flex flex-col gap-4">
          <div className="flex justify-end"><Button variant="brand" onClick={() => setDlg("notice")}><Megaphone /> Add</Button></div>
          <div className="grid gap-4 md:grid-cols-2">
            {notices.map((n) => (
              <Card key={n.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3"><h3 className="text-[17px] font-bold">{n.title}</h3><Badge className="capitalize">{n.audience}</Badge></div>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-auto text-xs text-text-tertiary">{formatIST(n.publishedAt)} IST</p>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="years"><YearClassesTab /></TabsContent>
        <TabsContent value="subjects"><SubjectsTab /></TabsContent>
        <TabsContent value="teachers"><TeachersTab /></TabsContent>
        <TabsContent value="grading"><GradingTab /></TabsContent>
        <TabsContent value="setup-exams"><ExamsTab /></TabsContent>
      </Tabs>

      <Dialog open={dlg === "day"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add date</DialogTitle></DialogHeader>
          <form onSubmit={addDay} className="flex flex-col gap-4">
            <Field label="Title" htmlFor="title"><Input id="title" name="title" required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From" htmlFor="from"><Input id="from" name="from" type="date" required /></Field>
              <Field label="To" htmlFor="to"><Input id="to" name="to" type="date" /></Field>
            </div>
            <Field label="Type" htmlFor="kind"><NativeSelect id="kind" name="kind"><option value="holiday">Holiday</option><option value="exam">Exam</option><option value="event">Event</option></NativeSelect></Field>
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button type="submit" variant="brand">Add</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={dlg === "exam"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Date sheet</DialogTitle><DialogDescription className="sr-only">Exam dates by subject.</DialogDescription></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault(); const f = new FormData(e.currentTarget);
            if (!examClasses.length) { toast.error("Choose a class"); return; }
            const papers = SUBJECTS.filter((_, i) => f.get(`on${i}`)).map((subject) => { const i = SUBJECTS.indexOf(subject); return { subject, dateOn: String(f.get(`on${i}`)), time: String(f.get(`t${i}`) || "09:00") }; });
            if (!papers.length) { toast.error("Add a date"); return; }
            const name = String(f.get("name"));
            run("exam", () => {
              addExamSheet({ id: crypto.randomUUID(), name, classIds: examClasses, papers, createdAt: nowUTC() });
              notify(STUDENTS.filter((s) => s.status === "active" && examClasses.includes(s.classId)).map((s) => ({ type: "exam" as const, studentId: s.id, params: { title: name } })));
              logAudit({ category: "academic", action: "examsheet.published", summary: `Published exam date sheet "${name}" for ${examClasses.length} classes`, entity: name, href: "/academic" });
              setDlg(null); toast.success("Published");
            });
          }} className="flex flex-col gap-4">
            <Field label="Name" htmlFor="xn"><Input id="xn" name="name" defaultValue="Half-yearly exams" required /></Field>
            <fieldset><legend className="mb-2 text-sm font-medium">Classes</legend>
              <div className="grid grid-cols-3 gap-2">{CLASSES.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded-xl bg-fill px-3 py-2 text-sm"><Checkbox checked={examClasses.includes(c.id)} onCheckedChange={(on) => setExamClasses((p) => on ? [...p, c.id] : p.filter((x) => x !== c.id))} />{className(c.id)}</label>))}</div></fieldset>
            <fieldset><legend className="mb-2 text-sm font-medium">Dates</legend>
              <div className="flex flex-col gap-2">{SUBJECTS.map((s, i) => (
                <div key={s} className="grid grid-cols-[1fr_auto_auto] items-center gap-2"><span className="text-sm">{s}</span>
                  <Input aria-label={`${s} date`} name={`on${i}`} type="date" className="h-9 w-40" /><Input aria-label={`${s} start time`} name={`t${i}`} type="time" defaultValue="09:00" className="h-9 w-28" /></div>))}</div></fieldset>
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button type="submit" variant="brand" loading={is("exam")}>Publish</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={dlg === "notice"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Notice</DialogTitle></DialogHeader>
          <form onSubmit={addNotice} className="flex flex-col gap-4">
            <Field label="Title" htmlFor="ntitle"><Input id="ntitle" name="title" required /></Field>
            <Field label="Message" htmlFor="body"><Textarea id="body" name="body" required /></Field>
            <Field label="To" htmlFor="audience"><NativeSelect id="audience" name="audience"><option value="all">Everyone</option><option value="parents">Parents</option><option value="staff">Staff</option></NativeSelect></Field>
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button type="submit" variant="brand" loading={is("notice")}>Publish</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
