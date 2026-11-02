"use client";
import * as React from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Result } from "@/lib/messaging";
import { useTr } from "@/lib/lang-context";
import { usePending } from "@/lib/use-pending";

/** One-line message box. Send shows a spinner while the (demo) request runs. */
export function Composer({ onSend, placeholder, label = "Message" }: { onSend: (text: string) => Result; placeholder: string; label?: string }) {
  const tr = useTr();
  const [text, setText] = React.useState("");
  const { run, is } = usePending(500);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    run("send", () => {
      const r = onSend(body);
      if (r.ok) setText(""); else toast.error(r.error);
    });
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3">
      <Input aria-label={label} className="rounded-full" placeholder={placeholder} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} />
      <Button type="submit" variant="brand" size="icon" aria-label={tr("msg.send", "Send")} loading={is("send")} disabled={!text.trim()}><Send /></Button>
    </form>
  );
}
