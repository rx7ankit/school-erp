import { Section } from "@/components/section";
import { WHO_HEAD } from "@/lib/content";
import { ParentBlock } from "./parent-app";
import { RolesGrid } from "./roles";

/** Who it's for and how it helps: owners, teachers, parents, then the parent app. */
export function Who() {
  return (
    <Section id="who" title={WHO_HEAD.title} dim={WHO_HEAD.dim} line={WHO_HEAD.line}>
      <RolesGrid />
      <ParentBlock />
    </Section>
  );
}
