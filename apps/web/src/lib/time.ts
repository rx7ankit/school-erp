/**
 * Time rules (locked):
 *  - Moments (`*_at`) are stored and transported as UTC ISO strings.
 *  - Everything shown to a person is formatted in IST (Asia/Kolkata), never the device zone.
 *  - Calendar dates (`*_on`, "YYYY-MM-DD") are school-local dates and carry no zone.
 */
export const IST = "Asia/Kolkata";

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: IST, ...opts });

const F = {
  date: fmt({ day: "numeric", month: "short", year: "numeric" }),
  time: fmt({ hour: "numeric", minute: "2-digit", hour12: true }),
  datetime: fmt({ day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
  short: fmt({ day: "numeric", month: "short" }),
  weekday: fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }),
};

/** Format a UTC instant for display in IST. */
export function formatIST(utc: string | Date, style: "date" | "time" | "datetime" | "short" | "weekday" = "datetime"): string {
  const d = typeof utc === "string" ? new Date(utc) : utc;
  return F[style].format(d).replace(/\b(am|pm)\b/i, (m) => m.toLowerCase());
}

/** Format a plain calendar date ("2026-11-01"). No zone shift is applied. */
export function formatDateOn(dateOn: string, style: "date" | "short" | "weekday" = "date"): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    ...(style === "short"
      ? { day: "numeric", month: "short" }
      : style === "weekday"
        ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
        : { day: "numeric", month: "short", year: "numeric" }),
  }).format(new Date(`${dateOn}T00:00:00Z`));
}

/** Today's school date in IST as "YYYY-MM-DD". */
export function todayOnIST(now: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return p; // en-CA gives YYYY-MM-DD
}

/** Current instant, ready to store or send. */
export const nowUTC = () => new Date().toISOString();

/** Money is stored as integer paise. */
export const formatINR = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
