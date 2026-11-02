/** Money is integer paise. Shown as ₹ with Indian grouping; paise appear only when there are some. */
const whole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const inr = (paise: number) => (paise % 100 === 0 ? whole : exact).format(paise / 100);

/** "1,250.50" or "1250" typed by a person -> paise. null when it is not a valid amount. */
export function parseRupees(raw: string): number | null {
  const s = raw.replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
/** Paise as the plain text an input shows ("1250" or "1250.50"). */
export const rupeesText = (paise: number) => (paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2));
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v * 10) / 10}%`);
