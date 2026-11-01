import { faArrowUp, faClockRotateLeft, faPen, faThumbtack, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatZonedDateKey, type AgentMessage, type AgentThreadDetail, type AgentThreadSummary } from '@work-ledger/contracts';
import { useLocalSearchParams } from 'expo-router';
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
import { LogoMark } from '@/components/logo-mark';
import { PressableScale } from '@/components/motion/pressable-scale';
import { StackHeader } from '@/components/shell/screen-header';
import { Text } from '@/components/text';
import { IconButton } from '@/components/ui';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { agentKeys, streamAsk } from '@/lib/agent';
import { api } from '@/lib/api';
import { useWorkspace } from '@/lib/workspace';

type ChatMessage = Pick<AgentMessage, 'id' | 'role' | 'content' | 'steps'>;

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
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setRunning(false);
    setError(null);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || running || !orgId) return;
      setInput('');
      setError(null);
      setView('chat');
      setRunning(true);
      setLiveSteps([]);
      setMessages((m) => [...m, { id: `local-${Date.now()}`, role: 'user', content: message, steps: null }]);

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const steps: string[] = [];
      try {
        await streamAsk(
          orgId,
          { message, threadId: threadId ?? undefined, taskId: threadId ? undefined : (taskId ?? undefined) },
          (e) => {
            if (e.type === 'thread') {
              setThreadId(e.threadId);
              setTitle(e.title);
            } else if (e.type === 'step') {
              steps.push(e.label);
              setLiveSteps([...steps]);
            } else if (e.type === 'answer') {
              setTitle(e.title);
              setMessages((m) => [...m, { id: e.messageId, role: 'assistant', content: e.text, steps: steps.map((label) => ({ label })) }]);
            } else if (e.type === 'error') {
              setError(e.message);
            }
          },
          ctrl.signal,
        );
      } catch (err) {
        if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        if (abortRef.current === ctrl) {
          setRunning(false);
          setLiveSteps([]);
          void queryClient.invalidateQueries({ queryKey: agentKeys.threads(orgId) });
        }
      }
    },
    [running, orgId, threadId, taskId, queryClient],
  );

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
        setError("Couldn't open that conversation.");
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
                  <Text key={m.id} size="15" weight="semibold">
                    {m.content}
                  </Text>
                ) : (
                  <Animated.View key={m.id} entering={FadeIn.duration(180)} style={styles.answer}>
                    <View style={{ paddingTop: 2 }}>
                      <LogoMark size={18} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                      {m.steps?.length ? <Steps steps={m.steps.map((s) => s.label)} /> : null}
                      <AgentText text={m.content} />
                    </View>
                  </Animated.View>
                ),
              )
            )}
            {running ? (
              <View style={styles.answer}>
                <View style={{ paddingTop: 2 }}>
                  <LogoMark size={18} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  {liveSteps.length > 1 ? <Steps steps={liveSteps.slice(0, -1)} /> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color={theme.muted} style={{ transform: [{ scale: 0.7 }] }} />
                    <Text size="xs" color="muted" numberOfLines={1} style={{ flex: 1 }}>
                      {liveSteps.at(-1) ?? 'Working on it'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
            {error ? (
              <Text size="sm" color="#dc2626">
                {error}
              </Text>
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
              <PressableScale
                scaleTo={0.92}
                accessibilityRole="button"
                accessibilityLabel="Ask"
                disabled={!input.trim() || running}
                onPress={() => void send(input)}
                style={[styles.sendBtn, { backgroundColor: theme.accent, opacity: !input.trim() || running ? 0.3 : 1 }]}>
                <Icon icon={faArrowUp} size={14} color={theme.onAccent} />
              </PressableScale>
            </View>
            <Text size="10" color="muted" style={{ paddingHorizontal: 4 }}>
              LogBase can read your workspace but can&apos;t change anything yet.
            </Text>
          </View>
        </KeyboardAvoidingView>
      )}
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
  composer: { paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth * 2, gap: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderWidth: 1, borderRadius: Radius.xxxl + 4, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, fontSize: 15, lineHeight: 21, maxHeight: 120, paddingVertical: 6 },
  sendBtn: { width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  group: { borderRadius: Radius.xxxl + 4, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 14, paddingRight: 4 },
});
