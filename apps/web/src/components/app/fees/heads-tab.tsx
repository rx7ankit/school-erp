"use client";
import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FREQUENCY_LABEL, HEADS, addHead, removeHead, updateHead, useFeesStore, type FeeHead, type Frequency } from "@/lib/fees-setup";
import { Layers } from "lucide-react";
import { ConfirmDialog } from "./confirm-dialog";

const FREQS = Object.keys(FREQUENCY_LABEL) as Frequency[];
const FreqSelect = ({ id, value, onChange }: { id: string; value: Frequency; onChange: (f: Frequency) => void }) => (
  <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value as Frequency)}>{FREQS.map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}</NativeSelect>
);

export function HeadsTab() {
  useFeesStore();
  const [name, setName] = React.useState("");
  const [freq, setFreq] = React.useState<Frequency>("term");
  const [edit, setEdit] = React.useState<FeeHead | null>(null);
  const [del, setDel] = React.useState<FeeHead | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const r = addHead(name, freq);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(`Added ${name.trim()}`); setName("");
  }
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><div><CardTitle>Add head</CardTitle></div></CardHeader>
        <form onSubmit={add} className="grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <Field label="Name" htmlFor="head-name"><Input id="head-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" /></Field>
          <Field label="Frequency" htmlFor="head-freq"><FreqSelect id="head-freq" value={freq} onChange={setFreq} /></Field>
          <Button type="submit" variant="brand"><Plus /> Add head</Button>
        </form>
      </Card>
      {!HEADS.length ? <EmptyState icon={Layers} title="No heads" /> : (
        <Card>
          <CardHeader><CardTitle>Heads ({HEADS.length})</CardTitle></CardHeader>
          <ul className="flex flex-col">
            {HEADS.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-3"><span className="font-medium">{h.name}</span><Badge>{FREQUENCY_LABEL[h.frequency]}</Badge></div>
                <div className="flex gap-1.5">
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${h.name}`} onClick={() => setEdit(h)}><Pencil /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${h.name}`} onClick={() => setDel(h)}><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <EditHead head={edit} onClose={() => setEdit(null)} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title={`Remove ${del?.name ?? "head"}?`} confirmLabel="Remove"
        description="Class amounts are cleared."
        onConfirm={() => { if (del) { removeHead(del.id); toast.success(`Removed ${del.name}`); } }} />
    </div>
  );
}

function EditHead({ head, onClose }: { head: FeeHead | null; onClose: () => void }) {
  return (
    <Dialog open={!!head} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{head && <EditBody key={head.id} head={head} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}
function EditBody({ head, onClose }: { head: FeeHead; onClose: () => void }) {
  const [name, setName] = React.useState(head.name);
  const [freq, setFreq] = React.useState<Frequency>(head.frequency);
  return (
    <form onSubmit={(e) => { e.preventDefault(); const r = updateHead(head.id, name, freq); if (!r.ok) { toast.error(r.error); return; } toast.success("Saved"); onClose(); }} className="flex flex-col gap-4">
      <DialogHeader><DialogTitle>Edit head</DialogTitle></DialogHeader>
      <Field label="Name" htmlFor="edit-head-name"><Input id="edit-head-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Frequency" htmlFor="edit-head-freq"><FreqSelect id="edit-head-freq" value={freq} onChange={setFreq} /></Field>
      <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand">Save</Button></DialogFooter>
    </form>
  );
}
