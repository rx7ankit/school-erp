"use client";
import { ConcessionCarry, DuesChoice, FirstInvoices } from "./fee-policies";
import { FeeGrid } from "./fee-grid";
import type { StepProps } from "./step-props";

export function StepFees(props: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <FeeGrid {...props} />
      <ConcessionCarry {...props} />
      <DuesChoice {...props} />
      <FirstInvoices {...props} />
    </div>
  );
}
