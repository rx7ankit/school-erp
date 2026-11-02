import type { ReactNode } from "react";
import { AwardIcon, CalendarCheckIcon, ChatIcon, GridIcon, RupeeIcon } from "@/components/icons";
import { AttendanceScene, FeesScene, MessagesScene, ResultsScene, TimetableScene } from "@/components/mockups/scenes";

/** Icon and product scene per feature id. Shared by the site and the presentation deck. */
export const FEATURE_ICONS: Record<string, typeof GridIcon> = {
  attendance: CalendarCheckIcon,
  fees: RupeeIcon,
  results: AwardIcon,
  messages: ChatIcon,
  timetable: GridIcon,
};

export function featureScene(id: string): ReactNode {
  switch (id) {
    case "attendance":
      return <AttendanceScene />;
    case "fees":
      return <FeesScene />;
    case "results":
      return <ResultsScene />;
    case "messages":
      return <MessagesScene />;
    default:
      return <TimetableScene />;
  }
}
