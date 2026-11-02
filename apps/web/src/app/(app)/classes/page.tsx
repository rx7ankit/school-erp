"use client";
import { PageHeader } from "@/components/app/page-header";
import Link from "next/link";
import { Can } from "@/components/app/can";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { useSession } from "@/components/session-provider";
import { YearEndBanner } from "@/components/app/rollover/year-end-banner";
import { ArchivedClasses } from "@/components/app/rollover/archived-classes";
import { isLive } from "@/lib/api/config";
import { ClassesLive } from "@/components/app/classes-live";
import { CLASSES, STAFF, STUDENTS, className } from "@/lib/mock";

function ClassesDemo() {
  const { user } = useSession();
  return (
    <>
      <PageHeader title="Classes" />
      <YearEndBanner />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CLASSES.map((c) => {
          const teachers = STAFF.filter((s) => s.classes.some((x) => x.classId === c.id));
          const ct = teachers.find((t) => t.classes.find((x) => x.classId === c.id)?.role === "class_teacher");
          const mine = user?.classes.some((x) => x.classId === c.id);
          return (
            <Card key={c.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[28px] font-bold leading-none tracking-tight">{className(c.id)}</h2>
                  <p className="mt-1 text-[13px] text-muted-foreground">{STUDENTS.filter((s) => s.classId === c.id).length} students</p>
                </div>
                <div className="flex items-center gap-2">
                  {mine && <Badge tone="brand">Yours</Badge>}
                  <Can access="academic.manage"><Link href={`/promotion?class=${c.id}`} className="text-[13px] font-medium text-brand hover:underline" aria-label={`Promote class ${className(c.id)}`}>Promote</Link></Can>
                </div>
              </div>
              {ct && (
                <div className="flex items-center gap-3">
                  <Avatar name={ct.name} />
                  <div><p className="text-sm font-medium">{ct.name}</p><p className="text-xs text-text-tertiary">Class teacher</p></div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <ArchivedClasses />
    </>
  );
}

export default function ClassesPage() {
  return isLive ? <ClassesLive /> : <ClassesDemo />;
}
