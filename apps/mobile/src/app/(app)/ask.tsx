import { faArrowUp, faClockRotateLeft, faPen, faThumbtack, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatZonedDateKey,
  type AgentMessage,
  type AgentProposal,
  type AgentThreadDetail,
  type AgentThreadSummary,
} from '@work-ledger/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgentText } from '@/components/agent/agent-text';
import { Icon } from '@/components/icon';
import { AiIcon } from '@/components/agent/ai-icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { StackHeader } from '@/components/shell/screen-header';
import { Text } from '@/components/text';
import { IconButton } from '@/components/ui';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { agentKeys, streamAsk } from '@/lib/agent';
import { api } from '@/lib/api';
import { useWorkspace } from '@/lib/workspace';

type ChatMessage = Pick<AgentMessage, 'id' | 'role' | 'content' | 'steps' | 'proposals'>;

const SUGGESTIONS = ["What's overdue right now?", "What's due for me this week?", 'What changed today?'];
const TASK_SUGGESTIONS = ['Summarize this task', "What's still left to do?", 'Who changed what recently?'];

/**
 * Ask LogBase. Opened from Search (`q` = the typed question, sent straight away) or from a task (`taskId`).
 * Conversations are kept; the History view lists them.
 */
export default function AskScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string; taskId?: string }>();
  const { org } = useWorkspace();
  const orgId = org?.id;
  const queryClient = useQueryClient();

  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(params.taskId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveSteps, setLiveSteps] = useState<string[]>([]);
  /** Answer text streamed so far; a later tool step means it was a preamble and is dropped. */
  const [draft, setDraft] = useState('');
  /** Changes proposed during the run in progress; they move onto the answer when it lands. */
  const [liveProposals, setLiveProposals] = useState<AgentProposal[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<{ message: string; retry: string | null } | null>(null);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setThreadId(null);
    setTitle(null);
    setMessages([]);
    setLiveSteps([]);
    setDraft('');
    setRunning(false);
    setError(null);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setLiveSteps([]);
    setDraft('');
  }, []);

  const send = useCallback(
    async (text: string, opts?: { retry?: boolean }) => {
      const message = text.trim();
      if (!message || running || !orgId) return;
      setInput('');
      setError(null);
      setView('chat');
      setRunning(true);
      setLiveSteps([]);
      setDraft('');
      // Retrying: the failed question is already on screen, so it isn't added a second time.
      if (!opts?.retry) setMessages((m) => [...m, { id: `local-${Date.now()}`, role: 'user', content: message, steps: null }]);

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const steps: string[] = [];
      const proposals: AgentProposal[] = [];
      setLiveProposals([]);
      try {
        await streamAsk(
          orgId,
          { message, threadId: threadId ?? undefined, taskId: threadId ? undefined : (taskId ?? undefined) },
          (e) => {
            if (ctrl.signal.aborted) return;
            if (e.type === 'thread') {
              setThreadId(e.threadId);
              setTitle(e.title);
            } else if (e.type === 'step') {
              steps.push(e.label);
              setLiveSteps([...steps]);
              setDraft('');
            } else if (e.type === 'delta') {
              setDraft((d) => d + e.text);
            } else if (e.type === 'proposal') {
              proposals.push(e.proposal);
              setLiveProposals([...proposals]);
            } else if (e.type === 'answer') {
              // The answer is final: drop the working turn now rather than when the stream closes a beat later.
              setRunning(false);
              setLiveSteps([]);
              setTitle(e.title);
              setDraft('');
              setLiveProposals([]);
              setMessages((m) => [
                ...m,
                {
                  id: e.messageId,
                  role: 'assistant',
                  content: e.text,
                  steps: steps.map((label) => ({ label })),
                  proposals: proposals.length ? [...proposals] : undefined,
                },
              ]);
            } else if (e.type === 'error') {
              setError({ message: e.message, retry: message });
            }
          },
          ctrl.signal,
        );
      } catch (err) {
        if (!ctrl.signal.aborted) setError({ message: err instanceof Error ? err.message : 'Something went wrong.', retry: message });
      } finally {
        if (abortRef.current === ctrl) {
          abortRef.current = null;
          setRunning(false);
          setLiveSteps([]);
          setLiveProposals([]);
          setDraft('');
          void queryClient.invalidateQueries({ queryKey: agentKeys.threads(orgId) });
        }
      }
    },
    [running, orgId, threadId, taskId, queryClient],
  );

  const decideProposal = useCallback(async (id: string, action: 'approve' | 'reject') => {
    try {
      const next = await api<AgentProposal>(`/agent/proposals/${id}/${action}`, { method: 'POST' });
      const swap = (list?: AgentProposal[]) => list?.map((x) => (x.id === id ? next : x));
      setLiveProposals((l) => swap(l) ?? l);
      setMessages((ms) => ms.map((m) => (m.proposals?.some((x) => x.id === id) ? { ...m, proposals: swap(m.proposals) } : m)));
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Couldn't apply that change.", retry: null });
    }
  }, []);

  const loadThread = useCallback(
    async (id: string) => {
      reset();
      setView('chat');
      try {
        const detail = await queryClient.fetchQuery({
          queryKey: agentKeys.thread(id),
          queryFn: () => api<AgentThreadDetail>(`/agent/threads/${id}`),
          staleTime: 0,
        });
        setThreadId(detail.id);
        setTitle(detail.title);
        setTaskId(detail.taskId);
        setMessages(detail.messages);
      } catch {
        setError({ message: "Couldn't open that conversation.", retry: null });
      }
    },
    [queryClient, reset],
  );

  // A question typed in Search is sent once the workspace is known. Deferred a tick so the send's state
  // updates land outside the effect body (and a Strict Mode re-run cancels the first schedule, not a request).
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  useEffect(() => {
    if (!orgId || !params.q) return;
    const q = params.q;
    const t = setTimeout(() => void sendRef.current(q), 0);
    return () => clearTimeout(t);
  }, [orgId, params.q]);

  return (
    <View style={[styles.fill, { backgroundColor: theme.surfaceBase }]}>
      <StackHeader
        title={view === 'history' ? 'History' : (title ?? 'Ask LogBase')}
        right={
          <View style={{ flexDirection: 'row' }}>
            <IconButton icon={faPen} label="New conversation" onPress={() => { reset(); setTaskId(null); }} iconSize={15} />
            <IconButton
              icon={faClockRotateLeft}
              label={view === 'history' ? 'Back to conversation' : 'History'}
              active={view === 'history'}
              onPress={() => setView((v) => (v === 'history' ? 'chat' : 'history'))}
              iconSize={15}
            />
          </View>
        }
      />

      {view === 'history' ? (
        <History orgId={orgId} timeZone={org?.timeZone ?? 'UTC'} activeId={threadId} onOpen={loadThread} onDeleted={(id) => id === threadId && reset()} />
      ) : (
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            style={styles.fill}
            contentContainerStyle={[styles.chat, messages.length === 0 && !running && { flexGrow: 1, justifyContent: 'flex-end' }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {messages.length === 0 && !running ? (
              <View style={{ gap: 12 }}>
                <Text size="sm" color="muted">
                  {taskId
                    ? "Ask anything about this task: what's left, who's on it, what changed."
                    : 'Ask about tasks, people, deadlines or the roadmap. LogBase looks it up for you.'}
                </Text>
                <View style={styles.chips}>
                  {(taskId ? TASK_SUGGESTIONS : SUGGESTIONS).map((s) => (
                    <PressableScale
                      key={s}
                      scaleTo={0.97}
                      onPress={() => void send(s)}
                      style={[styles.chip, { borderColor: theme.borderSubtle }]}>
                      <Text size="13">{s}</Text>
                    </PressableScale>
                  ))}
                </View>
              </View>
            ) : (
              messages.map((m) =>
                m.role === 'user' ? (
                  <View key={m.id} style={[styles.bubble, { backgroundColor: theme.surfaceElevated }]}>
                    <Text size="15">{m.content}</Text>
                  </View>
                ) : (
                  <Animated.View key={m.id} entering={FadeIn.duration(180)} style={styles.answer}>
                    <View style={{ paddingTop: 2 }}>
                      <AiIcon size={16} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                      {m.steps?.length ? <StepsToggle steps={m.steps.map((s) => s.label)} /> : null}
                      <AgentText text={m.content} />
                      {m.proposals?.map((pr) => <ProposalCard key={pr.id} proposal={pr} onDecide={decideProposal} />)}
                    </View>
                  </Animated.View>
                ),
              )
            )}
            {running ? (
              <View style={styles.answer}>
                <View style={{ paddingTop: 2 }}>
                  <AiIcon size={16} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                  {liveSteps.length > 0 ? <Steps steps={liveSteps} /> : null}
                  {liveProposals.map((pr) => (
                    <ProposalCard key={pr.id} proposal={pr} onDecide={decideProposal} />
                  ))}
                  {draft ? (
                    <AgentText text={draft} />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator size="small" color={theme.muted} style={{ transform: [{ scale: 0.7 }] }} />
                      <Text size="xs" color="muted" numberOfLines={1} style={{ flex: 1 }}>
                        {liveSteps.length ? 'Reading the results' : 'Looking into it'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : null}
            {error ? (
              <View style={[styles.errorRow, { borderColor: theme.borderSubtle }]}>
                <View style={styles.errorDot} />
                <Text size="sm" style={{ flex: 1 }}>
                  {error.message}
                </Text>
                {error.retry ? (
                  <PressableScale scaleTo={0.95} accessibilityRole="button" onPress={() => void send(error.retry!, { retry: true })}>
                    <Text size="13" weight="semibold" color="muted">
                      Retry
                    </Text>
                  </PressableScale>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10), borderTopColor: theme.borderSubtle }]}>
            <View style={[styles.inputWrap, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={taskId && !threadId ? 'Ask about this task…' : 'Ask LogBase…'}
                placeholderTextColor={theme.muted}
                multiline
                maxLength={4000}
                style={[styles.input, { color: theme.fg, fontFamily: Fonts.sans.regular }]}
                submitBehavior="submit"
                returnKeyType="send"
                onSubmitEditing={() => void send(input)}
              />
              {running ? (
                <PressableScale
                  scaleTo={0.92}
                  accessibilityRole="button"
                  accessibilityLabel="Stop"
                  onPress={stop}
                  style={[styles.sendBtn, { borderWidth: 1, borderColor: theme.border }]}>
                  <View style={[styles.stopGlyph, { backgroundColor: theme.fg }]} />
                </PressableScale>
              ) : (
                <PressableScale
                  scaleTo={0.92}
                  accessibilityRole="button"
                  accessibilityLabel="Ask"
                  disabled={!input.trim()}
                  onPress={() => void send(input)}
                  style={[styles.sendBtn, { backgroundColor: theme.accent, opacity: input.trim() ? 1 : 0.3 }]}>
                  <Icon icon={faArrowUp} size={14} color={theme.onAccent} />
                </PressableScale>
              )}
            </View>
            <Text size="10" color="muted" style={{ paddingHorizontal: 4 }}>
              {taskId && !threadId ? 'About this task · changes need your approval' : 'Changes only happen when you approve them'}
            </Text>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const PROPOSAL_STATE: Record<AgentProposal['status'], { label: string; color: string }> = {
  pending: { label: 'Needs your approval', color: '#38bdf8' },
  applied: { label: 'Applied', color: '#10b981' },
  partial: { label: 'Partly applied', color: '#f59e0b' },
  failed: { label: "Couldn't apply", color: '#ef4444' },
  rejected: { label: 'Rejected', color: 'muted' },
  expired: { label: 'Expired', color: 'muted' },
};

/** A change the agent wants to make: before → after per task, and Approve / Reject. Nothing happens until Approve. */
function ProposalCard({ proposal, onDecide }: { proposal: AgentProposal; onDecide: (id: string, a: 'approve' | 'reject') => Promise<void> }) {
  const theme = useTheme();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const pending = proposal.status === 'pending';
  const state = PROPOSAL_STATE[proposal.status];
  const outcome = new Map((proposal.result ?? []).map((r) => [r.taskId, r]));
  const decide = async (a: 'approve' | 'reject') => {
    setBusy(a);
    await onDecide(proposal.id, a);
    setBusy(null);
  };
  return (
    <View style={[styles.proposal, { borderColor: pending ? 'rgba(56,189,248,0.45)' : theme.borderSubtle, backgroundColor: theme.surfaceBase }]}>
      <View style={[styles.proposalHead, { borderBottomColor: theme.borderSubtle }]}>
        <AiIcon size={13} color={pending ? '#38bdf8' : 'muted'} />
        <Text size="13" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
          {proposal.summary}
        </Text>
        <Text size="11" weight="medium" color={state.color}>
          {state.label}
        </Text>
      </View>
      {proposal.items.map((it, i) => {
        const res = outcome.get(it.taskId);
        return (
          <Pressable
            key={it.taskId}
            onPress={() => router.push({ pathname: '/task/[id]', params: { id: it.taskId } })}
            style={[styles.proposalRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: theme.borderSubtle }]}>
            <Text size="13" numberOfLines={1}>
              {res ? (res.ok ? '✓ ' : '✕ ') : ''}
              {it.title}
            </Text>
            {proposal.kind === 'comment' ? (
              <Text size="13" style={[styles.commentPreview, { backgroundColor: theme.surfaceElevated }]}>
                {it.to}
              </Text>
            ) : (
              <Text size="11" color="muted" numberOfLines={1}>
                <Text size="11" color="muted" style={{ textDecorationLine: 'line-through' }}>
                  {it.from ?? 'None'}
                </Text>
                {'  →  '}
                <Text size="11" weight="semibold">
                  {it.to}
                </Text>
              </Text>
            )}
            {res && !res.ok ? (
              <Text size="11" color="#ef4444">
                {res.error}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      {pending ? (
        <View style={[styles.proposalActions, { borderTopColor: theme.borderSubtle }]}>
          <PressableScale scaleTo={0.96} disabled={!!busy} onPress={() => void decide('reject')} style={styles.proposalBtn}>
            <Text size="13" weight="medium" color="muted">
              {busy === 'reject' ? 'Rejecting…' : 'Reject'}
            </Text>
          </PressableScale>
          <PressableScale
            scaleTo={0.96}
            disabled={!!busy}
            onPress={() => void decide('approve')}
            style={[styles.proposalBtn, { backgroundColor: theme.accent, opacity: busy ? 0.6 : 1 }]}>
            <Text size="13" weight="semibold" color={theme.onAccent}>
              {busy === 'approve' ? 'Applying…' : proposal.items.length > 1 ? `Approve ${proposal.items.length}` : 'Approve'}
            </Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

/** A finished answer's lookups, folded behind a "N lookups" line so the answer stays the focus. */
function StepsToggle({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={6} onPress={() => setOpen((v) => !v)}>
        <Text size="11" font="mono" color="muted">
          {`${open ? '▾' : '▸'} ${steps.length === 1 ? '1 lookup' : `${steps.length} lookups`}`}
        </Text>
      </Pressable>
      {open ? <Steps steps={steps} /> : null}
    </View>
  );
}

/** The tools the agent ran, one quiet mono line each. */
function Steps({ steps }: { steps: string[] }) {
  return (
    <View style={{ gap: 2 }}>
      {steps.map((s, i) => (
        <Text key={i} size="11" font="mono" color="muted" numberOfLines={1}>
          {`›  ${s}`}
        </Text>
      ))}
    </View>
  );
}

function History({
  orgId,
  timeZone,
  activeId,
  onOpen,
  onDeleted,
}: {
  orgId: string | undefined;
  timeZone: string;
  activeId: string | null;
  onOpen: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const threads = useQuery({
    queryKey: agentKeys.threads(orgId ?? ''),
    queryFn: () => api<AgentThreadSummary[]>(`/organizations/${orgId}/agent/threads`),
    enabled: !!orgId,
    staleTime: 15_000,
  });
  const groups = useMemo(() => groupThreads(threads.data ?? [], timeZone), [threads.data, timeZone]);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: agentKeys.threads(orgId ?? '') });

  if (threads.isLoading) return <ActivityIndicator style={{ marginTop: 24 }} color={theme.muted} />;
  if (groups.length === 0) {
    return (
      <Text size="sm" color="muted" style={{ padding: 16 }}>
        No conversations yet. They&apos;ll show up here.
      </Text>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
      {groups.map((g) => (
        <View key={g.label} style={{ gap: 6 }}>
          <Text size="xs" weight="semibold" color="muted" uppercase tracking={0.6} style={{ paddingHorizontal: 4 }}>
            {g.label}
          </Text>
          <View style={[styles.group, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
            {g.threads.map((t, i) => (
              <View
                key={t.id}
                style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: theme.borderSubtle }]}>
                <Pressable accessibilityRole="button" onPress={() => onOpen(t.id)} style={{ flex: 1, minWidth: 0, paddingVertical: 12 }}>
                  <Text size="sm" weight={t.id === activeId ? 'semibold' : 'regular'} numberOfLines={1}>
                    {t.title}
                  </Text>
                </Pressable>
                <IconButton
                  icon={faThumbtack}
                  label={t.pinned ? 'Unpin' : 'Pin'}
                  tone={t.pinned ? 'fg' : 'muted'}
                  size={36}
                  iconSize={13}
                  onPress={async () => {
                    await api(`/agent/threads/${t.id}`, { method: 'PATCH', body: { pinned: !t.pinned } });
                    refresh();
                  }}
                />
                <IconButton
                  icon={faTrashCan}
                  label="Delete conversation"
                  size={36}
                  iconSize={13}
                  onPress={async () => {
                    await api(`/agent/threads/${t.id}`, { method: 'DELETE' });
                    onDeleted(t.id);
                    refresh();
                  }}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
      <Text size="11" color="muted" style={{ paddingHorizontal: 4 }}>
        Conversations are private to you. Unpinned ones are cleared after 90 days.
      </Text>
    </ScrollView>
  );
}

function groupThreads(threads: AgentThreadSummary[], timeZone: string) {
  const now = new Date();
  const today = formatZonedDateKey(now, timeZone);
  const yesterday = formatZonedDateKey(new Date(now.getTime() - 86_400_000), timeZone);
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const buckets = new Map<string, AgentThreadSummary[]>();
  const push = (label: string, t: AgentThreadSummary) => buckets.set(label, [...(buckets.get(label) ?? []), t]);
  for (const t of threads) {
    if (t.pinned) {
      push('Pinned', t);
      continue;
    }
    const at = new Date(t.lastMessageAt);
    const key = formatZonedDateKey(at, timeZone);
    if (key === today) push('Today', t);
    else if (key === yesterday) push('Yesterday', t);
    else if (at.getTime() >= weekAgo) push('Last 7 days', t);
    else push('Older', t);
  }
  return ['Pinned', 'Today', 'Yesterday', 'Last 7 days', 'Older']
    .filter((l) => buckets.has(l))
    .map((label) => ({ label, threads: buckets.get(label)! }));
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  chat: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  answer: { flexDirection: 'row', gap: 10 },
  bubble: { alignSelf: 'flex-end', maxWidth: '85%', borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 9 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: Radius.xxxl, paddingHorizontal: 12, paddingVertical: 10 },
  errorDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  stopGlyph: { width: 10, height: 10, borderRadius: 2 },
  proposal: { borderWidth: 1, borderRadius: Radius.xxxl, overflow: 'hidden' },
  proposalHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  proposalRow: { paddingHorizontal: 12, paddingVertical: 9, gap: 3 },
  commentPreview: { marginTop: 4, borderRadius: Radius.xl, paddingHorizontal: 10, paddingVertical: 7 },
  proposalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  proposalBtn: { borderRadius: Radius.xl, paddingHorizontal: 14, paddingVertical: 7 },
  composer: { paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth * 2, gap: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderWidth: 1, borderRadius: Radius.xxxl + 4, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, fontSize: 15, lineHeight: 21, maxHeight: 120, paddingVertical: 6 },
  sendBtn: { width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  group: { borderRadius: Radius.xxxl + 4, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 14, paddingRight: 4 },
});
