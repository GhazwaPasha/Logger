"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faPen, faTrashCan, faComment } from "@fortawesome/free-solid-svg-icons";
import { apiFetch, apiJson } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { isWorkspaceOwner } from "@/lib/workspace-permissions";
import type { MemberRow } from "@/lib/ledger-types";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { formatInTimeZone } from "@/lib/date";

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

function formatRelative(iso: string, timeZone: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return formatInTimeZone(new Date(iso), timeZone, { month: "short", day: "numeric" });
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
  initialBody?: string;
  onSuccess?: () => void;
  placeholder?: string;
  authorId: string;
  authorName: string | null;
  authorEmail: string;
  authorImage: string | null;
};

function CommentInput({ taskId, token, members, parentCommentId, initialBody, onSuccess, placeholder, authorId, authorName, authorEmail, authorImage }: CommentInputProps) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState(initialBody ?? "");
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mutation = useMutation({
    mutationFn: (currentBody: string) =>
      apiFetch(`/tasks/${taskId}/comments`, {
        token,
        method: "POST",
        body: JSON.stringify({ body: currentBody, parentCommentId }),
      }),
    onMutate: async (currentBody) => {
      await queryClient.cancelQueries({ queryKey: ["comments", taskId] });
      const snapshot = queryClient.getQueryData<CommentRow[]>(["comments", taskId]);
      queryClient.setQueryData<CommentRow[]>(["comments", taskId], (old) => [
        ...(old ?? []),
        {
          id: `optimistic-${Date.now()}`,
          taskId,
          parentCommentId: parentCommentId ?? null,
          authorId,
          authorName,
          authorEmail,
          authorImage,
          body: currentBody,
          editedAt: null,
          deletedAt: null,
          createdAt: new Date().toISOString(),
        },
      ]);
      setBody("");
      onSuccess?.();
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(["comments", taskId], ctx.snapshot);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionPicker && (e.key === "Escape" || e.key === " ")) {
      setShowMentionPicker(false);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !showMentionPicker) {
      e.preventDefault();
      if (body.trim()) mutation.mutate(body);
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
    <div className="relative flex items-end gap-2">
      {showMentionPicker && filteredMembers.length > 0 && (
        <ul className="absolute bottom-full left-0 z-50 mb-2 max-h-40 w-56 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] py-1 shadow-lg">
          {filteredMembers.map((m) => (
            <li key={m.userId}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--surface-hover)]"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(m);
                }}
              >
                <Avatar
                  name={m.name}
                  email={m.email}
                  image={m.image}
                  size="size-5"
                  className="bg-[var(--accent-muted)] text-[10px] font-semibold text-[var(--fg)]"
                />
                <span className="truncate">{m.name ?? m.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={textareaRef}
        value={body}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Add a comment… (Enter to send)"}
        rows={1}
        className="flex-1 resize-none rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
        style={{ minHeight: "40px", maxHeight: "120px" }}
      />
      <button
        type="button"
        onClick={() => mutation.mutate(body)}
        disabled={!body.trim() || mutation.isPending}
        className="mb-0.5 shrink-0 flex items-center justify-center size-9 rounded-full bg-neutral-700 hover:bg-neutral-600 disabled:opacity-30 transition-colors"
        aria-label="Send"
      >
        <FontAwesomeIcon icon={faPaperPlane} className="size-[15px]" color="white" />
      </button>
    </div>
  );
}

type Props = {
  taskId: string;
  token: string;
  userId: string;
  members: MemberRow[];
  viewOnly?: boolean;
};

export function CommentThread({ taskId, token, userId, members, viewOnly }: Props) {
  const { timeZone } = useWorkspaceRoute();
  const queryClient = useQueryClient();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyMention, setReplyMention] = useState("");
  const [showInput, setShowInput] = useState(false);
  const currentMember = members.find((m) => m.userId === userId);
  const isOrgOwner = isWorkspaceOwner(members, userId);
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

  const restoreMutation = useMutation({
    mutationFn: (commentId: string) =>
      apiFetch(`/comments/${commentId}/restore`, { token, method: "POST" }),
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
      <div>
        <div className="group flex items-start gap-3 rounded-xl bg-[var(--surface-elevated)] px-3 py-2">
          {/* Avatar */}
          <Avatar
            name={comment.authorName}
            email={comment.authorEmail}
            image={comment.authorImage}
            size="mt-0.5 size-8"
            className="bg-[var(--accent-muted)] text-[11px] font-semibold text-[var(--fg)]"
          />

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Name + time + edit/delete icons */}
            <div className="mb-0.5 flex items-center gap-1.5">
              <span className={`text-xs font-semibold ${isOwn ? "text-[var(--accent)]" : "text-[var(--fg)]"}`}>
                {comment.authorName ?? comment.authorEmail}
              </span>
              <span className="text-[10px] text-[var(--muted)]">{formatRelative(comment.createdAt, timeZone)}</span>
              {comment.editedAt && <span className="text-[10px] text-[var(--muted)]">(edited)</span>}
              {isOwn && !comment.deletedAt && !viewOnly && (
                <button
                  type="button"
                  onClick={() => { setEditingId(comment.id); setEditBody(comment.body ?? ""); }}
                  className="ml-0.5 opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--fg)] transition-opacity"
                  aria-label="Edit"
                >
                  <FontAwesomeIcon icon={faPen} className="size-[11px]" />
                </button>
              )}
              {(isOwn || isOrgOwner) && !comment.deletedAt && !viewOnly && (
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(comment.id)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-red-500 transition-opacity"
                  aria-label="Delete"
                >
                  <FontAwesomeIcon icon={faTrashCan} className="size-[11px]" />
                </button>
              )}
            </div>

            {/* Body */}
            {comment.deletedAt ? (
              <div className="flex items-center gap-2">
                <p className="text-sm italic text-[var(--muted)]">Comment removed.</p>
                {(isOwn || isOrgOwner) && !viewOnly && (
                  <button
                    type="button"
                    onClick={() => restoreMutation.mutate(comment.id)}
                    className="text-[10px] font-medium text-[var(--muted)] underline hover:text-[var(--fg)]"
                  >
                    Restore
                  </button>
                )}
              </div>
            ) : editingId === comment.id ? (
              <div>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none"
                />
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => editMutation.mutate({ id: comment.id, body: editBody })}
                    disabled={!editBody.trim() || editMutation.isPending}
                    className="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
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
              <div className="flex items-end justify-between gap-2">
                <p className="whitespace-pre-wrap text-sm text-[var(--fg)]">
                  <MentionHighlightedBody body={comment.body ?? ""} />
                </p>
                {!viewOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      const rootId = comment.parentCommentId ?? comment.id;
                      const mention = `@${comment.authorName ?? comment.authorEmail} `;
                      if (replyingTo === rootId && replyMention === mention) {
                        setReplyingTo(null);
                        setReplyMention("");
                      } else {
                        setReplyingTo(rootId);
                        setReplyMention(mention);
                      }
                    }}
                    className="shrink-0 text-[10px] text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
                  >
                    Reply
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Replies */}
        {replies.length > 0 && (
          <div className="mt-1 space-y-1 ml-11 border-l border-[var(--border-subtle)] pl-3">
            {replies.map((r) => <CommentRow key={r.id} comment={r} indent />)}
          </div>
        )}

        {/* Reply input — only on root comments */}
        {!indent && replyingTo === comment.id && (
          <div className="ml-11 mt-1">
            <CommentInput
              key={replyMention}
              taskId={taskId}
              token={token}
              members={members}
              parentCommentId={comment.id}
              initialBody={replyMention}
              authorId={userId}
              authorName={currentMember?.name ?? null}
              authorEmail={currentMember?.email ?? ""}
              authorImage={currentMember?.image ?? null}
              onSuccess={() => { setReplyingTo(null); setReplyMention(""); }}
              placeholder="Reply… (Enter to send)"
            />
          </div>
        )}
      </div>
    );
  }

  if (viewOnly && query.data && roots.filter((c) => !c.deletedAt).length === 0) return null;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Comments</h3>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5" style={{ maxHeight: "420px" }}>
        {query.isPending && <p className="text-sm text-[var(--muted)]">Loading…</p>}
        {query.error && <p className="text-sm text-red-600">{(query.error as Error).message}</p>}
        {query.data && roots.length === 0 && !viewOnly && (
          <EmptyState icon={faComment} title="No comments yet" description="Be the first to comment." size="compact" />
        )}
        {query.data && roots.map((c) => <CommentRow key={c.id} comment={c} />)}
      </div>

      {/* Input */}
      {!viewOnly && (
        <div className="shrink-0 border-t border-[var(--border-subtle)] px-4 py-2.5">
          {showInput ? (
            <CommentInput
              taskId={taskId}
              token={token}
              members={members}
              authorId={userId}
              authorName={currentMember?.name ?? null}
              authorEmail={currentMember?.email ?? ""}
              authorImage={currentMember?.image ?? null}
              onSuccess={() => setShowInput(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowInput(true)}
              className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              <FontAwesomeIcon icon={faComment} className="size-4" />
              <span>Add a comment…</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
