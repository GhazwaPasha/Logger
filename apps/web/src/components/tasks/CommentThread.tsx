"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiJson } from "@/lib/api";
import type { MemberRow } from "@/lib/ledger-types";

type CommentRow = {
  id: string;
  taskId: string;
  parentCommentId: string | null;
  authorId: string;
  authorName: string | null;
  authorEmail: string;
  authorImage: string | null;
  body: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function authorInitials(name: string | null, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    return name.trim().slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function MentionHighlightedBody({ body }: { body: string }) {
  const parts = body.split(/(@\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^@\[([^\]]+)\]\(([^)]+)\)$/);
        if (match) {
          return (
            <span key={i} className="font-medium text-blue-600 dark:text-blue-400">
              @{match[1]}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

type CommentInputProps = {
  taskId: string;
  token: string;
  members: MemberRow[];
  parentCommentId?: string;
  onSuccess?: () => void;
  placeholder?: string;
};

function CommentInput({ taskId, token, members, parentCommentId, onSuccess, placeholder }: CommentInputProps) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/tasks/${taskId}/comments`, {
        token,
        method: "POST",
        body: JSON.stringify({ body, parentCommentId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
      setBody("");
      onSuccess?.();
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionPicker && (e.key === "Escape" || e.key === " ")) {
      setShowMentionPicker(false);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !showMentionPicker) {
      e.preventDefault();
      if (body.trim()) mutation.mutate();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const mentionMatch = before.match(/@(\w*)$/);
    if (mentionMatch) {
      setMentionFilter(mentionMatch[1]!.toLowerCase());
      setShowMentionPicker(true);
    } else {
      setShowMentionPicker(false);
    }
  };

  const insertMention = (member: MemberRow) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart ?? body.length;
    const before = body.slice(0, cursor);
    const after = body.slice(cursor);
    const mentionStart = before.lastIndexOf("@");
    const replaced = before.slice(0, mentionStart) + `@[${member.name ?? member.email}](${member.userId}) ` + after;
    setBody(replaced);
    setShowMentionPicker(false);
    setTimeout(() => ta.focus(), 0);
  };

  const filteredMembers = members.filter((m) => {
    const name = (m.name ?? m.email ?? "").toLowerCase();
    return name.includes(mentionFilter);
  });

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Add a comment… (Enter to send, Shift+Enter for newline)"}
        rows={2}
        className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
      />
      {showMentionPicker && filteredMembers.length > 0 && (
        <ul className="absolute bottom-full left-0 z-50 mb-1 max-h-40 w-56 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] py-1 shadow-lg">
          {filteredMembers.map((m) => (
            <li key={m.userId}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-hover)]"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(m);
                }}
              >
                <span className="size-5 shrink-0 rounded-full bg-[var(--accent-muted)] text-center text-[10px] font-semibold leading-5 text-[var(--fg)]">
                  {authorInitials(m.name ?? null, m.email)}
                </span>
                <span className="truncate text-[var(--fg)]">{m.name ?? m.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1.5 flex justify-end">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!body.trim() || mutation.isPending}
          className="btn-primary rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-50"
        >
          {mutation.isPending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}

type Props = {
  taskId: string;
  token: string;
  userId: string;
  members: MemberRow[];
};

export function CommentThread({ taskId, token, userId, members }: Props) {
  const queryClient = useQueryClient();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const query = useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => apiJson<CommentRow[]>(`/tasks/${taskId}/comments`, { token }),
    staleTime: 15_000,
    enabled: Boolean(token && taskId),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) =>
      apiFetch(`/comments/${commentId}`, { token, method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["comments", taskId] }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      apiFetch(`/comments/${id}`, { token, method: "PATCH", body: JSON.stringify({ body }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
      setEditingId(null);
    },
  });

  const roots = query.data?.filter((c) => !c.parentCommentId) ?? [];
  const repliesFor = useCallback(
    (id: string) => query.data?.filter((c) => c.parentCommentId === id) ?? [],
    [query.data],
  );

  function CommentRow({ comment, indent }: { comment: CommentRow; indent?: boolean }) {
    const isOwn = comment.authorId === userId;
    const replies = repliesFor(comment.id);

    return (
      <div className={`${indent ? "ml-6 border-l border-[var(--border-subtle)] pl-3" : ""}`}>
        <div className="flex gap-2.5 py-2">
          <div className="mt-0.5 size-7 shrink-0 rounded-full bg-[var(--accent-muted)] text-center text-[10px] font-semibold leading-7 text-[var(--fg)] overflow-hidden">
            {comment.authorImage ? (
              <img src={comment.authorImage} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              authorInitials(comment.authorName, comment.authorEmail)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-[var(--fg)]">
                {comment.authorName ?? comment.authorEmail}
              </span>
              <span className="text-[10px] text-[var(--muted)]">{formatRelative(comment.createdAt)}</span>
              {comment.editedAt && <span className="text-[10px] text-[var(--muted)]">(edited)</span>}
            </div>
            {comment.deletedAt ? (
              <p className="mt-0.5 text-sm italic text-[var(--muted)]">Comment removed.</p>
            ) : editingId === comment.id ? (
              <div className="mt-1">
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none"
                />
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => editMutation.mutate({ id: comment.id, body: editBody })}
                    disabled={!editBody.trim() || editMutation.isPending}
                    className="btn-primary rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--muted)] hover:text-[var(--fg)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--fg)]">
                <MentionHighlightedBody body={comment.body ?? ""} />
              </p>
            )}
            {!comment.deletedAt && (
              <div className="mt-1 flex gap-3">
                {!indent && (
                  <button
                    type="button"
                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                    className="text-[10px] text-[var(--muted)] hover:text-[var(--fg)]"
                  >
                    Reply
                  </button>
                )}
                {isOwn && (
                  <button
                    type="button"
                    onClick={() => { setEditingId(comment.id); setEditBody(comment.body ?? ""); }}
                    className="text-[10px] text-[var(--muted)] hover:text-[var(--fg)]"
                  >
                    Edit
                  </button>
                )}
                {isOwn && (
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(comment.id)}
                    className="text-[10px] text-[var(--muted)] hover:text-red-500"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        {replies.map((r) => <CommentRow key={r.id} comment={r} indent />)}
        {replyingTo === comment.id && (
          <div className="ml-6 mt-1">
            <CommentInput
              taskId={taskId}
              token={token}
              members={members}
              parentCommentId={comment.id}
              onSuccess={() => setReplyingTo(null)}
              placeholder="Reply… (Enter to send)"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Comments</h3>
      {query.isPending && <p className="text-sm text-[var(--muted)]">Loading…</p>}
      {query.error && <p className="text-sm text-red-600">{(query.error as Error).message}</p>}
      {query.data && (
        <div className="divide-y divide-[var(--border-subtle)]/50">
          {roots.length === 0 && (
            <p className="py-2 text-sm text-[var(--muted)]">No comments yet. Be the first to comment.</p>
          )}
          {roots.map((c) => <CommentRow key={c.id} comment={c} />)}
        </div>
      )}
      <div className="pt-2">
        <CommentInput taskId={taskId} token={token} members={members} />
      </div>
    </div>
  );
}
