import { jsPDF } from "jspdf";
import type { Certificate } from "./student-record";
import { formatDateOn } from "./time";

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const ORD = ["", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth", "Seventeenth", "Eighteenth", "Nineteenth", "Twentieth", "Twenty-first", "Twenty-second", "Twenty-third", "Twenty-fourth", "Twenty-fifth", "Twenty-sixth", "Twenty-seventh", "Twenty-eighth", "Twenty-ninth", "Thirtieth", "Thirty-first"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const below100 = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? "-" + ONES[n % 10].toLowerCase() : ""}`);
function yearInWords(y: number): string {
  const th = Math.floor(y / 1000), rest = y % 1000, h = Math.floor(rest / 100), t = rest % 100;
  return [th ? `${ONES[th]} Thousand` : "", h ? `${ONES[h]} Hundred` : "", t ? `${h || th ? "and " : ""}${below100(t)}` : ""].filter(Boolean).join(" ");
}
/** "2014-03-12" -> "Twelfth March Two Thousand and Fourteen" */
export function dateInWords(on: string): string {
  const [y, m, d] = on.split("-").map(Number);
  return `${ORD[d]} ${MONTHS[m - 1]} ${yearInWords(y)}`;
}

const TITLE = { transfer: "TRANSFER CERTIFICATE", bonafide: "BONAFIDE CERTIFICATE", character: "CHARACTER CERTIFICATE" } as const;

/** A4 one-page certificate, drawn from the stored snapshot so a reprint is identical to the original. */
export function downloadCertificate(cert: Certificate) {
  const s = cert.snapshot;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 22;
  const male = s.gender === "M";
  const he = male ? "He" : "She", his = male ? "his" : "her", child = male ? "son" : "daughter";

  doc.setDrawColor(150).setLineWidth(0.4).rect(10, 10, W - 20, 277);
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(20).text(s.school, W / 2, 34, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(100).text(s.city, W / 2, 42, { align: "center" });
  doc.setDrawColor(190).setLineWidth(0.3).line(M, 48, W - M, 48);

  doc.setTextColor(20).setFont("helvetica", "bold").setFontSize(17).text(TITLE[cert.kind], W / 2, 66, { align: "center" });
  const tw = doc.getTextWidth(TITLE[cert.kind]);
  doc.setLineWidth(0.5).setDrawColor(20).line(W / 2 - tw / 2, 68.5, W / 2 + tw / 2, 68.5);

  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90);
  doc.text(`No. ${cert.number}`, M, 82);
  doc.text(`Date: ${formatDateOn(cert.issuedOn)}`, W - M, 82, { align: "right" });

  doc.setFontSize(12).setTextColor(20);
  const para = (text: string, y: number) => { const lines = doc.splitTextToSize(text, W - 2 * M) as string[]; doc.text(lines, M, y, { lineHeightFactor: 1.7 }); return y + lines.length * 12 * 0.3528 * 1.7; };
  const who = `${s.studentName}, ${child} of ${s.guardian}`;
  let y = 98;

  if (cert.kind === "transfer") {
    y = para(`This is to certify that ${who}, Scholar No. ${s.scholarNo}, was a student of this school. The particulars below are correct as per the school records.`, y) + 4;
    const rows: [string, string][] = [
      ["Name of the pupil", s.studentName], ["Name of the guardian", s.guardian], ["Date of birth (in figures)", formatDateOn(s.dob)], ["Date of birth (in words)", dateInWords(s.dob)],
      ["Scholar number", s.scholarNo], ["Class last studied", `Class ${s.className}`], ["Date of admission", formatDateOn(s.admittedOn)],
      ["Date of leaving", s.leftOn ? formatDateOn(s.leftOn) : "-"], ["Reason for leaving", s.leavingReason ?? cert.reason], ["Conduct", s.conduct ?? "Good"],
    ];
    rows.forEach(([k, v], i) => {
      doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(100).text(`${i + 1}.  ${k}`, M, y);
      const lines = doc.splitTextToSize(v, 84) as string[];
      doc.setFont("helvetica", "bold").setTextColor(20).text(lines, M + 76, y);
      doc.setDrawColor(228).setLineWidth(0.2).line(M, y + 2.6 + (lines.length - 1) * 4.5, W - M, y + 2.6 + (lines.length - 1) * 4.5);
      y += 10 + (lines.length - 1) * 4.5;
    });
    doc.setFont("helvetica", "normal").setFontSize(12).setTextColor(20);
    para(`We wish ${male ? "him" : "her"} every success in the future.`, y + 6);
  } else if (cert.kind === "bonafide") {
    y = para(`This is to certify that ${who}, Scholar No. ${s.scholarNo}, is a bonafide student of this school studying in class ${s.className} during the academic year ${s.academicYear}.`, y) + 4;
    y = para(`${he} was admitted on ${formatDateOn(s.admittedOn)}. ${his[0].toUpperCase() + his.slice(1)} date of birth as per the school record is ${formatDateOn(s.dob)} (${dateInWords(s.dob)}).`, y) + 4;
    para(`This certificate is issued on request${s.purpose ? ` for the purpose of ${s.purpose.charAt(0).toLowerCase() + s.purpose.slice(1)}` : ""}.`, y);
  } else {
    y = para(`This is to certify that ${who}, Scholar No. ${s.scholarNo}, is a student of class ${s.className} of this school in the academic year ${s.academicYear}, and has been studying here since ${formatDateOn(s.admittedOn)}.`, y) + 4;
    y = para(`To the best of our knowledge ${he.toLowerCase()} bears a good moral character. ${his[0].toUpperCase() + his.slice(1)} conduct in the school has been ${(s.conduct ?? "Good").toLowerCase()}.`, y) + 4;
    para(`This certificate is issued on request${s.purpose ? ` for the purpose of ${s.purpose.charAt(0).toLowerCase() + s.purpose.slice(1)}` : ""}.`, y);
  }

  // Seal box and principal signature
  doc.setDrawColor(150).setLineWidth(0.3).rect(M, 232, 32, 32);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(130).text("Seal", M + 16, 249, { align: "center" });
  doc.setDrawColor(40).setLineWidth(0.3).line(W - M - 60, 255, W - M, 255);
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(20).text("Principal", W - M, 261, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110).text(s.school, W - M, 266, { align: "right" });

  doc.setFontSize(8.5).setTextColor(130).text(`Computer generated. Number ${cert.number}`, W / 2, 280, { align: "center" });
  doc.save(`${cert.number}.pdf`);
}
