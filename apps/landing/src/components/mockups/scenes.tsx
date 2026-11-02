import { BellIcon, CheckIcon, ChatIcon, ClockIcon, ReceiptIcon, SendIcon, AwardIcon } from "@/components/icons";
import { CountUp } from "@/components/in-view";
import { Avatar, Bar, Bars, Chip, Pill, Ring, Stage, Tile, Win } from "./kit";

const Dot = () => <i className="size-[0.6em] rounded-full bg-current" />;
const Title = ({ children, sub }: { children: React.ReactNode; sub?: string }) => (
  <div>
    <div className="text-[1.9em] font-bold leading-tight tracking-[-0.035em]">{children}</div>
    {sub ? <div className="mt-[0.2em] text-[1.2em] text-text-secondary">{sub}</div> : null}
  </div>
);

/* ---------------------------------------------------------------- Attendance */
const ATT: Array<[string, "P" | "H" | "A"]> = [
  ["Aarav Sharma", "P"],
  ["Diya Patel", "P"],
  ["Kabir Singh", "A"],
  ["Ishita Verma", "H"],
];

export function AttendanceScene() {
  return (
    <Stage>
      <Win x={4} y={6} w={37}>
        <div className="flex items-start justify-between px-[1.8em] pt-[1.7em]">
          <Title sub="Mon, 2 Nov · 40 students">Class 8-B</Title>
          <Pill tone="success">
            <Dot /> Saved
          </Pill>
        </div>
        <div className="mt-[1.4em] grid grid-cols-3 gap-[0.8em] px-[1.8em]">
          {[
            ["Present", 36, "text-text"],
            ["Half-day", 2, "text-text"],
            ["Absent", 2, "text-danger"],
          ].map(([label, n, c]) => (
            <div key={label as string} className="rounded-[1.5em] bg-card p-[1em]">
              <div className="text-[1.1em] text-text-secondary">{label}</div>
              <div className={`text-[2.3em] font-bold leading-none ${c}`}>
                <CountUp to={n as number} />
              </div>
            </div>
          ))}
        </div>
        <ul className="mt-[1.2em] pb-[1.2em]">
          {ATT.map(([name, s]) => (
            <li key={name} className="mx-[1.2em] flex items-center gap-[1em] rounded-[1.4em] px-[0.6em] py-[0.8em] odd:bg-card/70">
              <Avatar name={name} />
              <span className="flex-1 text-[1.45em] font-semibold">{name}</span>
              <span className="flex gap-[0.5em]">
                {(["P", "H", "A"] as const).map((k) => (
                  <span
                    key={k}
                    className={`grid size-[2.9em] place-items-center rounded-full text-[1.1em] font-bold ${
                      s === k ? (k === "P" ? "bg-solid text-on-solid" : k === "H" ? "bg-accent text-on-accent" : "bg-danger text-white") : "bg-fill text-text-tertiary"
                    }`}
                  >
                    {k}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Win>
      <Chip at={{ right: 2, top: 3.5 }} delay={600} par={26}>
        <div className="flex items-center gap-[1em]">
          <Tile className="size-[3.6em]">
            <BellIcon className="size-[1.9em]" />
          </Tile>
          <div>
            <div className="text-[1.9em] font-bold leading-none">
              <CountUp to={38} />
            </div>
            <div className="mt-[0.3em] text-[1.15em] text-text-secondary">parents notified</div>
          </div>
        </div>
      </Chip>
      <Chip at={{ right: 3.5, bottom: 4 }} delay={900} par={-24} floatSpeed={8}>
        <div className="flex items-center gap-[1em]">
          <Ring value={94} className="size-[5.4em]">
            <span className="text-[1.35em] font-bold">94%</span>
          </Ring>
          <div>
            <div className="text-[1.5em] font-bold leading-tight">This term</div>
            <div className="text-[1.15em] text-text-secondary">Class average</div>
          </div>
        </div>
      </Chip>
    </Stage>
  );
}

/* ---------------------------------------------------------------- Fees */
export function FeesScene() {
  return (
    <Stage>
      <Win x={3} y={4} w={35}>
        <div className="flex items-center gap-[1em] px-[1.8em] py-[1.4em]">
          <Avatar name="Priya Shukla" />
          <div className="flex-1">
            <div className="text-[1.6em] font-bold leading-tight">Priya Shukla</div>
            <div className="text-[1.15em] text-text-secondary">Class 8-B · Term 2</div>
          </div>
          <Pill>Due</Pill>
        </div>
        <div className="px-[1.8em] pt-[1.6em]">
          <div className="text-[1.15em] text-text-secondary">Amount to collect</div>
          <div className="text-[4.6em] font-bold leading-[1.05] tracking-[-0.03em]">
            <CountUp prefix="₹" to={1800} />
          </div>
          <div className="mt-[1em] space-y-[0.7em] text-[1.3em]">
            {[
              ["Tuition", "₹1,500"],
              ["Lab fee", "₹300"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between rounded-[1.3em] bg-card px-[1.1em] py-[0.9em]">
                <span className="text-text-secondary">{k}</span>
                <span className="font-bold">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-[1.4em] grid grid-cols-3 gap-[0.6em] text-[1.25em] font-semibold">
            {["Cash", "UPI", "Cheque"].map((m) => (
              <span key={m} className={`grid h-[2.7em] place-items-center rounded-full ${m === "UPI" ? "bg-solid text-on-solid" : "bg-card text-text-secondary"}`}>
                {m}
              </span>
            ))}
          </div>
          <div className="my-[1.6em] grid h-[3.4em] place-items-center rounded-full bg-solid text-[1.45em] font-bold text-on-solid">Record payment</div>
        </div>
      </Win>
      <Chip at={{ right: 2, top: 4 }} delay={650} par={26}>
        <div className="flex items-center gap-[1em]">
          <Tile tone="success" className="size-[3.6em]">
            <CheckIcon className="size-[2em]" />
          </Tile>
          <div>
            <div className="text-[1.5em] font-bold leading-tight">Receipt R-2041</div>
            <div className="text-[1.15em] text-text-secondary">Paid · ₹1,800 · PDF sent</div>
          </div>
        </div>
      </Chip>
      <Chip at={{ right: 3.5, bottom: 4.5 }} delay={950} par={-24} floatSpeed={8.5} className="w-[19em]">
        <div className="flex items-center justify-between">
          <span className="text-[1.15em] text-text-secondary">Dues this term</span>
          <ReceiptIcon className="size-[1.7em] text-text-tertiary" />
        </div>
        <div className="mt-[0.2em] text-[2.6em] font-bold leading-tight">
          <CountUp prefix="₹" to={42600} />
        </div>
        <Bars className="mt-[0.8em] h-[4.4em]" values={[48, 72, 40, 90, 64, 30, 56]} hi={3} />
      </Chip>
    </Stage>
  );
}

/* ---------------------------------------------------------------- Results */
const MARKS: Array<[string, number]> = [
  ["Mathematics", 92],
  ["Science", 88],
  ["English", 90],
  ["Hindi", 81],
];

export function ResultsScene() {
  return (
    <Stage>
      <Win x={5} y={5} w={37}>
        <div className="flex items-start justify-between px-[1.8em] pt-[1.7em]">
          <Title sub="Half-yearly · Class 8-B">Priya Shukla</Title>
          <Pill>Draft</Pill>
        </div>
        <ul className="mt-[1.2em] space-y-[1.3em] px-[1.8em]">
          {MARKS.map(([s, m], i) => (
            <li key={s}>
              <div className="mb-[0.5em] flex justify-between text-[1.35em]">
                <span className="font-semibold">{s}</span>
                <span className="font-bold tabular-nums">{m}</span>
              </div>
              <Bar pct={m} delay={400 + i * 110} color={m === 92 ? "bg-accent" : "bg-[#2a2a2c]"} />
            </li>
          ))}
        </ul>
        <div className="mt-[1.6em] flex items-center justify-between bg-card px-[1.8em] py-[1.4em]">
          <div>
            <div className="text-[1.1em] text-text-secondary">Total</div>
            <div className="text-[2.8em] font-bold leading-none">
              <CountUp to={87} suffix="%" />
            </div>
          </div>
          <div className="grid h-[3.4em] place-items-center rounded-full bg-solid px-[1.6em] text-[1.35em] font-bold text-on-solid">Publish to parents</div>
        </div>
      </Win>
      <Chip at={{ right: 2, top: 7 }} delay={650} par={26}>
        <div className="flex items-center gap-[1em]">
          <Tile className="size-[3.6em]">
            <AwardIcon className="size-[2em]" />
          </Tile>
          <div>
            <div className="text-[1.9em] font-bold leading-none">Grade A</div>
            <div className="mt-[0.3em] text-[1.15em] text-text-secondary">Rank 3 of 40</div>
          </div>
        </div>
      </Chip>
      <Chip at={{ left: 2.5, bottom: 1.2 }} delay={950} par={-12} floatSpeed={8}>
        <div className="flex items-center gap-[0.9em] text-[1.3em] font-semibold">
          <Tile tone="success" className="size-[2.4em]">
            <CheckIcon className="size-[1.4em]" />
          </Tile>
          Seen by 38 parents
        </div>
      </Chip>
    </Stage>
  );
}

/* ---------------------------------------------------------------- Messages */
export function MessagesScene() {
  return (
    <Stage>
      <Win x={4} y={5} w={36}>
        <div className="flex items-center gap-[1em] px-[1.8em] py-[1.4em]">
          <span className="flex -space-x-[0.8em]">
            {["Aarav Sharma", "Diya Patel", "Kabir Singh"].map((n) => (
              <Avatar key={n} name={n} tone="grey" className="ring-[0.25em] ring-bg" />
            ))}
          </span>
          <div className="flex-1">
            <div className="text-[1.6em] font-bold leading-tight">Class 8-B parents</div>
            <div className="text-[1.15em] text-text-secondary">Mathematics · 40 parents</div>
          </div>
        </div>
        <div className="space-y-[1.2em] px-[1.8em] py-[1.8em]">
          <div className="ml-auto w-[88%] rounded-[1.8em] rounded-br-[0.5em] bg-solid p-[1.2em] text-on-solid">
            <div className="text-[1.4em] font-semibold leading-snug">Chapter 7 test on Wednesday. Please revise the exercises.</div>
            <div className="mt-[0.7em] flex items-center justify-end gap-[0.5em] text-[1.05em] text-on-solid/70">
              9:15 am · Delivered to 40 <CheckIcon className="size-[1.4em]" />
            </div>
          </div>
          <div className="w-[72%] rounded-[1.8em] rounded-bl-[0.5em] bg-card p-[1.2em]">
            <div className="text-[1.05em] font-semibold text-text-secondary">Mrs. Shukla</div>
            <div className="mt-[0.2em] text-[1.4em] font-semibold">Thank you, ma&apos;am!</div>
          </div>
          <div className="flex w-max items-center gap-[0.5em] rounded-[1.8em] rounded-bl-[0.5em] bg-card px-[1.4em] py-[1.1em]">
            {[0, 1, 2].map((i) => (
              <i key={i} className="dotblink size-[0.8em] rounded-full bg-text-tertiary" style={{ animationDelay: `${i * 0.18}s` }} />
            ))}
          </div>
        </div>
        <div className="mx-[1.8em] mb-[1.8em] flex items-center gap-[1em] rounded-full bg-card py-[0.7em] pl-[1.5em] pr-[0.7em]">
          <span className="flex-1 text-[1.3em] text-text-tertiary">Write to parents</span>
          <span className="grid size-[3.2em] place-items-center rounded-full bg-solid text-on-solid">
            <SendIcon className="size-[1.7em]" />
          </span>
        </div>
      </Win>
      <Chip at={{ right: 2, top: 7 }} delay={650} par={26}>
        <div className="flex items-center gap-[1em]">
          <Tile tone="success" className="size-[3.6em]">
            <ChatIcon className="size-[1.9em]" />
          </Tile>
          <div>
            <div className="text-[1.9em] font-bold leading-none">
              <CountUp to={40} />
              <span className="text-text-tertiary">/40</span>
            </div>
            <div className="mt-[0.3em] text-[1.15em] text-text-secondary">parents reached</div>
          </div>
        </div>
      </Chip>
      <Chip at={{ right: 1.5, top: 21 }} delay={950} par={-24} floatSpeed={8} className="w-[20em]">
        <div className="flex items-center gap-[0.9em]">
          <Tile tone="dark" className="size-[2.8em]">
            <BellIcon className="size-[1.5em]" />
          </Tile>
          <div className="min-w-0">
            <div className="text-[1.1em] font-semibold text-text-secondary">Notice · now</div>
            <div className="text-[1.3em] font-bold leading-tight">Annual day on 20 Dec</div>
          </div>
        </div>
      </Chip>
    </Stage>
  );
}

/* ---------------------------------------------------------------- Timetable */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const GRID = [
  ["Maths", "Hindi", "Maths", "Sci", "English"],
  ["Sci", "Maths", "English", "Hindi", "SST"],
  ["English", "SST", "Sci", "Maths", "Hindi"],
  ["SST", "Art", "Hindi", "English", "Maths"],
];
const TIMES = ["8:00", "8:45", "9:30", "10:45"];

export function TimetableScene() {
  return (
    <Stage>
      <Win x={3} y={6} w={43}>
        <div className="flex items-start justify-between px-[1.8em] pt-[1.7em]">
          <Title sub="Week 45 · 8:00 am to 12:15 pm">Class 8-B</Title>
          <Pill tone="dark">Today · Mon</Pill>
        </div>
        <div className="mt-[1.4em] px-[1.8em] pb-[1.8em]">
          <div className="grid grid-cols-[3.6em_repeat(5,1fr)] gap-[0.6em] text-[1.1em] font-semibold text-text-secondary">
            <span />
            {DAYS.map((d) => (
              <span key={d} className="text-center">
                {d}
              </span>
            ))}
          </div>
          <div className="mt-[0.6em] space-y-[0.6em]">
            {GRID.map((row, r) => (
              <div key={r} className="grid grid-cols-[3.6em_repeat(5,1fr)] items-center gap-[0.6em]">
                <span className="text-[1.05em] tabular-nums text-text-tertiary">{TIMES[r]}</span>
                {row.map((s, c) => {
                  const now = r === 3 && c === 4;
                  return (
                    <span
                      key={c}
                      className={`grid h-[3.9em] place-items-center rounded-[1.2em] text-[1.2em] font-semibold ${
                        now ? "bg-solid text-on-solid" : "bg-card text-text"
                      }`}
                    >
                      {s}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Win>
      <Chip at={{ right: 2, top: 2 }} delay={650} par={24}>
        <div className="flex items-center gap-[1em]">
          <Tile className="size-[3.6em]">
            <ClockIcon className="size-[2em]" />
          </Tile>
          <div>
            <div className="text-[1.5em] font-bold leading-tight">Next: Maths</div>
            <div className="text-[1.15em] text-text-secondary">10:45 · Room 12 · Mr. Dubey</div>
          </div>
        </div>
      </Chip>
      <Chip at={{ left: 6, bottom: 2 }} delay={950} par={-22} floatSpeed={8}>
        <div className="flex items-center gap-[0.9em] text-[1.3em] font-semibold">
          <Tile tone="success" className="size-[2.4em]">
            <CheckIcon className="size-[1.4em]" />
          </Tile>
          No clashes found
        </div>
      </Chip>
    </Stage>
  );
}
