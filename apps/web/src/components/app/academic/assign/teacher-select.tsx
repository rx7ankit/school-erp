"use client";
import { Spinner } from "@/components/ui/spinner";
import { NativeSelect } from "@/components/ui/native-select";
import { classTeacherOfClasses, staffHint } from "@/lib/assignments";
import { STAFF, className } from "@/lib/mock";

/** Staff dropdown. Shows the department as a hint and who is already a class teacher elsewhere. */
export function TeacherSelect({ label, value, onChange, busy, suggestFor, forClassTeacher, classId }: {
  label: string; value: string; onChange: (staffId: string) => void; busy?: boolean; suggestFor?: string; forClassTeacher?: boolean; classId: string;
}) {
  const note = (id: string) => {
    if (!forClassTeacher) return "";
    const other = classTeacherOfClasses(id).filter((c) => c !== classId);
    return other.length ? `, class teacher of ${other.map(className).join(", ")}` : "";
  };
  const opt = (s: (typeof STAFF)[number]) => <option key={s.id} value={s.id}>{s.name} ({staffHint(s)}{note(s.id)})</option>;
  const match = suggestFor ? STAFF.filter((s) => s.department.toLowerCase() === suggestFor.toLowerCase() || s.designation.toLowerCase().startsWith(suggestFor.toLowerCase())) : [];
  const rest = STAFF.filter((s) => !match.includes(s));
  return (
    <div className="flex items-center gap-2">
      <NativeSelect aria-label={label} className="min-w-0 flex-1" value={value} disabled={busy} onChange={(e) => onChange(e.target.value)}>
        <option value="">Not assigned</option>
        {match.length > 0 ? <><optgroup label={`${suggestFor} staff`}>{match.map(opt)}</optgroup><optgroup label="Other staff">{rest.map(opt)}</optgroup></> : STAFF.map(opt)}
      </NativeSelect>
      <span className="grid size-5 shrink-0 place-items-center text-muted-foreground" aria-live="polite">{busy && <Spinner />}</span>
    </div>
  );
}
