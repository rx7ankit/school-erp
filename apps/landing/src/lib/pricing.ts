/** Rs 10 per active student per month. Kept in one place so copy and examples never disagree. */
export const PRICE_PER_STUDENT_RUPEES = 10;

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Formats whole rupees the Indian way, e.g. 5000 -> "₹5,000", 250000 -> "₹2,50,000". */
export function formatRupees(amount: number): string {
  return `₹${inr.format(amount)}`;
}

export function monthlyBill(activeStudents: number): number {
  return activeStudents * PRICE_PER_STUDENT_RUPEES;
}
