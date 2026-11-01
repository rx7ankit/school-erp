"use client";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HOLIDAYS, NOTICES } from "@/lib/mock";
import { formatDateOn, formatIST, nowUTC } from "@/lib/time";

const KIND = { holiday: "danger", exam: "warning", event: "brand" } as const;

export default function AcademicPage() {
  const can = useCan();
  const [days, setDays] = React.useState(HOLIDAYS);
  const [notices, setNotices] = React.useState(NOTICES);
  const [dlg, setDlg] = React.useState<"day" | "notice" | null>(null);
  if (!can("academic.manage")) return <NoAccess need="the Academic permission" />;

  function addDay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    setDays((d) => [...d, { id: crypto.randomUUID(), title: String(f.get("title")), fromOn: String(f.get("from")), toOn: String(f.get("to") || f.get("from")), kind: String(f.get("kind")) }].sort((a, b) => a.fromOn.localeCompare(b.fromOn)));
    setDlg(null); toast.success("Added to the calendar");
  }
  function addNotice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    setNotices((n) => [{ id: crypto.randomUUID(), title: String(f.get("title")), body: String(f.get("body")), audience: String(f.get("audience")), publishedAt: nowUTC() }, ...n]);
    setDlg(null); toast.success("Notice published");
  }

  return (
    <>
      <PageHeader eyebrow="Academic" title="Calendar and notices." dim="One place for the school year." />
      <Tabs defaultValue="calendar">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList><TabsTrigger value="calendar">Calendar</TabsTrigger><TabsTrigger value="notices">Notices</TabsTrigger></TabsList>
        </div>
        <TabsContent value="calendar" className="flex flex-col gap-4">
          <div className="flex justify-end"><Button variant="brand" onClick={() => setDlg("day")}><CalendarPlus /> Add date</Button></div>
          <Card>
            <ul>
              {days.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-4 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0">
                  <div className="w-36 shrink-0 text-sm tabular-nums text-muted-foreground">{formatDateOn(h.fromOn, "short")}{h.toOn !== h.fromOn && ` – ${formatDateOn(h.toOn, "short")}`}</div>
                  <p className="flex-1 font-medium">{h.title}</p>
                  <Badge tone={KIND[h.kind as keyof typeof KIND]} className="capitalize">{h.kind}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>
        <TabsContent value="notices" className="flex flex-col gap-4">
          <div className="flex justify-end"><Button variant="brand" onClick={() => setDlg("notice")}><Megaphone /> New notice</Button></div>
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
      </Tabs>

      <Dialog open={dlg === "day"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add to calendar</DialogTitle></DialogHeader>
          <form onSubmit={addDay} className="flex flex-col gap-4">
            <Field label="Title" htmlFor="title"><Input id="title" name="title" required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From" htmlFor="from"><Input id="from" name="from" type="date" required /></Field>
              <Field label="To" htmlFor="to" hint="Leave empty for one day"><Input id="to" name="to" type="date" /></Field>
            </div>
            <Field label="Type" htmlFor="kind"><NativeSelect id="kind" name="kind"><option value="holiday">Holiday</option><option value="exam">Exam</option><option value="event">Event</option></NativeSelect></Field>
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button type="submit" variant="brand">Add</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={dlg === "notice"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New notice</DialogTitle></DialogHeader>
          <form onSubmit={addNotice} className="flex flex-col gap-4">
            <Field label="Title" htmlFor="ntitle"><Input id="ntitle" name="title" required /></Field>
            <Field label="Message" htmlFor="body"><Textarea id="body" name="body" required /></Field>
            <Field label="Send to" htmlFor="audience"><NativeSelect id="audience" name="audience"><option value="all">Everyone</option><option value="parents">Parents</option><option value="staff">Staff</option></NativeSelect></Field>
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button type="submit" variant="brand">Publish</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
