"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";

export type TaskSyncStatus = "idle" | "pending" | "saving" | "saved" | "error";

const SAVED_FADE_MS = 1800;

export function useTaskAutoSync(options: {
  ready: boolean;
  fingerprint: string;
  buildPayload: () => unknown | null;
  save: (payload: unknown) => Promise<void>;
  /** Called after each successful save with the payload that was sent. */
  onSaved?: (payload: unknown) => void;
  debounceMs?: number;
}) {
  const { ready, fingerprint, buildPayload, save, onSaved, debounceMs = 350 } = options;
  const debouncedFingerprint = useDebounce(fingerprint, debounceMs);
  const [status, setStatus] = useState<TaskSyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const savedFingerprintRef = useRef<string | null>(null);
  const fingerprintRef = useRef(fingerprint);
  const drainingRef = useRef(false);
  const saveRef = useRef(save);
  const buildPayloadRef = useRef(buildPayload);
  const onSavedRef = useRef(onSaved);
  const readyRef = useRef(ready);

  readyRef.current = ready;
  fingerprintRef.current = fingerprint;
  saveRef.current = save;
  buildPayloadRef.current = buildPayload;
  onSavedRef.current = onSaved;

  const establishBaseline = useCallback((baseline: string) => {
    savedFingerprintRef.current = baseline;
    setStatus("saved");
    setError(null);
  }, []);

  const runDrain = useCallback(async () => {
    if (!readyRef.current || drainingRef.current) return;
    drainingRef.current = true;

    try {
      while (readyRef.current && fingerprintRef.current !== savedFingerprintRef.current) {
        const snapshotAtPayload = fingerprintRef.current;
        const payload = buildPayloadRef.current();
        if (payload === null) break;

        setStatus("saving");
        setError(null);

        try {
          await saveRef.current(payload);
          onSavedRef.current?.(payload);
          if (fingerprintRef.current === snapshotAtPayload) {
            savedFingerprintRef.current = snapshotAtPayload;
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save");
          setStatus("error");
          break;
        }
      }

      if (fingerprintRef.current === savedFingerprintRef.current) {
        setStatus("saved");
        setError(null);
      }
    } finally {
      drainingRef.current = false;
      if (readyRef.current && fingerprintRef.current !== savedFingerprintRef.current) {
        void runDrain();
      }
    }
  }, []);

  const scheduleDrain = useCallback(() => {
    void runDrain();
  }, [runDrain]);

  useEffect(() => {
    if (!ready) return;
    if (fingerprint === savedFingerprintRef.current) {
      if (status === "pending") setStatus("saved");
      return;
    }
    if (!drainingRef.current && status !== "saving") setStatus("pending");
  }, [fingerprint, ready, status]);

  useEffect(() => {
    if (!ready) return;
    if (debouncedFingerprint === savedFingerprintRef.current) return;
    scheduleDrain();
  }, [debouncedFingerprint, ready, scheduleDrain]);

  useEffect(() => {
    if (status !== "saved") return;
    const t = setTimeout(() => {
      if (fingerprintRef.current === savedFingerprintRef.current) {
        setStatus("idle");
      }
    }, SAVED_FADE_MS);
    return () => clearTimeout(t);
  }, [status]);

  const hasUnsavedChanges =
    ready &&
    (status === "pending" ||
      status === "saving" ||
      (savedFingerprintRef.current !== null && fingerprint !== savedFingerprintRef.current));

  return { status, error, hasUnsavedChanges, establishBaseline, flushSave: scheduleDrain };
}
