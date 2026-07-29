"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useApiSession } from "@/hooks/useApiSession";
import { getApiBaseUrl } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { faPlug, faClockRotateLeft } from "@fortawesome/free-solid-svg-icons";

const ALLOWED_EVENTS = ["task.created", "task.status_changed", "task.ledger_added", "member.added"];

type Endpoint = {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
};

type Delivery = {
  id: string;
  event: string;
  responseStatus: string | null;
  responseBody: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  createdAt: string;
};

export default function WebhooksPage() {
  const { workspaceId } = useWorkspaceRoute();
  const { token } = useApiSession();
  const queryClient = useQueryClient();

  const endpointsKey = ["webhooks", workspaceId];

  const { data: endpoints = [], isLoading } = useQuery<Endpoint[]>({
    queryKey: endpointsKey,
    queryFn: async () => {
      const res = await fetch(`${getApiBaseUrl()}/organizations/${workspaceId}/webhooks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load webhooks");
      return res.json() as Promise<Endpoint[]>;
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  // Create form state
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [createError, setCreateError] = useState("");
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${getApiBaseUrl()}/organizations/${workspaceId}/webhooks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, events: selectedEvents }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Failed to create webhook");
      }
      return res.json() as Promise<Endpoint & { secret: string }>;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: endpointsKey });
      setGeneratedSecret(data.secret);
      setUrl("");
      setSelectedEvents([]);
      setCreateError("");
    },
    onError: (e: Error) => setCreateError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${getApiBaseUrl()}/organizations/${workspaceId}/webhooks/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete webhook");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: endpointsKey }),
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${getApiBaseUrl()}/organizations/${workspaceId}/webhooks/${id}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Test failed");
      return res.json() as Promise<{ status: number | null; body: string }>;
    },
  });

  const [viewDeliveriesId, setViewDeliveriesId] = useState<string | null>(null);
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);

  const { data: deliveries = [] } = useQuery<Delivery[]>({
    queryKey: ["webhooks", "deliveries", viewDeliveriesId],
    queryFn: async () => {
      const res = await fetch(
        `${getApiBaseUrl()}/organizations/${workspaceId}/webhooks/${viewDeliveriesId!}/deliveries`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Failed to load deliveries");
      return res.json() as Promise<Delivery[]>;
    },
    enabled: !!token && !!viewDeliveriesId,
    staleTime: 10_000,
  });

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Send real-time event notifications to external URLs. Only organization owners can manage webhooks.
        </p>
      </div>

      {/* Secret banner */}
      {generatedSecret && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-50 p-4 dark:bg-amber-900/20">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Save your signing secret — it won't be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-white/60 px-3 py-2 font-mono text-xs dark:bg-black/30">
              {generatedSecret}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(generatedSecret);
                setCopiedSecret(true);
                setTimeout(() => setCopiedSecret(false), 2000);
              }}
              className="btn-secondary rounded-lg px-3 py-1.5 text-xs"
            >
              {copiedSecret ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setGeneratedSecret(null)}
            className="mt-2 text-xs text-amber-700 underline dark:text-amber-400"
          >
            I've saved it, dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6">
        <h2 className="mb-4 text-sm font-semibold">Add Endpoint</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              className="input w-full max-w-lg rounded-xl text-sm"
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--muted)]">Events</p>
            <div className="flex flex-wrap gap-2">
              {ALLOWED_EVENTS.map((ev) => (
                <label key={ev} className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="rounded"
                  />
                  <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5">{ev}</code>
                </label>
              ))}
            </div>
          </div>
          {createError && <p className="text-xs text-red-500">{createError}</p>}
          <button
            type="button"
            onClick={() => {
              if (!url || selectedEvents.length === 0) { setCreateError("URL and at least one event required"); return; }
              createMutation.mutate();
            }}
            disabled={createMutation.isPending}
            className="btn-primary rounded-xl px-4 py-2 text-sm font-medium"
          >
            {createMutation.isPending ? "Creating…" : "Create Webhook"}
          </button>
        </div>
      </section>

      {/* Endpoint list */}
      <section className="space-y-3">
        {isLoading && <p className="text-sm text-[var(--muted)]">Loading…</p>}
        {!isLoading && endpoints.length === 0 && (
          <EmptyState icon={faPlug} title="No webhooks configured yet" size="compact" />
        )}
        {endpoints.map((ep) => (
          <div
            key={ep.id}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm">{ep.url}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ep.events.map((ev) => (
                    <code key={ev} className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px]">
                      {ev}
                    </code>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => testMutation.mutate(ep.id)}
                  disabled={testMutation.isPending && testMutation.variables === ep.id}
                  className="btn-secondary rounded-lg px-2.5 py-1 text-xs"
                >
                  Test
                </button>
                <button
                  type="button"
                  onClick={() => setViewDeliveriesId((v) => (v === ep.id ? null : ep.id))}
                  className="btn-secondary rounded-lg px-2.5 py-1 text-xs"
                >
                  Deliveries
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(ep.id)}
                  className="rounded-lg px-2.5 py-1 text-xs text-red-500 hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Test result */}
            {testMutation.isSuccess && testMutation.variables === ep.id && (
              <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${testMutation.data.status && testMutation.data.status >= 200 && testMutation.data.status < 300 ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
                <span className="font-semibold">Status: {testMutation.data.status ?? "timeout"}</span>
                {testMutation.data.body && <p className="mt-0.5 truncate opacity-70">{testMutation.data.body}</p>}
              </div>
            )}

            {/* Delivery log */}
            {viewDeliveriesId === ep.id && (
              <div className="mt-4 space-y-1.5">
                <p className="text-xs font-semibold text-[var(--muted)]">Recent Deliveries</p>
                {deliveries.length === 0 && (
                  <EmptyState icon={faClockRotateLeft} title="No deliveries yet" size="compact" />
                )}
                {deliveries.map((d) => (
                  <div key={d.id} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setExpandedDelivery((v) => (v === d.id ? null : d.id))}
                      className="flex w-full items-center gap-2 text-xs"
                    >
                      <span className={`rounded px-1.5 py-0.5 font-mono font-semibold ${d.deliveredAt ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-red-500/15 text-red-600 dark:text-red-400"}`}>
                        {d.responseStatus ?? "–"}
                      </span>
                      <code className="text-[var(--muted)]">{d.event}</code>
                      <span className="ml-auto text-[var(--muted)]">
                        {new Date(d.createdAt).toLocaleString()}
                      </span>
                    </button>
                    {expandedDelivery === d.id && d.responseBody && (
                      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[10px] text-[var(--muted)]">
                        {d.responseBody}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
