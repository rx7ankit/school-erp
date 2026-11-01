import { Lock } from "lucide-react";
import { EmptyState } from "./empty-state";

export function NoAccess({ need }: { need: string }) {
  return <EmptyState icon={Lock} title="You do not have access to this page" text={`This needs ${need}. Ask the principal to update your permissions.`} />;
}
