import * as React from "react";
import { todayOnIST } from "./time";

/** Today's IST school date. Empty string during server render, so the page never mismatches. */
export function useTodayIST(): string {
  return React.useSyncExternalStore(() => () => {}, () => todayOnIST(), () => "");
}
