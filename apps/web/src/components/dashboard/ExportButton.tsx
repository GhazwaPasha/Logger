"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { PerformanceExportModal, type ExportRange } from "@/components/performance/PerformanceExportModal";

type ExportType = "tasks" | "activity" | "performance";

const EXPORT_LABELS: Record<ExportType, string> = {
  tasks: "Tasks report (CSV)",
  activity: "Activity log (CSV)",
  performance: "Performance report (CSV)",
};

export function ExportButton({ types = ["tasks", "activity"] }: { types?: ExportType[] }) {
  const { workspaceId } = useWorkspaceRoute();
  const { token } = useApiSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rangeModalType, setRangeModalType] = useState<ExportType | null>(null);

  const download = async (type: ExportType, range?: ExportRange) => {
    if (!token || !workspaceId) return;
    setBusy(true);
    setOpen(false);
    try {
      const params = new URLSearchParams();
      if (range) {
        params.set("dateFrom", range.dateFrom);
        params.set("dateTo", range.dateTo);
      }
      const query = params.toString();
      const url = `/organizations/${workspaceId}/reports/${type}.csv${query ? `?${query}` : ""}`;
      const res = await apiFetch(url, { token });
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${type}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setBusy(false);
      setRangeModalType(null);
    }
  };

  const handlePick = (type: ExportType) => {
    if (type === "performance") {
      // Performance reports can span very different time ranges, so ask before downloading.
      setOpen(false);
      setRangeModalType(type);
      return;
    }
    void download(type);
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden>
          <path fillRule="evenodd" d="M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z" />
        </svg>
        {busy ? "Downloading…" : "Export"}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[10rem] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] py-1 shadow-lg shadow-black/10 dark:shadow-black/30">
          {types.map((type) => (
            <button
              key={type}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--surface-hover)]"
              onClick={() => handlePick(type)}
            >
              {EXPORT_LABELS[type]}
            </button>
          ))}
        </div>
      )}
      <PerformanceExportModal
        open={rangeModalType === "performance"}
        busy={busy}
        onClose={() => setRangeModalType(null)}
        onExport={(range) => void download("performance", range)}
      />
    </div>
  );
}
