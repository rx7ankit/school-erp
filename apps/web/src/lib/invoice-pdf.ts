import { jsPDF } from "jspdf";
import type { PlatformInvoiceOut } from "@/lib/api/types";

/** The PDF uses the built-in Helvetica, which has no rupee sign, so amounts print as "Rs." (same as the fee receipts). */
const rs = (paise: number) => `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100)}`;
const monthName = (ym: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${ym}-01T00:00:00Z`));
const day = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso));
const MODE: Record<string, string> = { cash: "Cash", upi: "UPI", bank_transfer: "Bank transfer", cheque: "Cheque", online: "Online" };

/** A short, readable number: KRV-202610-A1B2. */
export const invoiceNumber = (i: Pick<PlatformInvoiceOut, "id" | "month">) => `KRV-${i.month.replace("-", "")}-${i.id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;

/** One plain page: who it is for, one line of what was used, the total, and whether it is paid. Downloads straight away. */
export function downloadInvoicePdf(i: PlatformInvoiceOut) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 22, R = W - M;
  const ink = (v: number) => doc.setTextColor(v);
  const line = (y: number) => { doc.setDrawColor(225); doc.setLineWidth(0.3); doc.line(M, y, R, y); };
  const paid = i.status === "paid";

  // Header
  doc.setFont("helvetica", "bold").setFontSize(22); ink(20); doc.text("Krevo", M, 28);
  doc.setFont("helvetica", "normal").setFontSize(9.5); ink(120); doc.text("School software  ·  krevo.tech", M, 34);
  doc.setFont("helvetica", "bold").setFontSize(11); ink(20); doc.text("INVOICE", R, 28, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9.5); ink(120); doc.text(invoiceNumber(i), R, 34, { align: "right" });
  line(44);

  // Bill to + dates
  doc.setFontSize(8.5); ink(130); doc.text("BILLED TO", M, 56); doc.text("PERIOD", 100, 56); doc.text("DUE", R, 56, { align: "right" });
  doc.setFont("helvetica", "bold").setFontSize(12.5); ink(20); doc.text(i.school_name, M, 64, { maxWidth: 70 });
  doc.text(monthName(i.month), 100, 64);
  doc.text(day(i.due_on), R, 64, { align: "right" });

  // One line item
  let y = 92;
  doc.setFont("helvetica", "bold").setFontSize(8.5); ink(130);
  doc.text("DESCRIPTION", M, y); doc.text("STUDENTS", 118, y, { align: "right" }); doc.text("RATE", 150, y, { align: "right" }); doc.text("AMOUNT", R, y, { align: "right" });
  y += 4; line(y); y += 9;
  doc.setFont("helvetica", "normal").setFontSize(11); ink(20);
  doc.text(`Krevo school software, ${monthName(i.month)}`, M, y);
  doc.text(String(i.active_students), 118, y, { align: "right" });
  doc.text(rs(i.price_per_student_paise), 150, y, { align: "right" });
  doc.text(rs(i.amount_paise), R, y, { align: "right" });
  y += 7; doc.setFontSize(9); ink(130); doc.text("Per student, per month. Students who have left are not counted.", M, y);
  y += 8; line(y);

  // Total
  y += 16;
  doc.setFont("helvetica", "normal").setFontSize(10); ink(120); doc.text(paid ? "Total paid" : "Total due", R - 62, y);
  doc.setFont("helvetica", "bold").setFontSize(22); ink(20); doc.text(rs(i.amount_paise), R, y + 1, { align: "right" });

  // Status
  y += 22;
  doc.setFont("helvetica", "bold").setFontSize(10); ink(20);
  if (paid) {
    doc.text("PAID", M, y);
    doc.setFont("helvetica", "normal").setFontSize(10); ink(110);
    const how = [i.paid_at ? day(i.paid_at) : "", MODE[i.payment_mode ?? ""] ?? i.payment_mode ?? "", i.reference ?? ""].filter(Boolean).join("  ·  ");
    doc.text(how, M + 16, y);
  } else {
    doc.text("PAYMENT", M, y);
    doc.setFont("helvetica", "normal").setFontSize(10); ink(110);
    doc.text(`Please pay by ${day(i.due_on)} and quote ${invoiceNumber(i)}.`, M, y + 7);
  }

  // Footer
  line(262);
  doc.setFont("helvetica", "normal").setFontSize(9); ink(130);
  doc.text("Thank you.", M, 270);
  doc.text("hello@krevo.tech  ·  krevo.tech", R, 270, { align: "right" });

  doc.save(`${invoiceNumber(i)}-${i.school_name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`);
}
