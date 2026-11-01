import { MAvatar, MBadge, MPanel, MStat, Mockup, MWindow } from "./parts";

type Payment = { receipt: string; name: string; cls: string; head: string; amount: string; mode: string; time: string };

const PAYMENTS: readonly Payment[] = [
  { receipt: "R-2041", name: "Priya Shukla", cls: "8-B", head: "Term 2 tuition", amount: "₹1,800", mode: "Cash", time: "10:21 am" },
  { receipt: "R-2040", name: "Aarav Tiwari", cls: "5-C", head: "Term 2 tuition", amount: "₹1,200", mode: "UPI", time: "10:04 am" },
  { receipt: "R-2039", name: "Ishita Pandey", cls: "10-A", head: "Tuition + Lab", amount: "₹2,400", mode: "Cheque", time: "9:47 am" },
  { receipt: "R-2038", name: "Kabir Singh", cls: "6-A", head: "Transport", amount: "₹600", mode: "Cash", time: "9:30 am" },
];

/** Fees table (offline collection recorded at the counter) with a receipt preview. */
export function FeesMockup() {
  return (
    <Mockup>
      <MWindow title="Fees · Collections">
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <MStat label="Received today" value="₹38,500" note="14 receipts" />
            <MStat label="Pending dues" value="₹2,14,000" note="Term 2" tone="warning" />
          </div>

          <div className="mt-2 grid gap-2 @lg:grid-cols-[1.4fr_1fr]">
            <MPanel title="Recorded payments" className="p-3">
              <div className="flex flex-col">
                {PAYMENTS.map((p) => (
                  <div key={p.receipt} className="flex items-center gap-2.5 rounded-[12px] px-1.5 py-2">
                    <MAvatar name={p.name} className="size-7 text-[10px]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold">{p.name}</p>
                      <p className="truncate text-[10px] text-text-tertiary">
                        {p.cls} · {p.head} · {p.time}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] font-bold tabular-nums">{p.amount}</p>
                      <p className="text-[10px] text-text-tertiary">{p.mode}</p>
                    </div>
                  </div>
                ))}
              </div>
            </MPanel>

            <MPanel className="flex flex-col gap-2.5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold">Receipt R-2041</p>
                <MBadge tone="success">Paid</MBadge>
              </div>
              <div className="rounded-[12px] bg-bg p-3 text-[11px]">
                <p className="font-semibold">Priya Shukla · Class 8-B</p>
                <div className="mt-2 flex justify-between text-text-secondary">
                  <span>Tuition, Term 2</span>
                  <span className="tabular-nums">₹1,500</span>
                </div>
                <div className="mt-1 flex justify-between text-text-secondary">
                  <span>Lab fee</span>
                  <span className="tabular-nums">₹300</span>
                </div>
                <div className="mt-2 flex justify-between pt-2 text-[12px] font-bold">
                  <span>Total received</span>
                  <span className="tabular-nums">₹1,800</span>
                </div>
              </div>
              <p className="text-[10px] text-text-tertiary">Received in cash at the school counter · 2 Nov 2026, 10:21 am IST</p>
            </MPanel>
          </div>
        </div>
      </MWindow>
    </Mockup>
  );
}
