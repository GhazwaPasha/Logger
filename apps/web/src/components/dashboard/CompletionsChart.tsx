"use client";

import { useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useApiSession } from "@/hooks/useApiSession";
import { useCompletionsByDay } from "@/hooks/useWorkTaskStats";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/Segmented";
import { SmoothLineChart } from "./SmoothLineChart";

const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];

function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}

/**
 * "Tasks completed", Apple Stocks/Health style: a big readout above a clean line — no grid, no
 * y-axis. Scrubbing the chart swaps the readout to that day; letting go shows the period total
 * and how it compares with the period before. Fetches twice the window for that comparison.
 */
export function CompletionsChart() {
  const { token } = useApiSession();
  const { workspaceId, timeZone } = useWorkspaceRoute();
  const [range, setRange] = useState<Range>(14);
  const { days, isLoading } = useCompletionsByDay(token, workspaceId, range * 2, timeZone);
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    if (!days || days.length < range * 2) return null;
    const prev = days.slice(0, range);
    const cur = days.slice(range);
    const total = cur.reduce((a, d) => a + d.count, 0);
    const prevTotal = prev.reduce((a, d) => a + d.count, 0);
    return { cur, values: cur.map((d) => d.count), total, prevTotal };
  }, [days, range]);

  const delta = model && model.prevTotal > 0 ? Math.round(((model.total - model.prevTotal) / model.prevTotal) * 100) : null;
  const scrubbing = hover !== null && model;

  return (
    <section className="flex h-full min-w-0 flex-col rounded-[18px] bg-[var(--card)] p-5 shadow-card" aria-labelledby="completions-title">
      <div className="flex items-center gap-3">
        <h2 id="completions-title" className="min-w-0 flex-1 font-outfit text-base font-semibold">
          Tasks completed
        </h2>
        <Segmented
          size="sm"
          value={String(range)}
          onChange={(v) => {
            setRange(Number(v) as Range);
            setHover(null);
          }}
          aria-label="Range"
          options={RANGES.map((r) => ({ value: String(r), label: `${r}D` }))}
        />
      </div>

      {/* Readout: period total, or the scrubbed day. */}
      <div className="mt-3 min-h-[62px]" aria-live="polite">
        {model ? (
          <>
            <p className="text-xs font-semibold text-[var(--muted)]">
              {scrubbing ? shortDate(model.cur[hover!].date) : `Last ${range} days`}
            </p>
            <p className="mt-0.5 flex items-baseline gap-2">
              <span className="font-outfit text-4xl font-semibold leading-none tracking-[-0.035em] tabular-nums">
                {scrubbing ? model.values[hover!] : model.total}
              </span>
              <span className="text-sm text-[var(--muted)]">{(scrubbing ? model.values[hover!] : model.total) === 1 ? "task" : "tasks"}</span>
              {!scrubbing && delta !== null ? (
                <span
                  className={cn(
                    "ml-1 inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold tabular-nums",
                    delta >= 0
                      ? "bg-[var(--status-done-bg)] text-[var(--status-done-ink)]"
                      : "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]",
                  )}
                  title={`Compared with the ${range} days before`}
                >
                  {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%
                </span>
              ) : null}
            </p>
          </>
        ) : (
          <div className="space-y-2" aria-hidden>
            <div className="h-3 w-20 animate-pulse rounded-md bg-[var(--fill-2)] motion-reduce:animate-none" />
            <div className="h-8 w-28 animate-pulse rounded-lg bg-[var(--fill-2)] motion-reduce:animate-none" />
          </div>
        )}
      </div>

      <div className="relative mt-2 min-h-[170px] flex-1">
        {isLoading || !model ? (
          <div className="absolute inset-x-0 bottom-6 top-2 animate-pulse rounded-xl bg-[var(--fill)] motion-reduce:animate-none" />
        ) : (
          <SmoothLineChart
            key={range}
            values={model.values}
            color="var(--dept-1)"
            hover={hover}
            onHover={setHover}
            reduce={!!reduce}
            ariaLabel={`Tasks completed per day over the last ${range} days, ${model.total} in total`}
            startLabel={shortDate(model.cur[0].date)}
            endLabel="Today"
          />
        )}
      </div>
    </section>
  );
}

