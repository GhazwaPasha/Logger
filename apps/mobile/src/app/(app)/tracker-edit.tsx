import {
  faBell,
  faCalculator,
  faCalendarDays,
  faChevronRight,
  faDivide,
  faHashtag,
  faPlus,
  faRepeat,
  faScaleBalanced,
  faSliders,
  faTrash,
  faUser,
  faXmark,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  TRACKER_TEMPLATES,
  applyTrackerFormula,
  trackerSlotKeys,
  trackerTemplateById,
  type CreateTrackerInput,
  type TrackerFormula,
  type TrackerMetricUnit,
  type TrackerTemplate,
} from '@work-ledger/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { MenuSheet } from '@/components/menu-sheet';
import { PressableScale } from '@/components/motion/pressable-scale';
import { PageEnter } from '@/components/page';
import { StackHeader } from '@/components/shell/screen-header';
import { AssigneeSheet } from '@/components/tasks/detail/assignee-field';
import { Text } from '@/components/text';
import { Avatar, CenteredSpinner, ErrorBanner } from '@/components/ui';
import { Duration, POP_EASE, sequenceEnter } from '@/constants/motion';
import { alpha, Fonts, Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { useTrackerDetail, useTrackerWrites, type TrackerDetailResponse } from '@/lib/trackers';
import { useWorkspace } from '@/lib/workspace';

/* ───────────── helpers (same rules as the web editor) ───────────── */

type MetricDraft = {
  id: string;
  name: string;
  kind: 'input' | 'formula';
  unit: TrackerMetricUnit;
  target: string;
  direction: 'at_least' | 'at_most';
  formula: TrackerFormula | null;
};

const layout = LinearTransition.duration(Duration.base).easing(POP_EASE);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const UNIT_LABEL: Record<TrackerMetricUnit, string> = { count: 'Count', number: 'Number', currency: 'Money', percent: 'Percent' };
const OP_LABEL: Record<TrackerFormula['op'], string> = { div: '÷', mul: '×', add: '+', sub: '−' };
const OP_NAME: Record<TrackerFormula['op'], string> = { div: 'Divided by', mul: 'Times', add: 'Plus', sub: 'Minus' };

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
const num = (s: string) => {
  const v = Number(s.replace(/,/g, '').trim());
  return s.trim() !== '' && Number.isFinite(v) ? v : null;
};
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (key: string) => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};
const shortDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const timeLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`;
};
function groupDigits(raw: string) {
  const clean = raw.replace(/[^\d.]/g, '');
  const [int, ...rest] = clean.split('.');
  const grouped = (int ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rest.length ? `${grouped}.${rest.join('')}` : grouped;
}
function compact(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (a >= 100_000) return `${Math.round(v / 1000)}k`;
  if (a >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
type Preset = 'month' | 'quarter' | 'year';
function presetRange(p: Preset, today: string): [string, string] {
  const [y, m] = today.split('-').map(Number) as [number, number];
  if (p === 'month') return [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${lastDay(y, m)}`];
  if (p === 'year') return [`${y}-01-01`, `${y}-12-31`];
  const q = Math.floor((m - 1) / 3);
  return [`${y}-${pad(q * 3 + 1)}-01`, `${y}-${pad(q * 3 + 3)}-${lastDay(y, q * 3 + 3)}`];
}
const quarterOf = (today: string) => Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1;

function fromTemplate(t: TrackerTemplate): MetricDraft[] {
  const ids = new Map(t.metrics.map((m) => [m.key, uuid()]));
  return t.metrics.map((m) => ({
    id: ids.get(m.key)!,
    name: m.name,
    kind: m.kind,
    unit: m.unit,
    target: m.target != null ? groupDigits(String(m.target)) : '',
    direction: m.direction ?? 'at_least',
    formula: m.formula ? { op: m.formula.op, a: ids.get(m.formula.a)!, b: ids.get(m.formula.b)!, percent: m.formula.percent } : null,
  }));
}
function formulaTarget(m: MetricDraft, all: MetricDraft[]): number | null {
  if (m.kind !== 'formula' || !m.formula) return null;
  const a = num(all.find((x) => x.id === m.formula!.a)?.target ?? '');
  const b = num(all.find((x) => x.id === m.formula!.b)?.target ?? '');
  return a != null && b != null ? applyTrackerFormula(m.formula, a, b) : null;
}

/* ───────────── route ───────────── */

/** Create or edit a tracker. `?id=` edits; `?template=` picks the starting point for a new one. */
export default function TrackerEditRoute() {
  const theme = useTheme();
  const { id, template } = useLocalSearchParams<{ id?: string; template?: string }>();
  const { org } = useWorkspace();
  const detail = useTrackerDetail(org?.id, id);

  return (
    <View style={{ flex: 1, backgroundColor: theme.surfaceBase }}>
      {id && !detail.data ? (
        <>
          <StackHeader title="Tracker" />
          {detail.error ? (
            <View style={{ padding: 16 }}>
              <ErrorBanner message={detail.error.message} onRetry={() => void detail.refetch()} />
            </View>
          ) : (
            <CenteredSpinner />
          )}
        </>
      ) : (
        <Editor key={id ?? 'new'} editing={detail.data ?? null} template={template ?? null} />
      )}
    </View>
  );
}

type SyncStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

function Editor({ editing, template }: { editing: TrackerDetailResponse | null; template: string | null }) {
  const theme = useTheme();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const { org, members } = useWorkspace();
  const writes = useTrackerWrites(org?.id);
  const divider = alpha(theme.fg, dark ? 0.08 : 0.07);
  const today = editing?.stats.today ?? keyOf(new Date());

  const start = trackerTemplateById(template) ?? TRACKER_TEMPLATES[0]!;
  const [defStart, defEnd] = presetRange('quarter', today);
  const [templateId, setTemplateId] = useState<string | null>(editing ? null : start.id);
  const [name, setName] = useState(editing?.name ?? (start.title ? `${start.title} · Q${quarterOf(today)}` : ''));
  const [assigneeId, setAssigneeId] = useState(editing?.assigneeId ?? '');
  const [periodStart, setPeriodStart] = useState(editing?.periodStart ?? defStart);
  const [periodEnd, setPeriodEnd] = useState(editing?.periodEnd ?? defEnd);
  const [split, setSplit] = useState<'day' | 'week'>(editing?.split ?? 'day');
  const [checkIn, setCheckIn] = useState<'daily' | 'weekly'>(editing?.checkIn ?? 'daily');
  const [workingDays, setWorkingDays] = useState<number[]>(editing?.workingDays ?? [1, 2, 3, 4, 5, 6, 7]);
  const [reminderTime, setReminderTime] = useState(editing ? (editing.reminderTime ?? '') : '18:00');
  const [metrics, setMetrics] = useState<MetricDraft[]>(() =>
    editing
      ? editing.metrics.map((m) => ({
          id: m.id,
          name: m.name,
          kind: m.kind,
          unit: m.unit,
          target: m.target != null ? groupDigits(String(m.target)) : '',
          direction: m.direction,
          formula: m.formula,
        }))
      : fromTemplate(start),
  );
  const [sheet, setSheet] = useState<
    | null
    | { kind: 'assignee' }
    | { kind: 'split' }
    | { kind: 'logs' }
    | { kind: 'unit'; id: string }
    | { kind: 'direction'; id: string }
    | { kind: 'op'; id: string }
    | { kind: 'operand'; id: string; side: 'a' | 'b' }
  >(null);
  const [sync, setSync] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const inputs = metrics.filter((m) => m.kind === 'input');
  const assignee = members.find((m) => m.userId === assigneeId) ?? null;
  const units = useMemo(
    () =>
      periodEnd < periodStart
        ? 0
        : trackerSlotKeys({ periodStart, periodEnd, split, checkIn: split === 'week' ? 'weekly' : 'daily', workingDays }).length,
    [periodStart, periodEnd, split, workingDays],
  );

  const patch = (id: string, p: Partial<MetricDraft>) => setMetrics((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)));

  function applyTemplate(t: TrackerTemplate) {
    haptics.select();
    setTemplateId(t.id);
    setMetrics(fromTemplate(t));
    if (!name.trim() || TRACKER_TEMPLATES.some((x) => x.title && name.startsWith(x.title))) {
      setName(t.title ? `${t.title} · Q${quarterOf(today)}` : '');
    }
  }
  function addMetric(kind: 'input' | 'formula') {
    if (kind === 'formula' && inputs.length < 2) {
      Alert.alert('Add two metrics first', 'A calculated metric is made from two others, like revenue ÷ orders.');
      return;
    }
    haptics.tap();
    setMetrics((ms) => [
      ...ms,
      {
        id: uuid(),
        name: '',
        kind,
        unit: kind === 'formula' ? 'number' : 'count',
        target: '',
        direction: 'at_least',
        formula: kind === 'formula' ? { op: 'div', a: inputs[inputs.length - 1]!.id, b: inputs[0]!.id } : null,
      },
    ]);
  }
  const removeMetric = (id: string) =>
    setMetrics((ms) => ms.filter((m) => m.id !== id && !(m.formula && (m.formula.a === id || m.formula.b === id))));

  /* ───────────── autosave (same rules as the web editor) ───────────── */

  const problem = !name.trim()
    ? 'Name it to start saving'
    : periodEnd < periodStart
        ? 'The period ends before it starts'
        : metrics.some((m) => !m.name.trim())
          ? 'Every metric needs a name'
          : inputs.length === 0
            ? 'Add a metric to log'
            : null;

  const payloadKey = problem
    ? null
    : JSON.stringify({
        name: name.trim(),
        // Optional: the tracker saves before anyone is assigned.
        assigneeId: assigneeId || null,
        periodStart,
        periodEnd,
        split,
        checkIn,
        workingDays,
        reminderTime: reminderTime || null,
        metrics: metrics.map((m) => ({
          id: m.id,
          name: m.name.trim(),
          kind: m.kind,
          unit: m.unit,
          currency: null,
          target: m.kind === 'formula' ? formulaTarget(m, metrics) : num(m.target),
          direction: m.direction,
          formula: m.kind === 'formula' ? m.formula : null,
        })),
      } satisfies CreateTrackerInput);

  const savedIdRef = useRef<string | null>(editing?.id ?? null);
  const lastSavedRef = useRef<string | null | undefined>(editing ? undefined : null);
  const latestRef = useRef<string | null>(payloadKey);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);

  useEffect(() => {
    latestRef.current = payloadKey;
    if (lastSavedRef.current === undefined) {
      lastSavedRef.current = payloadKey;
      return;
    }
    if (!payloadKey || payloadKey === lastSavedRef.current) return;
    setSync('pending');
    const t = setTimeout(() => void flush(), 700);
    return () => clearTimeout(t);
    // `flush` reads only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey]);

  async function flush() {
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    const key = latestRef.current;
    if (!key || key === lastSavedRef.current) return;
    inFlightRef.current = true;
    setSync('saving');
    try {
      const input = JSON.parse(key) as CreateTrackerInput;
      if (savedIdRef.current) await writes.update(savedIdRef.current, input);
      else savedIdRef.current = (await writes.create(input)).id;
      lastSavedRef.current = key;
      setSync(latestRef.current === key ? 'saved' : 'pending');
      setSyncError(null);
    } catch (e) {
      setSync('error');
      setSyncError(e instanceof Error ? e.message : "Couldn't save the tracker");
    } finally {
      inFlightRef.current = false;
      if (queuedRef.current || (latestRef.current && latestRef.current !== lastSavedRef.current)) {
        queuedRef.current = false;
        void flush();
      }
    }
  }

  async function leave() {
    if (latestRef.current && latestRef.current !== lastSavedRef.current) await flush();
    if (router.canGoBack()) router.back();
    else router.replace('/trackers');
  }

  const status =
    sync === 'saving' || sync === 'pending'
      ? 'Saving…'
      : sync === 'error'
        ? 'Not saved'
        : sync === 'saved'
          ? 'Saved'
          : problem && !savedIdRef.current
            ? 'Draft'
            : '';

  /* ───────────── pickers ───────────── */

  function pickDate(which: 'start' | 'end') {
    const value = dateOf(which === 'start' ? periodStart : periodEnd);
    const set = (d: Date) => (which === 'start' ? setPeriodStart(keyOf(d)) : setPeriodEnd(keyOf(d)));
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value, mode: 'date', onChange: (e, d) => e.type === 'set' && d && set(d) });
    }
  }
  function pickTime() {
    const [h, m] = (reminderTime || '18:00').split(':').map(Number) as [number, number];
    const value = new Date();
    value.setHours(h, m, 0, 0);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'time',
        onChange: (e, d) => e.type === 'set' && d && setReminderTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`),
      });
    }
  }

  const metricFor = (id: string) => metrics.find((m) => m.id === id);

  return (
    <>
      <StackHeader
        title={editing ? 'Edit tracker' : 'New tracker'}
        onBack={() => void leave()}
        right={
          <View style={styles.headerRight}>
            {status ? (
              <Text size="xs" color={sync === 'error' ? Tone.red500 : 'muted'} numberOfLines={1}>
                {status}
              </Text>
            ) : null}
            <PressableScale haptic="tap" onPress={() => void leave()} style={[styles.doneBtn, { backgroundColor: theme.accent }]}>
              <Text size="13" weight="semibold" color={theme.onAccent}>
                Done
              </Text>
            </PressableScale>
          </View>
        }
      />
      <PageEnter>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
            {syncError ? <ErrorBanner message={syncError} onRetry={() => void flush()} /> : null}

            <Animated.View entering={sequenceEnter(1, 8)} style={styles.titleWrap}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Name your tracker"
                placeholderTextColor={alpha(theme.muted, 0.7)}
                maxLength={120}
                style={[styles.titleInput, { color: theme.fg }]}
              />
              <Text size="xs" color="muted">
                {problem && !savedIdRef.current ? problem : 'One person, one set of targets. Changes save as you go.'}
              </Text>
            </Animated.View>

            {!editing ? (
              <Animated.View entering={sequenceEnter(2, 8)}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templates}>
                  {TRACKER_TEMPLATES.map((t) => {
                    const on = t.id === templateId;
                    return (
                      <PressableScale
                        key={t.id}
                        onPress={() => applyTemplate(t)}
                        style={[
                          styles.templateChip,
                          { backgroundColor: theme.surfaceMuted, borderColor: on ? theme.fg : theme.borderSubtle },
                        ]}>
                        <Text size="13" weight="semibold" color={on ? 'fg' : 'muted'}>
                          {t.name}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </ScrollView>
              </Animated.View>
            ) : null}

            {/* Details — same grouped rows as the task screen. */}
            <Animated.View entering={sequenceEnter(3, 8)} style={[styles.group, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
              <Row icon={faUser} label="Assigned to" onPress={() => setSheet({ kind: 'assignee' })}>
                {assignee ? <Avatar name={assignee.name} email={assignee.email} image={assignee.image} size={20} /> : null}
                <Text size="sm" weight="medium" color={assignee ? 'fg' : 'muted'} numberOfLines={1} style={{ flexShrink: 1 }}>
                  {assignee ? (assignee.name ?? '').trim() || assignee.email : 'Unassigned'}
                </Text>
              </Row>
              <Divider color={divider} />
              <DateRow label="From" value={periodStart} onPress={() => pickDate('start')} onIos={(k) => setPeriodStart(k)} />
              <Divider color={divider} />
              <DateRow label="To" value={periodEnd} onPress={() => pickDate('end')} onIos={(k) => setPeriodEnd(k)} />
              <Divider color={divider} />
              <View style={styles.presets}>
                {(['month', 'quarter', 'year'] as const).map((p) => {
                  const [s, e] = presetRange(p, today);
                  const on = s === periodStart && e === periodEnd;
                  return (
                    <PressableScale
                      key={p}
                      haptic="select"
                      onPress={() => {
                        setPeriodStart(s);
                        setPeriodEnd(e);
                      }}
                      style={[styles.presetChip, { backgroundColor: on ? theme.surfaceMuted : 'transparent', borderColor: theme.borderSubtle }]}>
                      <Text size="xs" weight="semibold" color={on ? 'fg' : 'muted'}>
                        {`This ${p}`}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </Animated.View>

            <Animated.View entering={sequenceEnter(4, 8)} layout={layout} style={styles.section}>
              <View style={styles.sectionHead}>
                <Text size="11" weight="semibold" color="muted" uppercase tracking={0.6}>
                  Targets
                </Text>
                {units > 0 ? (
                  <Text size="11" color="muted">{`${units} ${split === 'week' ? 'weeks' : 'working days'}`}</Text>
                ) : null}
              </View>
              {metrics.map((m) => {
                const t = m.kind === 'formula' ? formulaTarget(m, metrics) : num(m.target);
                const per = m.kind === 'input' && t != null && units > 0 ? t / units : null;
                return (
                  <Animated.View
                    key={m.id}
                    entering={FadeIn.duration(Duration.base)}
                    exiting={FadeOut.duration(Duration.micro)}
                    layout={layout}
                    style={[styles.group, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
                    <View style={styles.row}>
                      <Icon icon={m.kind === 'formula' ? faCalculator : faHashtag} size={13} color="muted" style={{ width: 16 }} />
                      <TextInput
                        value={m.name}
                        onChangeText={(v) => patch(m.id, { name: v })}
                        placeholder={m.kind === 'formula' ? 'Calculated metric' : 'Metric name'}
                        placeholderTextColor={alpha(theme.muted, 0.7)}
                        maxLength={80}
                        style={[styles.metricName, { color: theme.fg }]}
                      />
                      {metrics.length > 1 ? (
                        <PressableScale scaleTo={0.9} onPress={() => removeMetric(m.id)} accessibilityLabel={`Remove ${m.name || 'metric'}`} style={styles.iconBtn}>
                          <Icon icon={faXmark} size={12} color="muted" />
                        </PressableScale>
                      ) : null}
                    </View>
                    <Divider color={divider} />
                    {m.kind === 'formula' && m.formula ? (
                      <>
                        <View style={styles.row}>
                          <Icon icon={faDivide} size={13} color="muted" style={{ width: 16 }} />
                          <Text size="sm" color="muted" style={styles.label}>
                            Formula
                          </Text>
                          <View style={styles.formula}>
                            <MiniPick label={metricFor(m.formula.a)?.name || 'Pick'} onPress={() => setSheet({ kind: 'operand', id: m.id, side: 'a' })} />
                            <MiniPick label={OP_LABEL[m.formula.op]} onPress={() => setSheet({ kind: 'op', id: m.id })} />
                            <MiniPick label={metricFor(m.formula.b)?.name || 'Pick'} onPress={() => setSheet({ kind: 'operand', id: m.id, side: 'b' })} />
                          </View>
                        </View>
                        <Divider color={divider} />
                        <Row icon={faScaleBalanced} label="Target">
                          <Text size="sm" weight="semibold" tabular>
                            {t != null ? `${compact(t)}${m.formula.percent ? '%' : ''}` : '–'}
                          </Text>
                          <Text size="xs" color="muted">
                            auto
                          </Text>
                        </Row>
                      </>
                    ) : (
                      <>
                        <Row icon={faSliders} label="Measured as" onPress={() => setSheet({ kind: 'unit', id: m.id })}>
                          <Text size="sm" weight="medium">
                            {UNIT_LABEL[m.unit]}
                          </Text>
                        </Row>
                        <Divider color={divider} />
                        <View style={styles.row}>
                          <Icon icon={faScaleBalanced} size={13} color="muted" style={{ width: 16 }} />
                          <PressableScale haptic="select" onPress={() => setSheet({ kind: 'direction', id: m.id })} style={styles.labelBtn}>
                            <Text size="sm" color="muted">
                              {m.direction === 'at_most' ? 'At most' : 'At least'}
                            </Text>
                          </PressableScale>
                          <View style={styles.value}>
                            <TextInput
                              value={m.target}
                              onChangeText={(v) => patch(m.id, { target: groupDigits(v) })}
                              keyboardType="decimal-pad"
                              placeholder="Target"
                              placeholderTextColor={alpha(theme.muted, 0.7)}
                              style={[styles.numInput, { color: theme.fg }]}
                            />
                          </View>
                        </View>
                        {per != null ? (
                          <Text size="11" color="muted" style={styles.share}>
                            {`≈ ${compact(per)} ${split === 'week' ? 'a week' : 'a day'}`}
                          </Text>
                        ) : null}
                      </>
                    )}
                  </Animated.View>
                );
              })}
              <View style={styles.addRow}>
                <PressableScale onPress={() => addMetric('input')} style={[styles.addBtn, { borderColor: theme.borderSubtle, backgroundColor: theme.surfaceElevated }]}>
                  <Icon icon={faPlus} size={11} color="muted" />
                  <Text size="13" weight="medium" color="muted">
                    Add metric
                  </Text>
                </PressableScale>
                <PressableScale onPress={() => addMetric('formula')} style={[styles.addBtn, { borderColor: theme.borderSubtle, backgroundColor: theme.surfaceElevated }]}>
                  <Icon icon={faCalculator} size={11} color="muted" />
                  <Text size="13" weight="medium" color="muted">
                    Add calculated
                  </Text>
                </PressableScale>
              </View>
            </Animated.View>

            {/* Rhythm */}
            <Animated.View entering={sequenceEnter(5, 8)} style={[styles.group, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
              <Row icon={faRepeat} label="Target split" onPress={() => setSheet({ kind: 'split' })}>
                <Text size="sm" weight="medium">
                  {split === 'week' ? 'Per week' : 'Per working day'}
                </Text>
              </Row>
              <Divider color={divider} />
              <Row icon={faCalendarDays} label="Logs" onPress={() => setSheet({ kind: 'logs' })}>
                <Text size="sm" weight="medium">
                  {checkIn === 'weekly' ? 'Once a week' : 'Every day'}
                </Text>
              </Row>
              <Divider color={divider} />
              <View style={styles.daysRow}>
                {DAY_LETTERS.map((d, i) => {
                  const iso = i + 1;
                  const on = workingDays.includes(iso);
                  return (
                    <PressableScale
                      key={iso}
                      scaleTo={0.9}
                      haptic="select"
                      accessibilityLabel={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}
                      onPress={() => setWorkingDays((w) => (on ? (w.length > 1 ? w.filter((x) => x !== iso) : w) : [...w, iso].sort()))}
                      style={[
                        styles.day,
                        on ? { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle } : { borderColor: 'transparent' },
                      ]}>
                      <Text size="xs" weight="semibold" color={on ? 'fg' : 'muted'}>
                        {d}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
              <Divider color={divider} />
              <View style={styles.row}>
                <Icon icon={faBell} size={13} color="muted" style={{ width: 16 }} />
                <Text size="sm" color="muted" style={styles.label}>
                  Reminder
                </Text>
                <View style={styles.value}>
                  {reminderTime ? (
                    Platform.OS === 'ios' ? (
                      <DateTimePicker
                        value={(() => {
                          const [h, m] = reminderTime.split(':').map(Number) as [number, number];
                          const d = new Date();
                          d.setHours(h, m, 0, 0);
                          return d;
                        })()}
                        mode="time"
                        display="compact"
                        onChange={(_e, d) => d && setReminderTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}
                      />
                    ) : (
                      <PressableScale haptic="select" onPress={pickTime}>
                        <Text size="sm" weight="medium">
                          {timeLabel(reminderTime)}
                        </Text>
                      </PressableScale>
                    )
                  ) : null}
                  <Switch
                    value={Boolean(reminderTime)}
                    onValueChange={(v) => {
                      haptics.select();
                      setReminderTime(v ? '18:00' : '');
                    }}
                    trackColor={{ true: theme.accent, false: theme.surfaceMuted }}
                    thumbColor={theme.bg}
                  />
                </View>
              </View>
            </Animated.View>

            {editing ? (
              <Animated.View entering={sequenceEnter(6, 8)} style={{ gap: 8 }}>
                <PressableScale
                  onPress={() =>
                    void writes
                      .update(editing.id, { archived: !editing.archivedAt })
                      .then(() => router.back())
                      .catch((e: Error) => Alert.alert("Couldn't update the tracker", e.message))
                  }
                  style={[styles.actionBtn, { borderColor: theme.borderSubtle, backgroundColor: theme.surfaceElevated }]}>
                  <Text size="sm" weight="medium" color="muted">
                    {editing.archivedAt ? 'Unarchive tracker' : 'Archive tracker'}
                  </Text>
                </PressableScale>
                <PressableScale
                  onPress={() =>
                    Alert.alert('Delete this tracker?', 'Every log on it is deleted too. Archive it instead to keep the history.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () =>
                          void writes
                            .remove(editing.id)
                            .then(() => router.replace('/trackers'))
                            .catch((e: Error) => Alert.alert("Couldn't delete the tracker", e.message)),
                      },
                    ])
                  }
                  style={styles.actionBtn}>
                  <Icon icon={faTrash} size={12} color={Tone.red500} />
                  <Text size="sm" weight="medium" color={Tone.red500}>
                    Delete tracker
                  </Text>
                </PressableScale>
              </Animated.View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </PageEnter>

      <AssigneeSheet
        visible={sheet?.kind === 'assignee'}
        assigneeIds={assigneeId ? [assigneeId] : []}
        members={members}
        onToggle={(uid) => {
          setSheet(null);
          // Tapping the current person unassigns, as on the task screen.
          setAssigneeId((cur) => (cur === uid ? '' : uid));
        }}
        onClose={() => setSheet(null)}
      />
      <MenuSheet<'day' | 'week'>
        visible={sheet?.kind === 'split'}
        title="Split the target"
        value={split}
        options={[
          { value: 'day', label: 'Per working day' },
          { value: 'week', label: 'Per week' },
        ]}
        onSelect={(v) => {
          setSheet(null);
          setSplit(v);
        }}
        onClose={() => setSheet(null)}
      />
      <MenuSheet<'daily' | 'weekly'>
        visible={sheet?.kind === 'logs'}
        title="Logs progress"
        value={checkIn}
        options={[
          { value: 'daily', label: 'Every day' },
          { value: 'weekly', label: 'Once a week' },
        ]}
        onSelect={(v) => {
          setSheet(null);
          setCheckIn(v);
        }}
        onClose={() => setSheet(null)}
      />
      <MenuSheet<TrackerMetricUnit>
        visible={sheet?.kind === 'unit'}
        title="Measured as"
        value={sheet?.kind === 'unit' ? metricFor(sheet.id)?.unit : undefined}
        options={(Object.keys(UNIT_LABEL) as TrackerMetricUnit[]).map((u) => ({ value: u, label: UNIT_LABEL[u] }))}
        onSelect={(u) => {
          if (sheet?.kind === 'unit') patch(sheet.id, { unit: u });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <MenuSheet<'at_least' | 'at_most'>
        visible={sheet?.kind === 'direction'}
        title="Target"
        value={sheet?.kind === 'direction' ? metricFor(sheet.id)?.direction : undefined}
        options={[
          { value: 'at_least', label: 'At least (more is better)' },
          { value: 'at_most', label: 'At most (less is better)' },
        ]}
        onSelect={(d) => {
          if (sheet?.kind === 'direction') patch(sheet.id, { direction: d });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <MenuSheet<TrackerFormula['op']>
        visible={sheet?.kind === 'op'}
        title="Operation"
        value={sheet?.kind === 'op' ? metricFor(sheet.id)?.formula?.op : undefined}
        options={(Object.keys(OP_NAME) as TrackerFormula['op'][]).map((o) => ({ value: o, label: `${OP_LABEL[o]}  ${OP_NAME[o]}` }))}
        onSelect={(op) => {
          if (sheet?.kind === 'op') {
            const f = metricFor(sheet.id)?.formula;
            if (f) patch(sheet.id, { formula: { ...f, op } });
          }
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <MenuSheet<string>
        visible={sheet?.kind === 'operand'}
        title="Metric"
        value={sheet?.kind === 'operand' ? metricFor(sheet.id)?.formula?.[sheet.side] : undefined}
        options={inputs.map((m) => ({ value: m.id, label: m.name.trim() || 'Untitled' }))}
        onSelect={(mid) => {
          if (sheet?.kind === 'operand') {
            const f = metricFor(sheet.id)?.formula;
            if (f) patch(sheet.id, { formula: { ...f, [sheet.side]: mid } });
          }
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </>
  );
}

/* ───────────── rows, matching the task screen's property rows ───────────── */

function Row({ icon, label, onPress, children }: { icon: IconDefinition; label: string; onPress?: () => void; children: ReactNode }) {
  const theme = useTheme();
  return (
    <PressableScale
      disabled={!onPress}
      onPress={onPress}
      scaleTo={0.99}
      haptic={onPress ? 'select' : false}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceHover }]}>
      <Icon icon={icon} size={13} color="muted" style={{ width: 16 }} />
      <Text size="sm" color="muted" style={styles.label}>
        {label}
      </Text>
      <View style={styles.value}>{children}</View>
      {onPress ? <Icon icon={faChevronRight} size={10} color="muted" style={{ opacity: 0.6 }} /> : null}
    </PressableScale>
  );
}

function DateRow({ label, value, onPress, onIos }: { label: string; value: string; onPress: () => void; onIos: (key: string) => void }) {
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.row}>
        <Icon icon={faCalendarDays} size={13} color="muted" style={{ width: 16 }} />
        <Text size="sm" color="muted" style={styles.label}>
          {label}
        </Text>
        <View style={styles.value}>
          <DateTimePicker value={dateOf(value)} mode="date" display="compact" onChange={(_e, d) => d && onIos(keyOf(d))} />
        </View>
      </View>
    );
  }
  return (
    <Row icon={faCalendarDays} label={label} onPress={onPress}>
      <Text size="sm" weight="medium" tabular>
        {shortDate(value)}
      </Text>
    </Row>
  );
}

function MiniPick({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale haptic="select" onPress={onPress} style={[styles.mini, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }]}>
      <Text size="xs" weight="semibold" numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const Divider = ({ color }: { color: string }) => <View style={[styles.divider, { backgroundColor: color }]} />;

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 16 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 8 },
  doneBtn: { paddingHorizontal: 14, height: 32, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { gap: 6, paddingHorizontal: 2 },
  titleInput: { fontFamily: Fonts.outfit.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4, padding: 0 },
  templates: { gap: 8 },
  templateChip: { borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 7 },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  group: { borderRadius: Radius.xxl, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14 },
  label: { width: 96 },
  labelBtn: { width: 96, paddingVertical: 8 },
  value: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginLeft: 40 },
  metricName: { flex: 1, fontSize: 15, fontFamily: Fonts.sans.semibold, padding: 0 },
  numInput: { minWidth: 110, textAlign: 'right', fontSize: 15, fontFamily: Fonts.sans.semibold, padding: 0 },
  share: { paddingHorizontal: 40, paddingBottom: 10, marginTop: -6 },
  formula: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  mini: { borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: 9, paddingVertical: 4, maxWidth: 110 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', gap: 8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 8 },
  presets: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  presetChip: { borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: 10, paddingVertical: 5 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  day: { width: 36, height: 36, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
