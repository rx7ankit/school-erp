"use client";
import * as React from "react";
import { BookPlus } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BOOKS, LOANS } from "@/lib/mock";
import { formatDateOn, formatIST, nowUTC } from "@/lib/time";
import { todayOnIST } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";

export default function LibraryPage() {
  const can = useCan();
  const [books, setBooks] = React.useState(BOOKS);
  const [loans, setLoans] = React.useState(LOANS);
  const [open, setOpen] = React.useState(false);
  const today = useTodayIST();
  if (!can("library.manage")) return <NoAccess need="the Library permission" />;

  function issue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const title = String(f.get("book"));
    const dueOn = todayOnIST(new Date(Date.now() + 14 * 864e5));
    setLoans((l) => [{ id: crypto.randomUUID(), book: title, borrower: String(f.get("who")), kind: "Student", issuedAt: nowUTC(), dueOn }, ...l]);
    setBooks((b) => b.map((x) => (x.title === title ? { ...x, issued: x.issued + 1 } : x)));
    setOpen(false); toast.success(`Issued. Due ${formatDateOn(dueOn)}`);
  }
  function ret(id: string, title: string) {
    setLoans((l) => l.filter((x) => x.id !== id));
    setBooks((b) => b.map((x) => (x.title === title ? { ...x, issued: Math.max(0, x.issued - 1) } : x)));
    toast.success("Returned");
  }

  return (
    <>
      <PageHeader eyebrow="Library" title="Books." dim="Issue and return." actions={<Button variant="brand" onClick={() => setOpen(true)}><BookPlus /> Issue a book</Button>} />
      <Tabs defaultValue="issued">
        <TabsList><TabsTrigger value="issued">Issued ({loans.length})</TabsTrigger><TabsTrigger value="catalogue">Catalogue ({books.length})</TabsTrigger></TabsList>
        <TabsContent value="issued"><Card>
          <Table>
            <TableHeader><TableRow><TableHead>Book</TableHead><TableHead>Borrower</TableHead><TableHead>Issued</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {loans.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.book}</TableCell>
                  <TableCell>{l.borrower} <span className="text-xs text-text-tertiary">· {l.kind}</span></TableCell>
                  <TableCell className="tabular-nums">{formatIST(l.issuedAt, "date")}</TableCell>
                  <TableCell className="tabular-nums">{formatDateOn(l.dueOn)} {today && l.dueOn < today && <Badge tone="danger" className="ml-2">Overdue</Badge>}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="secondary" onClick={() => ret(l.id, l.book)}>Mark returned</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card></TabsContent>
        <TabsContent value="catalogue"><Card>
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Author</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Available</TableHead></TableRow></TableHeader>
            <TableBody>
              {books.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.title}</TableCell><TableCell>{b.author}</TableCell><TableCell>{b.category}</TableCell>
                  <TableCell className="text-right tabular-nums"><Badge tone={b.copies - b.issued > 0 ? "success" : "danger"}>{b.copies - b.issued} of {b.copies}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card></TabsContent>
      </Tabs>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Issue a book</DialogTitle></DialogHeader>
          <form onSubmit={issue} className="flex flex-col gap-4">
            <Field label="Book" htmlFor="book"><NativeSelect id="book" name="book">{books.filter((b) => b.copies > b.issued).map((b) => <option key={b.id}>{b.title}</option>)}</NativeSelect></Field>
            <Field label="Borrower" htmlFor="who" hint="Student or staff name. Due in 14 days."><Input id="who" name="who" required /></Field>
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="brand">Issue</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
