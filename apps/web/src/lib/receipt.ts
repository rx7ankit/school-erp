import { jsPDF } from "jspdf";
import { SCHOOL, STUDENTS, className, type FeeMode, type FeePayment, type Invoice } from "./mock";
import { formatIST } from "./time";

export interface Receipt {
  no: string; school: string; city: string; student: string; className: string; scholarNo: string;
  invoiceNo: string; period: string; amountPaise: number; mode: FeeMode; reference?: string; at: string; receivedBy: string; balancePaise: number;
}
export const MODE_LABEL: Record<FeeMode | "online", string> = { cash: "Cash", cheque: "Cheque", upi: "UPI", bank_transfer: "Bank transfer", online: "Online" };

/**
 * Receipt for an invoice. Pass a FeePayment to get that instalment's receipt (its own number, amount, mode and time).
 * Without one, the receipt covers everything paid so far. The balance shown is the invoice's current balance.
 */
export function receiptFor(inv: Invoice, payment?: FeePayment | number, at?: string, receivedBy = "Suresh Tiwari"): Receipt {
  const s = STUDENTS.find((x) => x.id === inv.studentId)!;
  const base = { school: SCHOOL.name, city: SCHOOL.city, student: s.name, className: className(s.classId), scholarNo: s.scholarNo, invoiceNo: inv.no, period: inv.period, balancePaise: inv.totalPaise - inv.paidPaise };
  if (typeof payment === "object") {
    return { ...base, no: payment.receiptNo, amountPaise: payment.amountPaise, mode: payment.mode, reference: payment.reference, at: payment.at, receivedBy: payment.receivedBy };
  }
  return { ...base, no: `RCP-${inv.no.replace("INV-", "")}`, amountPaise: payment ?? inv.paidPaise, mode: inv.mode ?? "cash", at: at ?? inv.lastPaymentAt ?? new Date().toISOString(), receivedBy };
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`);
/** Indian numbering: crore, lakh, thousand. */
export function rupeesInWords(paise: number): string {
  let n = Math.floor(paise / 100);
  if (n === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  for (const [div, name] of [[10_000_000, "Crore"], [100_000, "Lakh"], [1000, "Thousand"]] as const) {
    const q = Math.floor(n / div); n %= div;
    if (q) parts.push(`${two(q)} ${name}`);
  }
  if (n >= 100) { parts.push(`${ONES[Math.floor(n / 100)]} Hundred`); n %= 100; }
  if (n) parts.push(two(n));
  return `${parts.join(" ")} Rupees Only`;
}

/** The PDF uses the built-in Helvetica, which has no rupee sign, so amounts print as "Rs." */
export const rs = (paise: number) => `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100)}`;

/** A5 PDF, drawn directly so it downloads instantly with no print dialog. */
export function downloadReceiptPdf(r: Receipt) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const W = 148, M = 14;
  doc.setFont("helvetica", "bold").setFontSize(16).text(r.school, M, 20);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110).text(r.city, M, 26);
  doc.setTextColor(0).setFont("helvetica", "bold").setFontSize(11).text("FEE RECEIPT", W - M, 20, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110).text(`No. ${r.no}`, W - M, 26, { align: "right" });
  doc.setDrawColor(210).line(M, 32, W - M, 32);

  const rows: [string, string][] = [
    ["Student", r.student], ["Class", r.className], ["Scholar no.", r.scholarNo], ["Invoice", `${r.invoiceNo} (${r.period})`],
    ["Date and time", `${formatIST(r.at)} IST`], ["Paid by", MODE_LABEL[r.mode] + (r.reference ? ` (${r.reference})` : "")], ["Received by", r.receivedBy],
  ];
  let y = 42;
  rows.forEach(([k, v]) => { doc.setFontSize(9).setTextColor(110).text(k, M, y); doc.setTextColor(0).setFont("helvetica", "bold").text(v, M + 38, y); doc.setFont("helvetica", "normal"); y += 8; });

  y += 4;
  doc.setFillColor(245, 245, 247).roundedRect(M, y, W - 2 * M, 28, 3, 3, "F");
  doc.setFontSize(9).setTextColor(110).text("Amount received", M + 6, y + 9);
  doc.setFontSize(20).setFont("helvetica", "bold").setTextColor(0).text(rs(r.amountPaise), M + 6, y + 20);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(110).text(rupeesInWords(r.amountPaise), W - M - 6, y + 20, { align: "right", maxWidth: 62 });
  y += 38;
  doc.setFontSize(9).setTextColor(110).text("Balance due", M, y); doc.setTextColor(0).setFont("helvetica", "bold").text(rs(r.balancePaise), M + 38, y);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(130).text("This is a computer generated receipt and needs no signature.", M, 196);
  doc.save(`${r.no}.pdf`);
}
