"use client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ReadinessList } from "./readiness-list";
import { checkReadiness } from "@/lib/rollover";

export function StepCheck({ onLeave }: { onLeave: () => void }) {
  const issues = checkReadiness().issues;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{issues ? `${issues} to check` : "Ready"}</CardTitle>
      </CardHeader>
      <ReadinessList onLeave={onLeave} />
    </Card>
  );
}
