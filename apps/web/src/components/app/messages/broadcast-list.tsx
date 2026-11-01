"use client";
import * as React from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { coversClass, useMessaging } from "@/lib/messaging";
import { CLASSES, className, type StaffRow } from "@/lib/mock";
import { hasAccess } from "@/lib/permissions";
import { BroadcastCard } from "./broadcast-card";

/** Broadcasts the signed-in person can see: everything for admin and academic managers, otherwise those reaching their classes. */
export function BroadcastList({ user }: { user: StaffRow }) {
  const { broadcasts } = useMessaging();
  const [classId, setClassId] = React.useState("all");
  const wide = hasAccess(user, "academic.manage");
  const mine = user.isAdmin ? CLASSES.map((c) => c.id) : user.classes.map((c) => c.classId);
  const options = wide ? CLASSES.map((c) => c.id) : mine;
  const visible = broadcasts.filter((b) => wide || mine.some((id) => coversClass(b, id)));
  const shown = classId === "all" ? visible : visible.filter((b) => coversClass(b, classId));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sent</CardTitle>
        {options.length > 1 && (
          <NativeSelect aria-label="Filter by class" className="w-40" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="all">All classes</option>
            {options.map((id) => <option key={id} value={id}>Class {className(id)}</option>)}
          </NativeSelect>
        )}
      </CardHeader>
      {shown.length === 0 ? <p className="text-sm text-muted-foreground">No broadcasts yet.</p> : (
        <ul className="flex flex-col">
          {shown.map((b) => <li key={b.id} className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"><BroadcastCard b={b} showScope /></li>)}
        </ul>
      )}
    </Card>
  );
}
