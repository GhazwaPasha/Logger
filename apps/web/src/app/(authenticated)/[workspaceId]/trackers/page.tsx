"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBullseye, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useApiSession } from "@/hooks/useApiSession";
import { useTrackerDetail, useTrackerList, useTrackerMutations } from "@/hooks/useTrackers";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { TrackerDetail } from "@/components/trackers/TrackerDetail";
import { TrackerEditor } from "@/components/trackers/TrackerEditor";
import { Segmented } from "@/components/trackers/Segmented";
import { PACE_DOT, PACE_LABEL, PACE_TEXT, compactNumber } from "@/components/trackers/tracker-format";
import { TRACKER_TEMPLATES } from "@/components/trackers/tracker-templates";

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
  const archivedList = useTrackerList(filter === "archived" ? token : null, workspaceId, "all", true);
  const mutations = useTrackerMutations(token, workspaceId);

  const selectedId = params.get("t");
  const editor = params.get("edit") === "1" ? "edit" : params.get("new") === "1" ? "new" : null;
  const detail = useTrackerDetail(token, workspaceId, selectedId);
  const canManage = list.data?.canManage ?? false;
  const today = list.data?.today ?? new Date().toISOString().slice(0, 10);

  const rows = useMemo(() => {
    if (filter === "archived") return (archivedList.data?.trackers ?? []).filter((t) => t.archivedAt);
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
    router.replace(`/${workspaceSlug}/trackers${s ? `?${s}` : ""}`, { scroll: false });
  };

  // Land on the first tracker so the detail side is never blank.
  useEffect(() => {
    if (!selectedId && !editor && rows[0]) go({ t: rows[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, editor, rows]);

  const person = (id: string | null) => (id ? members.find((x) => x.userId === id) : undefined);
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
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-5">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Trackers</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Number targets, one owner each, logged daily or weekly.</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && hasAny && (
            <Segmented
              value={filter}
              onChange={setFilter}
              size="md"
              aria-label="Filter trackers"
              options={[
                { value: "active", label: "All" },
                { value: "mine", label: "Mine" },
                { value: "archived", label: "Archived" },
              ]}
            />
          )}
          {canManage && hasAny && (
            <button
              type="button"
              onClick={() => go({ new: "1", edit: null })}
              className="btn-primary inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium"
            >
              <FontAwesomeIcon icon={faPlus} className="size-3" />
              New tracker
            </button>
          )}
        </div>
      </div>

      {!list.isLoading && !hasAny ? (
        <div>
          {canManage ? (
            <div className="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Start a tracker</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Pick a starting point. You choose the person and the targets next.
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
                    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1], delay: reduced ? 0 : i * 0.04 }}
                    className="group flex flex-col items-start justify-start rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5 text-left transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--surface-hover)] active:scale-[0.98]"
                  >
                    <span className="block text-sm font-semibold text-[var(--fg)]">{t.name}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">{t.blurb}</span>
                    <span className="mt-4 flex flex-wrap gap-1">
                      {t.metrics
                        .filter((m) => m.name)
                        .map((m) => (
                          <span
                            key={m.key}
                            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)]"
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
              icon={faBullseye}
              className="py-20"
              title="No trackers assigned to you"
              description="When a manager gives you a target to track, it shows up here."
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          {/* List card — same card language as the task page; a sliding highlight marks the open tracker. */}
          <div className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2 lg:w-80 lg:shrink-0">
          <h3 className="px-2 pb-1.5 pt-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Trackers <span className="tabular-nums">· {rows.length}</span>
          </h3>
          <ul className="space-y-0.5">
            {rows.map((t) => {
              const m = person(t.assigneeId);
              const on = t.id === selectedId;
              const first = t.metrics.findIndex((x) => x.kind === "input" && x.target != null);
              const s = first >= 0 ? t.stats.metrics[first] : null;
              const missed = t.stats.missedCount > 0 && t.stats.pace !== "behind";
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onPointerDown={() => go({ t: t.id })}
                    className="relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-transform duration-100 active:scale-[0.99]"
                  >
                    {on && (
                      <motion.span
                        layoutId="tracker-list-highlight"
                        className="absolute inset-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)]"
                        transition={reduced ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.38 }}
                      />
                    )}
                    <Avatar
                      name={m?.name}
                      email={m?.email}
                      image={m?.image}
                      size="size-8"
                      className="relative shrink-0 bg-[var(--accent-muted)] text-[11px] font-semibold text-[var(--fg)]"
                    />
                    <span className="relative min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--fg)]">{t.name}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">
                        {personName(t.assigneeId)} · {t.checkIn}
                      </span>
                    </span>
                    <span className="relative flex shrink-0 flex-col items-end gap-0.5">
                      {s?.target != null && (
                        <span className="text-xs tabular-nums text-[var(--fg)]">
                          {compactNumber(s.value)}
                          <span className="text-[var(--muted)]"> / {compactNumber(s.target)}</span>
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] ${missed ? "text-amber-600 dark:text-amber-400" : PACE_TEXT[t.stats.pace]}`}
                      >
                        <span className={`size-1.5 rounded-full ${missed ? "bg-amber-500" : PACE_DOT[t.stats.pace]}`} />
                        {missed ? `${t.stats.missedCount} missed` : PACE_LABEL[t.stats.pace]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {rows.length === 0 && (
              <li className="px-3 py-2 text-sm text-[var(--muted)]">
                {filter === "archived" ? "No archived trackers." : "No trackers assigned to you."}
              </li>
            )}
          </ul>
          </div>

          <section className="min-w-0 flex-1">
            {/* No exit animation to wait on: a "wait" presence could stall a newly created tracker
                until a reload. The view just fades in whenever the selection changes. */}
            {detail.data && detail.data.id === selectedId ? (
              <motion.div
                key={detail.data.id}
                initial={reduced ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduced ? 0 : 0.18, ease: [0.23, 1, 0.32, 1] }}
              >
                <TrackerDetail
                  detail={detail.data}
                  members={members}
                  currentUserId={userId}
                  onEdit={() => go({ edit: "1" })}
                  onLog={(date, values, note) =>
                    mutations.logEntry(detail.data!.id, date, { values, note }).catch((e) => {
                      setError(e instanceof Error ? e.message : "Couldn't save the log");
                      throw e;
                    })
                  }
                />
              </motion.div>
            ) : detail.isError ? (
              <p className="text-sm text-[var(--muted)]">This tracker isn&apos;t available.</p>
            ) : selectedId ? (
              <p className="text-sm text-[var(--muted)]">Loading…</p>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
