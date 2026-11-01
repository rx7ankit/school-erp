/** Demo platform data for the owner portal. Sample data only. Money in paise, `*_at` in UTC, `*_on` IST dates. */
export type SchoolStatus = "trial" | "active" | "suspended";
export interface School {
  id: string; name: string; city: string; students: number; status: SchoolStatus; pricePaise: number;
  adminName: string; adminEmail: string; createdAt: string; inviteSentAt?: string; adminLoggedIn: boolean;
}
export const DEFAULT_PRICE_PAISE = 1000; // Rs 10 per student per month

export const SCHOOLS: School[] = [
  { id: "sc1", name: "Rewa Public School", city: "Rewa", students: 612, status: "active", pricePaise: 1000, adminName: "Meera Rao", adminEmail: "principal@rewapublic.example", createdAt: "2026-01-12T05:00:00Z", inviteSentAt: "2026-01-12T05:10:00Z", adminLoggedIn: true },
  { id: "sc2", name: "Saraswati Vidya Mandir", city: "Satna", students: 840, status: "active", pricePaise: 1000, adminName: "Ramesh Dwivedi", adminEmail: "admin@svm.example", createdAt: "2026-02-03T06:00:00Z", inviteSentAt: "2026-02-03T06:20:00Z", adminLoggedIn: true },
  { id: "sc3", name: "St. Joseph Academy", city: "Rewa", students: 455, status: "active", pricePaise: 1000, adminName: "Fr. Thomas", adminEmail: "office@stjoseph.example", createdAt: "2026-03-18T04:30:00Z", inviteSentAt: "2026-03-18T04:40:00Z", adminLoggedIn: true },
  { id: "sc4", name: "Vindhya Valley School", city: "Rewa", students: 380, status: "active", pricePaise: 1000, adminName: "Anjali Singh", adminEmail: "head@vvs.example", createdAt: "2026-04-22T07:00:00Z", inviteSentAt: "2026-04-22T07:05:00Z", adminLoggedIn: true },
  { id: "sc5", name: "Modern Convent School", city: "Sidhi", students: 520, status: "active", pricePaise: 1000, adminName: "Pradeep Tiwari", adminEmail: "mcs@example.in", createdAt: "2026-06-09T05:30:00Z", inviteSentAt: "2026-06-09T05:45:00Z", adminLoggedIn: true },
  { id: "sc6", name: "Little Flower School", city: "Satna", students: 295, status: "active", pricePaise: 1000, adminName: "Sr. Mary", adminEmail: "lfs@example.in", createdAt: "2026-08-14T06:15:00Z", inviteSentAt: "2026-08-14T06:30:00Z", adminLoggedIn: true },
  { id: "sc7", name: "Gyan Ganga Public School", city: "Rewa", students: 710, status: "active", pricePaise: 1000, adminName: "Suresh Pandey", adminEmail: "ggps@example.in", createdAt: "2026-09-02T05:00:00Z", inviteSentAt: "2026-09-02T05:10:00Z", adminLoggedIn: true },
  { id: "sc8", name: "Shiv Nagar Vidyalaya", city: "Rewa", students: 240, status: "trial", pricePaise: 1000, adminName: "Kamla Shukla", adminEmail: "snv@example.in", createdAt: "2026-10-24T08:00:00Z", inviteSentAt: "2026-10-24T08:10:00Z", adminLoggedIn: false },
  { id: "sc9", name: "Ganga Jamuna Academy", city: "Mauganj", students: 330, status: "suspended", pricePaise: 1000, adminName: "Vinod Kushwaha", adminEmail: "gja@example.in", createdAt: "2026-05-05T05:00:00Z", inviteSentAt: "2026-05-05T05:20:00Z", adminLoggedIn: true },
];

export const billable = (s: School) => (s.status === "active" ? s.students * s.pricePaise : 0);

/** Last 12 months of recurring revenue, ending with the current figure. */
export function mrrSeries(currentPaise: number, todayOn: string) {
  const [y, m] = todayOn.split("-").map(Number);
  const growth = [0.22, 0.3, 0.38, 0.44, 0.52, 0.6, 0.67, 0.75, 0.82, 0.88, 0.94, 1];
  return growth.map((g, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    return { label: new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "short" }).format(d), ym: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, paise: Math.round((currentPaise * g) / 1000) * 1000 };
  });
}

export interface PlatformInvoice { id: string; schoolId: string; ym: string; students: number; amountPaise: number; status: "due" | "paid"; paidAt?: string; }
export function invoicesFor(school: School, todayOn: string): PlatformInvoice[] {
  if (school.status === "trial") return [];
  const [y, m] = todayOn.split("-").map(Number);
  return [0, 1, 2].map((back) => {
    const d = new Date(Date.UTC(y, m - 2 - back, 1)); // previous completed months
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const students = Math.round(school.students * (1 - back * 0.03));
    const paid = back > 0 || school.status === "active" && Number(school.id.replace("sc", "")) % 3 !== 0;
    return { id: `${school.id}-${ym}`, schoolId: school.id, ym, students, amountPaise: students * school.pricePaise, status: paid ? "paid" : "due", paidAt: paid ? `${ym}-07T06:00:00Z` : undefined };
  });
}
