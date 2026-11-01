import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Photo if one was uploaded, otherwise the initials avatar. */
export function StudentPhoto({ name, url, className }: { name: string; url?: string; className?: string }) {
  if (!url) return <Avatar name={name} className={cn("size-9", className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={`Photo of ${name}`} className={cn("size-9 shrink-0 rounded-full bg-fill object-cover", className)} />;
}
