import { faComment, faPaperPlane, faPen, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { Avatar, EmptyState } from '@/components/ui';
import { listLayout, revealIn, revealOut } from '@/constants/motion';
import { Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { timeAgo } from '@/lib/format';
import {
  useDeleteComment,
  useEditComment,
  usePostComment,
  useRestoreComment,
  type CommentRow,
} from '@/lib/queries';
import type { MemberRow } from '@/lib/types';

const MENTION_PATTERN = /@\[([^\]]+)\]\(([^)]+)\)/g;

function memberLabel(m: MemberRow): string {
  return m.name?.trim() || m.email || 'Unknown';
}

/** Renders `@[Name](userId)` runs as blue highlighted spans, matching the web's `MentionHighlightedBody`. */
function MentionHighlightedBody({ body }: { body: string }) {
  const dark = useIsDark();
  const parts = body.split(MENTION_PATTERN);
  // String.split with a capturing global regex interleaves [text, name, userId, text, name, userId, ...].
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i]) nodes.push(<Text key={`t${i}`}>{parts[i]}</Text>);
    if (parts[i + 1] !== undefined) {
      nodes.push(
        <Text key={`m${i}`} weight="medium" color={dark ? Tone.blue400 : Tone.blue600}>
          @{parts[i + 1]}
        </Text>,
      );
    }
  }
  return <Text size="sm">{nodes}</Text>;
}

function MentionPicker({ members, filter, onPick }: { members: MemberRow[]; filter: string; onPick: (m: MemberRow) => void }) {
  const theme = useTheme();
  const matches = members.filter((m) => memberLabel(m).toLowerCase().includes(filter.toLowerCase())).slice(0, 6);
  if (matches.length === 0) return null;
  return (
    <View style={[styles.mentionList, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
      {matches.map((m) => (
        <PressableScale key={m.userId} style={styles.mentionRow} onPress={() => onPick(m)}>
          <Avatar name={m.name} email={m.email} image={m.image} size={20} />
          <Text size="sm" numberOfLines={1}>
            {memberLabel(m)}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

function Composer({
  taskId,
  members,
  parentCommentId,
  initialBody = '',
  placeholder,
  onDone,
}: {
  taskId: string;
  members: MemberRow[];
  parentCommentId?: string;
  initialBody?: string;
  placeholder?: string;
  onDone: () => void;
}) {
  const theme = useTheme();
  const post = usePostComment(taskId);
  const [body, setBody] = useState(initialBody);
  const [mentionFilter, setMentionFilter] = useState<string | null>(null);

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed || post.isPending) return;
    post.mutate({ body: trimmed, parentCommentId }, { onSuccess: onDone });
  };

  const handleChange = (val: string) => {
    setBody(val);
    const match = val.match(/@(\w*)$/);
    setMentionFilter(match ? match[1]! : null);
  };

  const insertMention = (m: MemberRow) => {
    const at = body.lastIndexOf('@');
    setBody(`${body.slice(0, at)}@[${memberLabel(m)}](${m.userId}) `);
    setMentionFilter(null);
  };

  return (
    <View>
      {mentionFilter !== null ? <MentionPicker members={members} filter={mentionFilter} onPick={insertMention} /> : null}
      <View style={styles.composerRow}>
        <TextInput
          multiline
          value={body}
          onChangeText={handleChange}
          placeholder={placeholder ?? 'Add a comment…'}
          placeholderTextColor={theme.muted}
          style={[styles.composerInput, { backgroundColor: theme.surfaceMuted, color: theme.fg }]}
        />
        <PressableScale
          disabled={!body.trim() || post.isPending}
          onPress={submit}
          style={[styles.sendBtn, { backgroundColor: theme.accent, opacity: !body.trim() || post.isPending ? 0.4 : 1 }]}>
          <Icon icon={faPaperPlane} size={14} color={theme.onAccent} />
        </PressableScale>
      </View>
    </View>
  );
}

function CommentItem({
  comment,
  replies,
  taskId,
  members,
  userId,
  isOrgOwner,
  replyingTo,
  replyMention,
  onReply,
  onCancelReply,
}: {
  comment: CommentRow;
  replies: CommentRow[];
  taskId: string;
  members: MemberRow[];
  userId: string;
  isOrgOwner: boolean;
  replyingTo: string | null;
  replyMention: string;
  onReply: (rootId: string, mention: string) => void;
  onCancelReply: () => void;
}) {
  const theme = useTheme();
  const editComment = useEditComment(taskId);
  const deleteComment = useDeleteComment(taskId);
  const restoreComment = useRestoreComment(taskId);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body ?? '');
  const isOwn = comment.authorId === userId;

  return (
    <Animated.View layout={listLayout}>
      <View style={[styles.commentRow, { backgroundColor: theme.surfaceElevated }]}>
        <Avatar name={comment.authorName} email={comment.authorEmail} image={comment.authorImage} size={28} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.commentHead}>
            <Text size="xs" weight="semibold" color={isOwn ? 'accent' : 'fg'}>
              {comment.authorName || comment.authorEmail}
            </Text>
            <Text size="10" color="muted">
              {timeAgo(comment.createdAt)}
              {comment.editedAt ? ' · edited' : ''}
            </Text>
            {isOwn && !comment.deletedAt ? (
              <PressableScale
                hitSlop={6}
                onPress={() => {
                  setEditing(true);
                  setEditBody(comment.body ?? '');
                }}>
                <Icon icon={faPen} size={10} color="muted" />
              </PressableScale>
            ) : null}
            {(isOwn || isOrgOwner) && !comment.deletedAt ? (
              <PressableScale hitSlop={6} onPress={() => deleteComment.mutate(comment.id)}>
                <Icon icon={faTrashCan} size={10} color="muted" />
              </PressableScale>
            ) : null}
          </View>

          {comment.deletedAt ? (
            <View style={styles.deletedRow}>
              <Text size="sm" color="muted" style={{ fontStyle: 'italic' }}>
                Comment removed.
              </Text>
              {isOwn || isOrgOwner ? (
                <PressableScale onPress={() => restoreComment.mutate(comment.id)}>
                  <Text size="10" weight="medium" color="muted" style={{ textDecorationLine: 'underline' }}>
                    Restore
                  </Text>
                </PressableScale>
              ) : null}
            </View>
          ) : editing ? (
            <View style={{ gap: 6 }}>
              <TextInput
                multiline
                value={editBody}
                onChangeText={setEditBody}
                style={[styles.editInput, { backgroundColor: theme.surfaceMuted, color: theme.fg }]}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <PressableScale
                  disabled={!editBody.trim() || editComment.isPending}
                  onPress={() => editComment.mutate({ commentId: comment.id, body: editBody.trim() }, { onSuccess: () => setEditing(false) })}>
                  <Text size="xs" weight="medium" color="accent">
                    Save
                  </Text>
                </PressableScale>
                <PressableScale onPress={() => setEditing(false)}>
                  <Text size="xs" weight="medium" color="muted">
                    Cancel
                  </Text>
                </PressableScale>
              </View>
            </View>
          ) : (
            <View style={styles.bodyRow}>
              <MentionHighlightedBody body={comment.body ?? ''} />
              <PressableScale
                onPress={() => {
                  const rootId = comment.parentCommentId ?? comment.id;
                  onReply(rootId, `@${comment.authorName ?? comment.authorEmail} `);
                }}>
                <Text size="10" color="muted">
                  Reply
                </Text>
              </PressableScale>
            </View>
          )}
        </View>
      </View>

      {replies.length > 0 ? (
        <View style={[styles.replies, { borderColor: theme.borderSubtle }]}>
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              replies={[]}
              taskId={taskId}
              members={members}
              userId={userId}
              isOrgOwner={isOrgOwner}
              replyingTo={replyingTo}
              replyMention={replyMention}
              onReply={onReply}
              onCancelReply={onCancelReply}
            />
          ))}
        </View>
      ) : null}

      {replyingTo === comment.id ? (
        <Animated.View entering={revealIn} exiting={revealOut} style={styles.replyComposer}>
          <Composer
            key={replyMention}
            taskId={taskId}
            members={members}
            parentCommentId={comment.id}
            initialBody={replyMention}
            placeholder="Reply…"
            onDone={onCancelReply}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** Comments card — a mobile port of the web's `CommentThread`: threaded replies, @mentions, inline edit, soft-delete + restore. */
export function CommentThreadCard({
  taskId,
  members,
  userId,
  isOrgOwner,
  comments,
}: {
  taskId: string;
  members: MemberRow[];
  userId: string;
  isOrgOwner: boolean;
  comments: CommentRow[];
}) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyMention, setReplyMention] = useState('');
  const [showInput, setShowInput] = useState(false);
  const theme = useTheme();

  const roots = useMemo(() => comments.filter((c) => !c.parentCommentId), [comments]);
  const repliesByRoot = useMemo(() => {
    const m = new Map<string, CommentRow[]>();
    for (const c of comments) {
      if (!c.parentCommentId) continue;
      m.set(c.parentCommentId, [...(m.get(c.parentCommentId) ?? []), c]);
    }
    return m;
  }, [comments]);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.borderSubtle }]}>
      <Text size="xs" weight="semibold" color="muted" uppercase tracking={0.5} style={styles.cardTitle}>
        Comments
      </Text>

      <View style={{ gap: 8, paddingHorizontal: 12 }}>
        {roots.length === 0 ? (
          <EmptyState compact icon={faComment} title="No comments yet" description="Be the first to comment." />
        ) : (
          roots.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              replies={repliesByRoot.get(c.id) ?? []}
              taskId={taskId}
              members={members}
              userId={userId}
              isOrgOwner={isOrgOwner}
              replyingTo={replyingTo}
              replyMention={replyMention}
              onReply={(rootId, mention) => {
                if (replyingTo === rootId) {
                  setReplyingTo(null);
                  setReplyMention('');
                } else {
                  setReplyingTo(rootId);
                  setReplyMention(mention);
                }
              }}
              onCancelReply={() => {
                setReplyingTo(null);
                setReplyMention('');
              }}
            />
          ))
        )}
      </View>

      <View style={[styles.footer, { borderTopColor: theme.borderSubtle }]}>
        {showInput ? (
          <Composer taskId={taskId} members={members} onDone={() => setShowInput(false)} />
        ) : (
          <PressableScale style={styles.addCommentBtn} onPress={() => setShowInput(true)}>
            <Icon icon={faComment} size={14} color="muted" />
            <Text size="sm" color="muted">
              Add a comment…
            </Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xxl, borderWidth: 1, overflow: 'hidden' },
  cardTitle: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: Radius.xl, paddingHorizontal: 10, paddingVertical: 8 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  bodyRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  deletedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editInput: { minHeight: 50, borderRadius: Radius.lg, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  replies: { marginLeft: 22, marginTop: 4, gap: 4, borderLeftWidth: StyleSheet.hairlineWidth * 2, paddingLeft: 10 },
  replyComposer: { marginLeft: 22, marginTop: 4 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, paddingVertical: 10 },
  addCommentBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerInput: { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: Radius.xxl, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  mentionList: { position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, width: 220, maxHeight: 180, borderRadius: Radius.xl, borderWidth: 1, paddingVertical: 4, zIndex: 50 },
  mentionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
});
