"use client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReadinessList } from "./readiness-list";
import { checkReadiness } from "@/lib/rollover";

export function StepCheck({ onLeave }: { onLeave: () => void }) {
  const issues = checkReadiness().issues;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Is the school ready?</CardTitle>
          <CardDescription>{issues ? `${issues} ${issues === 1 ? "thing needs" : "things need"} a look. None of them stops you, and your draft is saved if you leave to fix one.` : "Everything looks fine. You can go ahead."}</CardDescription>
        </div>
      </CardHeader>
      <ReadinessList onLeave={onLeave} />
    </Card>
  );
}
