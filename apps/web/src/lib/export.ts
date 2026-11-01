import writeExcelFile from "write-excel-file/browser";

export type Cell = string | number | null;
export interface Sheet { name: string; headers: string[]; rows: Cell[][]; widths?: number[]; }

/**
 * Download one or more sheets as an .xlsx file.
 * Rules: dates as readable IST text, money as numbers in rupees, no formulas.
 */
export async function exportXlsx(fileName: string, sheets: Sheet[]) {
  const payload = sheets.map((s) => ({
    sheet: s.name.slice(0, 31),
    data: [
      s.headers.map((h) => ({ value: h, fontWeight: "bold" as const, backgroundColor: "#F5F5F7" })),
      ...s.rows.map((r) => r.map((c) => (c === null ? null : typeof c === "number" ? { value: c, type: Number } : { value: c, type: String }))),
    ],
    columns: (s.widths ?? s.headers.map((h) => Math.max(12, h.length + 4))).map((width) => ({ width })),
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await writeExcelFile(payload as any).toFile(`${fileName}.xlsx`);
}

/** Rupees from paise, for number cells. */
export const rupees = (paise: number) => Math.round(paise) / 100;
