/**
 * Time rules (locked):
 *  - Moments (`*_at`) are stored and transported as UTC ISO strings.
 *  - Everything shown to a person is formatted in IST (Asia/Kolkata), never the device zone.
 *  - Calendar dates (`*_on`, "YYYY-MM-DD") are school-local dates and carry no zone.
 */
export const IST = "Asia/Kolkata";

/** Only the parent portal has Hindi. Numerals stay Western in both (`-u-nu-latn`). */
const LOCALES = { en: "en-IN", hi: "hi-IN" } as const;
type Lang = keyof typeof LOCALES;
const cache = new Map<string, Intl.DateTimeFormat>();
const fmt = (key: string, opts: Intl.DateTimeFormatOptions, tz: string = IST, lang: Lang = "en") => {
  const locale = LOCALES[lang];
  const k = `${locale}|${tz}|${key}`;
  let f = cache.get(k);
  if (!f) { f = new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { timeZone: tz, ...opts }); cache.set(k, f); }
  return f;
};
const STYLES: Record<string, Intl.DateTimeFormatOptions> = {
  date: { day: "numeric", month: "short", year: "numeric" },
  time: { hour: "numeric", minute: "2-digit", hour12: true },
  datetime: { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true },
  short: { day: "numeric", month: "short" },
  weekday: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
};

/** Format a UTC instant for display in IST. */
export function formatIST(utc: string | Date, style: "date" | "time" | "datetime" | "short" | "weekday" = "datetime", lang: Lang = "en"): string {
  const d = typeof utc === "string" ? new Date(utc) : utc;
  const out = fmt(style, STYLES[style], IST, lang).format(d);
  return out.replace(/\b(am|pm)\b/i, (m) => m.toLowerCase());
}

/** Format a plain calendar date ("2026-11-01"). No zone shift is applied. */
export function formatDateOn(dateOn: string, style: "date" | "short" | "weekday" = "date", lang: Lang = "en"): string {
  return fmt(`on-${style}`, STYLES[style === "date" ? "date" : style], "UTC", lang).format(new Date(`${dateOn}T00:00:00Z`));
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
