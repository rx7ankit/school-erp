import { jsPDF } from "jspdf";
import type { PlatformInvoiceOut } from "@/lib/api/types";

/** The PDF uses the built-in Helvetica, which has no rupee sign, so amounts print as "Rs." (same as the fee receipts). */
const rs = (paise: number) => `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100)}`;
const monthName = (ym: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${ym}-01T00:00:00Z`));
const day = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso));
const MODE: Record<string, string> = { cash: "Cash", upi: "UPI", bank_transfer: "Bank transfer", cheque: "Cheque", online: "Online" };

/** The Krevo logo (S mark + wordmark), the same artwork as the site. Drawn to a PNG in the browser, since jsPDF cannot read SVG. */
const logoSvg = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="859" height="285" viewBox="120 80 859 285"><g fill="${fill}">
    <path d="M213 88V262A87 87 0 0 1 213 88Z"/>
    <path d="M222 88H310A88 87 0 0 1 398 175H310C262 175 222 150 222 125Z"/>
    <g transform="rotate(180 261.5 222.5)">
      <path d="M213 88V262A87 87 0 0 1 213 88Z"/>
      <path d="M222 88H310A88 87 0 0 1 398 175H310C262 175 222 150 222 125Z"/>
    </g>
  </g>
  <path fill="${fill}" d="M500.52 293.28L474.68 293.28L474.68 151.73L500.52 151.73L500.52 214.62L553.72 151.73L586.21 151.73L537.19 209.87L587.92 293.28L557.52 293.28L519.52 230.96L500.52 253.57L500.52 293.28M620.79 293.28L595.90 293.28L595.90 189.92L619.27 189.92L619.27 204.55Q622.69 196.76 628.77 193.34Q636.37 188.78 647.20 188.78L653.28 188.78L653.28 210.82L644.35 210.82Q633.71 210.82 627.25 217.37Q620.79 223.93 620.79 235.71L620.79 293.28M710.28 295.56Q694.32 295.56 682.35 288.34Q670.38 281.12 663.73 268.77Q657.08 256.42 657.08 241.41Q657.08 225.83 663.82 213.76Q670.57 201.70 682.25 194.67Q693.94 187.64 708.38 187.64Q720.54 187.64 729.75 191.63Q738.97 195.62 745.43 202.65Q751.89 209.68 755.31 218.70Q758.73 227.73 758.73 238.18Q758.73 240.84 758.44 243.69Q758.16 246.54 757.40 248.63L682.92 248.63Q683.49 253.95 685.58 258.32Q688.81 265.73 695.37 269.72Q701.92 273.71 710.47 273.71Q719.02 273.71 725 270.10Q730.99 266.49 734.41 260.41L754.55 270.29Q751.51 277.70 745.05 283.40Q738.59 289.10 729.75 292.33Q720.92 295.56 710.28 295.56M683.49 229.63L732.13 229.63Q731.94 226.02 730.80 222.98Q728.14 216.14 722.34 212.15Q716.55 208.16 708.38 208.16Q700.59 208.16 694.51 212.05Q688.43 215.95 685.39 223.36Q684.06 226.40 683.49 229.63M823.14 293.28L801.10 293.28L760.44 189.92L787.61 189.92L812.12 257.37L836.63 189.92L863.80 189.92L823.14 293.28M920.42 295.56Q905.22 295.56 892.77 288.53Q880.33 281.50 873.01 269.34Q865.70 257.18 865.70 241.60Q865.70 226.02 873.01 213.86Q880.33 201.70 892.68 194.67Q905.03 187.64 920.42 187.64Q935.62 187.64 947.97 194.67Q960.32 201.70 967.63 213.76Q974.95 225.83 974.95 241.60Q974.95 257.18 967.54 269.34Q960.13 281.50 947.78 288.53Q935.43 295.56 920.42 295.56M920.42 272.76Q928.78 272.76 935.14 268.77Q941.51 264.78 945.21 257.65Q948.92 250.53 948.92 241.60Q948.92 232.48 945.21 225.54Q941.51 218.61 935.14 214.52Q928.78 210.44 920.42 210.44Q911.87 210.44 905.41 214.52Q898.95 218.61 895.25 225.54Q891.54 232.48 891.54 241.60Q891.54 250.53 895.25 257.65Q898.95 264.78 905.41 268.77Q911.87 272.76 920.42 272.76"/></svg>`;
async function logoPng(fill: string, widthPx: number): Promise<string> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg(fill))}`;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = widthPx; c.height = Math.round((widthPx * 285) / 859);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

/** A short, readable number: KRV-202610-A1B2. */
export const invoiceNumber = (i: Pick<PlatformInvoiceOut, "id" | "month">) => `KRV-${i.month.replace("-", "")}-${i.id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;

/** Dots that fade out toward the edges, like the footer on the site. */
function dotBand(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const gap = 5, cx = x + w / 2, cy = y + h / 2;
  for (let py = y + gap / 2; py < y + h; py += gap) {
    for (let px = x + gap / 2; px < x + w; px += gap) {
      const d = Math.hypot((px - cx) / (w / 2), (py - cy) / (h / 2));
      if (d > 1) continue;
      const g = Math.round(206 + d * 40); // darker in the middle, almost white at the edge
      doc.setFillColor(g, g, g + 2); doc.circle(px, py, 0.38, "F");
    }
  }
}

/** One plain A4 page with the Krevo branding: logo on top, dotted footer with the big grey wordmark. Downloads straight away. */
export async function downloadInvoicePdf(i: PlatformInvoiceOut) {
  const [logoDark, logoGrey] = await Promise.all([logoPng("#1D1D1F", 900), logoPng("#E3E3E8", 1800)]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 22, R = W - M;
  const ink = (v: number) => doc.setTextColor(v);
  const line = (y: number) => { doc.setDrawColor(225); doc.setLineWidth(0.3); doc.line(M, y, R, y); };
  const paid = i.status === "paid";

  // Footer artwork first, so everything else sits on top: dots, then the big grey wordmark.
  dotBand(doc, 0, 238, W, 59);
  doc.addImage(logoGrey, "PNG", (W - 98) / 2, 252, 98, (98 * 285) / 859);

  // Header: the logo, and what this is
  doc.addImage(logoDark, "PNG", M, 19, 34, (34 * 285) / 859);
  doc.setFont("helvetica", "bold").setFontSize(11); ink(20); doc.text("INVOICE", R, 26, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9.5); ink(120); doc.text(invoiceNumber(i), R, 32, { align: "right" });
  line(42);

  // Bill to + dates
  doc.setFont("helvetica", "normal").setFontSize(8.5); ink(130); doc.text("BILLED TO", M, 54); doc.text("PERIOD", 100, 54); doc.text("DUE", R, 54, { align: "right" });
  doc.setFont("helvetica", "bold").setFontSize(12.5); ink(20); doc.text(i.school_name, M, 62, { maxWidth: 70 });
  doc.text(monthName(i.month), 100, 62);
  doc.text(day(i.due_on), R, 62, { align: "right" });

  // One line item
  let y = 90;
  doc.setFont("helvetica", "bold").setFontSize(8.5); ink(130);
  doc.text("DESCRIPTION", M, y); doc.text("USERS", 118, y, { align: "right" }); doc.text("RATE", 150, y, { align: "right" }); doc.text("AMOUNT", R, y, { align: "right" });
  y += 4; line(y); y += 9;
  doc.setFont("helvetica", "normal").setFontSize(11); ink(20);
  doc.text(`Krevo school software, ${monthName(i.month)}`, M, y);
  doc.text(String(i.active_students), 118, y, { align: "right" });
  doc.text(rs(i.price_per_student_paise), 150, y, { align: "right" });
  doc.text(rs(i.amount_paise), R, y, { align: "right" });
  y += 7; doc.setFontSize(9); ink(130); doc.text("Per user, per month. Users who have left are not counted.", M, y);
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

  // Footer line above the artwork
  line(226);
  doc.setFont("helvetica", "normal").setFontSize(9); ink(120);
  doc.text("Thank you.", M, 233);
  doc.text("hello@krevo.tech  ·  krevo.tech", R, 233, { align: "right" });

  doc.save(`${invoiceNumber(i)}-${i.school_name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`);
}
