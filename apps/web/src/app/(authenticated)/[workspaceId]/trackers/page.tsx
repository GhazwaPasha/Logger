"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useApiSession } from "@/hooks/useApiSession";
import { useTrackerDetail, useTrackerList, useTrackerMutations } from "@/hooks/useTrackers";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { TrackerDetail } from "@/components/trackers/TrackerDetail";
import { TrackerEditor } from "@/components/trackers/TrackerEditor";
import { Segmented } from "@/components/ui/Segmented";
import { NewButton } from "@/components/ui/NewButton";
import { PACE_LABEL } from "@/components/trackers/tracker-format";
import { TRACKER_TEMPLATES } from "@/components/trackers/tracker-templates";
import { TargetIcon } from "lucide-react";

type Filter = "active" | "mine" | "archived";

export default function TrackersPage() {
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const { token, session } = useApiSession();
  const { members } = useWorkspaceData();
  const userId = session?.user?.id ?? null;
  const router = useRouter();
  const params = useSearchParams();
  const reduced = useReducedMotion();

  const [filter, setFilter] = useState<Filter>("active");
  const [error, setError] = useState<string | null>(null);
  const list = useTrackerList(token, workspaceId, "all");
  const archivedList = useTrackerList(
    filter === "archived" ? token : null,
    workspaceId,
    "all",
    true,
  );
  const mutations = useTrackerMutations(token, workspaceId);

  const selectedId = params.get("t");
  const editor =
    params.get("edit") === "1"
      ? "edit"
      : params.get("new") === "1"
        ? "new"
        : null;
  const detail = useTrackerDetail(token, workspaceId, selectedId);
  const canManage = list.data?.canManage ?? false;
  const today = list.data?.today ?? new Date().toISOString().slice(0, 10);

  const rows = useMemo(() => {
    if (filter === "archived")
      return (archivedList.data?.trackers ?? []).filter((t) => t.archivedAt);
    const all = list.data?.trackers ?? [];
    return filter === "mine" ? all.filter((t) => t.assigneeId === userId) : all;
  }, [filter, list.data, archivedList.data, userId]);
  const hasAny = (list.data?.trackers.length ?? 0) > 0;

  const go = (q: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(q)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    const s = next.toString();
    router.replace(`/${workspaceSlug}/trackers${s ? `?${s}` : ""}`, {
      scroll: false,
    });
  };

  // Land on the first tracker so the detail side is never blank.
  useEffect(() => {
    if (!selectedId && !editor && rows[0]) go({ t: rows[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, editor, rows]);

  const person = (id: string | null) =>
    id ? members.find((x) => x.userId === id) : undefined;
  const personName = (id: string | null) => {
    if (!id) return "Unassigned";
    const m = person(id);
    return (m?.name ?? "").trim() || m?.email || "Someone";
  };

  /* ───────── Full-page editor: creating or editing gets the whole canvas, not a squeezed column. ───────── */
  if (editor && canManage && (editor === "new" || detail.data)) {
    return (
      <div className="mx-auto w-full max-w-[min(100%,104rem)] pb-16">
        {error && (
          <div className="mb-3">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}
        {editor === "new" ? (
          <TrackerEditor
            editing={null}
            members={members}
            today={today}
            initialTemplate={params.get("template")}
            onCreate={(input) => mutations.create(input)}
            onUpdate={(id, input) => mutations.update(id, input)}
            onClose={(savedId) => go({ new: null, template: null, t: savedId })}
          />
        ) : (
          <TrackerEditor
            key={detail.data!.id}
            editing={detail.data!}
            members={members}
            today={detail.data!.stats.today}
            onCreate={(input) => mutations.create(input)}
            onUpdate={(id, input) => mutations.update(id, input)}
            onClose={() => go({ edit: null })}
            onArchive={async (archived) => {
              await mutations.update(detail.data!.id, { archived });
              go({ edit: null });
            }}
            onDelete={async () => {
              await mutations.remove(detail.data!.id);
              go({ edit: null, t: null });
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-4">
      {error && (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Trackers</h1>
        {canManage && hasAny && (
          <div className="flex items-center gap-2">
            <NewButton label="New tracker" onClick={() => go({ new: "1", edit: null })} />
            <Segmented
              value={filter}
              onChange={setFilter}
              aria-label="Filter trackers"
              options={[
                { value: "active", label: "All" },
                { value: "mine", label: "Mine" },
                { value: "archived", label: "Archived" },
              ]}
            />
          </div>
        )}
      </div>

      {!list.isLoading && !hasAny ? (
        <div>
          {canManage ? (
            <div className="space-y-4 rounded-[20px] bg-[var(--card)] p-6 shadow-card">
              <div>
                <h3 className="text-xs font-semibold text-[var(--muted)]">
                  Start a tracker
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Pick a starting point. You choose the person and the targets
                  next.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {TRACKER_TEMPLATES.map((t, i) => (
                  <motion.button
                    key={t.id}
                    type="button"
                    onClick={() => go({ new: "1", template: t.id })}
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      ease: [0.23, 1, 0.32, 1],
                      delay: reduced ? 0 : i * 0.04,
                    }}
                    className="group flex flex-col items-start justify-start rounded-2xl bg-[var(--card)] shadow-card p-5 text-left transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--surface-hover)] active:scale-[0.98]"
                  >
                    <span className="block text-sm font-semibold text-[var(--fg)]">
                      {t.name}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">
                      {t.blurb}
                    </span>
                    <span className="mt-4 flex flex-wrap gap-1">
                      {t.metrics
                        .filter((m) => m.name)
                        .map((m) => (
                          <span
                            key={m.key}
                            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-0.5 text-caption font-semibold text-[var(--muted)]"
                          >
                            {m.name}
                          </span>
                        ))}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={TargetIcon}
              className="py-20"
              title="No trackers assigned to you"
              description="When a manager gives you a target to track, it shows up here."
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* Left: tracker list, in its own card like the other two columns; the open tracker is a raised row that slides. */}
          <div className="w-full rounded-[20px] bg-[var(--card)] p-2 shadow-card lg:w-72 lg:shrink-0">
            <h3 className="px-3 pb-1.5 pt-2 text-footnote font-semibold text-[var(--muted)]">
              Trackers <span className="tabular-nums">· {rows.length}</span>
            </h3>
            <ul className="space-y-0.5">
              {list.isLoading && rows.length === 0
                ? [0, 1, 2, 3].map((i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 rounded-2xl px-3.5 py-3"
                      aria-hidden
                    >
                      <span className="size-8 shrink-0 animate-pulse rounded-full bg-[var(--fill-2)] motion-reduce:animate-none" />
                      <span className="flex-1 space-y-2">
                        <span className="block h-3 w-3/4 animate-pulse rounded-md bg-[var(--fill-2)] motion-reduce:animate-none" />
                        <span className="block h-1.5 w-full animate-pulse rounded-full bg-[var(--fill)] motion-reduce:animate-none" />
                        <span className="block h-2.5 w-1/2 animate-pulse rounded-md bg-[var(--fill)] motion-reduce:animate-none" />
                      </span>
                    </li>
                  ))
                : null}
              {rows.map((t) => {
                const m = person(t.assigneeId);
                const on = t.id === selectedId;
                const first = t.metrics.findIndex(
                  (x) => x.kind === "input" && x.target != null,
                );
                const st = first >= 0 ? t.stats.metrics[first] : null;
                const pct = st?.target
                  ? Math.min(1, Math.max(0, (st.value ?? 0) / st.target))
                  : 0;
                const missed =
                  t.stats.missedCount > 0 && t.stats.pace !== "behind";
                const pill = missed
                  ? "bg-[var(--warning-bg)] text-[var(--warning-ink)]"
                  : t.stats.pace === "behind"
                    ? "bg-[color-mix(in_srgb,var(--danger)_13%,transparent)] text-[var(--danger)]"
                    : t.stats.pace === "none"
                      ? "bg-[var(--fill-2)] text-[var(--muted)]"
                      : "bg-[var(--status-done-bg)] text-[var(--status-done-ink)]";
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onPointerDown={() => go({ t: t.id })}
                      className="pressable relative flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left hover:bg-[var(--fill)]"
                    >
                      {on && (
                        <motion.span
                          layoutId="tracker-list-highlight"
                          className="absolute inset-0 rounded-2xl bg-[var(--card-raised)] shadow-raised"
                          transition={
                            reduced
                              ? { duration: 0 }
                              : { type: "spring", bounce: 0, duration: 0.38 }
                          }
                        />
                      )}
                      <Avatar
                        name={m?.name}
                        email={m?.email}
                        image={m?.image}
                        size="size-8"
                        className="relative shrink-0 bg-[var(--fill-2)] text-caption font-semibold text-[var(--fg)]"
                      />
                      <span className="relative min-w-0 flex-1 space-y-1.5">
                        <span className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--fg)]">
                            {t.name}
                          </span>
                          {st?.target != null && (
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--fg)]">
                              {Math.round(pct * 100)}%
                            </span>
                          )}
                        </span>
                        <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--fill-2)]">
                          <span
                            className="block h-full rounded-r-[3px] bg-[var(--dept-1)]"
                            style={{ width: `${pct * 100}%` }}
                          />
                        </span>
                        <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
                          <span className="min-w-0 flex-1 truncate">
                            {personName(t.assigneeId)} · {t.checkIn}
                          </span>
                          <span
                            className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-caption font-semibold ${pill}`}
                          >
                            {missed
                              ? `${t.stats.missedCount} missed`
                              : PACE_LABEL[t.stats.pace]}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {!list.isLoading && rows.length === 0 && (
                <li className="px-3 py-2 text-sm text-[var(--muted)]">
                  {filter === "archived"
                    ? "No archived trackers."
                    : "No trackers assigned to you."}
                </li>
              )}
            </ul>
          </div>

          <section
            className="min-w-0 flex-1"
            aria-busy={!detail.data || undefined}
          >
            {/* No exit animation to wait on: a "wait" presence could stall a newly created tracker
                until a reload. The view just fades in whenever the selection changes. */}
            {detail.data && detail.data.id === selectedId ? (
              <motion.div
                key={detail.data.id}
                // Switching trackers: the detail flies in from the right, away from the list it came from.
                initial={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, transform: "translateX(28px)" }
                }
                animate={{ opacity: 1, transform: "translateX(0px)" }}
                transition={
                  reduced
                    ? { duration: 0.15 }
                    : { type: "spring", duration: 0.5, bounce: 0.1 }
                }
              >
                <TrackerDetail
                  detail={detail.data}
                  members={members}
                  currentUserId={userId}
                  onEdit={() => go({ edit: "1" })}
                  onLog={(date, values, note) =>
                    mutations
                      .logEntry(detail.data!.id, date, { values, note })
                      .catch((e) => {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Couldn't save the log",
                        );
                        throw e;
                      })
                  }
                />
              </motion.div>
            ) : detail.isError ? (
              <p className="text-sm text-[var(--muted)]">
                This tracker isn&apos;t available.
              </p>
            ) : selectedId || list.isLoading ? (
              <TrackerDetailSkeleton />
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}

/** Placeholder with the real layout's shape (middle card + log card), so nothing jumps on load. */
function TrackerDetailSkeleton() {
  const bar =
    "animate-pulse rounded-md bg-[var(--fill-2)] motion-reduce:animate-none";
  return (
    <div
      className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start"
      aria-hidden
    >
      <div className="min-w-0 flex-1 space-y-7 rounded-[20px] bg-[var(--card)] p-7 shadow-card">
        <div className="space-y-3">
          <div className={`h-3 w-40 ${bar}`} />
          <div className={`h-7 w-72 max-w-full ${bar}`} />
        </div>
        <div className="space-y-3">
          <div className={`h-12 w-52 ${bar}`} />
          <div className={`h-3 w-full rounded-full ${bar}`} />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-[92px] rounded-2xl ${bar}`} />
          ))}
        </div>
        <div className={`h-[190px] rounded-2xl ${bar}`} />
      </div>
      <div className="w-full space-y-4 rounded-[20px] bg-[var(--card)] p-5 shadow-card xl:w-80 xl:shrink-0">
        <div className={`h-5 w-32 ${bar}`} />
        <div className={`h-11 w-full rounded-xl ${bar}`} />
        <div className={`h-11 w-full rounded-xl ${bar}`} />
        <div className={`h-11 w-full rounded-xl ${bar}`} />
      </div>
    </div>
  );
}
