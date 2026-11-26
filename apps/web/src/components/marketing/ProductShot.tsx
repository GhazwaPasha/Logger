import { LogBaseMark } from "@/components/brand/LogBaseMark";

/**
 * A static, decorative picture of the LogBase dashboard for the landing hero — built from the
 * app's own tokens (rendered dark by the hero's color-scheme), at a fixed 1440×1000 canvas that
 * the parent scales to fit. Sample data only; hidden from assistive tech.
 */
export function ProductShot() {
  const kpis = [
    { label: "Overdue", value: "4", note: "Past their due date", color: "var(--danger)" },
    { label: "Unassigned", value: "48", note: "Waiting for an owner", color: "var(--warning)" },
    { label: "Assigned to me", value: "2", note: "On your plate", color: "var(--dept-1)" },
    { label: "Workspace", value: "9 · 4 · 11", note: "Members · Departments · Channels", color: "var(--dept-2)" },
  ];
  const nav = [
    ["Dashboard", "var(--dept-1)"],
    ["Performance", "var(--dept-4)"],
    ["Roadmap", "var(--dept-3)"],
    ["Trackers", "var(--dept-2)"],
    ["Calendar", "var(--danger)"],
    ["My tasks", "#8E8E93"],
  ];
  const channels: [string, string[]][] = [
    ["Marketing & Advertisement", ["Media Team", "Print Media", "Social Media"]],
    ["Finance", ["daily-closing-sheets", "daily-updates", "weekly-updates"]],
    ["Operations", ["chiniot", "sargodha"]],
  ];
  const line = "M0 150 C40 146 70 136 110 140 S180 120 220 118 S300 96 340 104 S420 84 460 80 S540 60 580 62 S660 40 700 44";

  return (
    <div aria-hidden className="pointer-events-none flex h-[1000px] w-[1440px] select-none flex-col bg-[var(--chrome)] font-sans text-[var(--ink)]">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <LogBaseMark variant="chrome" decorative />
        <span className="font-outfit text-lg font-semibold">LogBase</span>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-60 flex-col gap-4 px-3 py-2">
          <div className="flex flex-col gap-0.5">
            {nav.map(([label, tint], i) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 rounded-lg py-1.5 pl-1.5 text-sm font-semibold ${i === 0 ? "bg-[var(--card)] shadow-card" : ""}`}
              >
                <span className="size-[18px] rounded-[5px] border-2 border-[var(--ink-3)]" data-tint={tint} />
                {label}
              </div>
            ))}
          </div>
          {channels.map(([dept, list]) => (
            <div key={dept} className="flex flex-col gap-0.5">
              <span className="px-2.5 text-footnote font-semibold">{dept}</span>
              {list.map((c, j) => (
                <span key={c} className={`px-2.5 py-1 text-footnote ${j === 0 ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-2)]"}`}>
                  <span className="text-[var(--ink-3)]"># </span>
                  {c}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-4 rounded-tl-3xl bg-[var(--sheet)] p-8 shadow-sheet">
          <div className="font-outfit text-3xl font-semibold tracking-tight">Up late, Jordan</div>
          <div className="grid grid-cols-4 gap-3">
            {kpis.map((k) => (
              <div key={k.label} className="flex h-[132px] flex-col rounded-[18px] bg-[var(--card)] p-4 shadow-card">
                <span className="flex items-center gap-1.5 text-footnote font-semibold text-[var(--ink-2)]">
                  <span className="size-2.5 rounded-full" style={{ background: k.color }} />
                  {k.label}
                </span>
                <span className="mt-3 font-outfit text-figure font-semibold leading-none tracking-tight">{k.value}</span>
                <span className="mt-auto text-xs text-[var(--ink-2)]">{k.note}</span>
              </div>
            ))}
          </div>
          <div className="grid flex-1 grid-cols-[7fr_5fr] gap-3">
            <div className="rounded-[18px] bg-[var(--card)] p-5 shadow-card">
              <div className="font-outfit text-base font-semibold">Tasks completed</div>
              <div className="text-xs text-[var(--ink-2)]">Last 14 days · 152 completed</div>
              <svg viewBox="0 0 700 170" className="mt-6 h-[230px] w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="ps-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: "var(--dept-1)", stopOpacity: 0.22 }} />
                    <stop offset="100%" style={{ stopColor: "var(--dept-1)", stopOpacity: 0 }} />
                  </linearGradient>
                </defs>
                {[40, 80, 120, 160].map((y) => (
                  <line key={y} x1="0" x2="700" y1={y} y2={y} style={{ stroke: "var(--line)" }} vectorEffect="non-scaling-stroke" />
                ))}
                <path d={`${line} L700 170 L0 170 Z`} fill="url(#ps-fill)" />
                <path d={line} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ stroke: "var(--dept-1)" }} />
              </svg>
            </div>
            <div className="flex items-center gap-6 rounded-[18px] bg-[var(--card)] p-5 shadow-card">
              <svg viewBox="0 0 200 200" className="size-[220px] shrink-0">
                <path d="M 19 92 A 84 84 0 0 1 128 22" fill="none" strokeWidth="10" strokeLinecap="round" style={{ stroke: "var(--status-pending)" }} />
                <path d="M 143 28 A 84 84 0 0 1 181 92" fill="none" strokeWidth="10" strokeLinecap="round" style={{ stroke: "var(--status-progress)" }} />
                <path d="M 181 108 A 84 84 0 0 1 60 175" fill="none" strokeWidth="10" strokeLinecap="round" style={{ stroke: "var(--priority-medium)" }} />
                <path d="M 46 166 A 84 84 0 0 1 19 108" fill="none" strokeWidth="10" strokeLinecap="round" style={{ stroke: "var(--priority-high)" }} />
                <text x="100" y="96" textAnchor="middle" className="font-outfit" style={{ fill: "var(--ink)", fontSize: 30, fontWeight: 600 }}>66</text>
                <text x="100" y="126" textAnchor="middle" style={{ fill: "var(--ink)", fontSize: 30, fontWeight: 600 }}>56</text>
              </svg>
              <div className="flex flex-col gap-2 text-footnote">
                {[
                  ["Pending", "43", "var(--status-pending)"],
                  ["In progress", "13", "var(--status-progress)"],
                  ["High", "9", "var(--priority-high)"],
                  ["Medium", "45", "var(--priority-medium)"],
                ].map(([l, n, c]) => (
                  <span key={l} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: c }} />
                    <span className="w-24">{l}</span>
                    <b className="font-semibold">{n}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
