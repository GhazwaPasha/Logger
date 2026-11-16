import {
  faBullseye,
  faCalculator,
  faCalendarDays,
  faChevronDown,
  faChevronRight,
  faCircleCheck,
  faHashtag,
  faNoteSticky,
  faPen,
  faPlus,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { applyTrackerFormula, type TrackerMetric, type TrackerSummary } from '@work-ledger/contracts';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, ZoomIn } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Page } from '@/components/page';
import { TabHeader } from '@/components/shell/screen-header';
import { Text } from '@/components/text';
import { Button, CenteredSpinner, EmptyState, ErrorBanner } from '@/components/ui';
import { Duration, POP_EASE, sequenceEnter } from '@/constants/motion';
import { alpha, Fonts, Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { useLogProgress, useMyTrackers } from '@/lib/trackers';
import { useWorkspace } from '@/lib/workspace';

/** Settles without bounce, matching the rest of the app's list reflow. */
const layout = LinearTransition.duration(Duration.base).easing(POP_EASE);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function dayLabel(key: string, today?: string) {
  if (key === today) return 'Today';
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}
function compact(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (a >= 100_000) return `${Math.round(v / 1000)}k`;
  if (a >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
const fmt = (m: Pick<TrackerMetric, 'unit'>, v: number | null | undefined) => (m.unit === 'percent' ? `${compact(v)}%` : compact(v));

/** Trackers: every tracker assigned to you, today's logs first. Same grouped-card language as the task screen. */
export default function TrackersRoute() {
  const theme = useTheme();
  const { org } = useWorkspace();
  const q = useMyTrackers(org?.id);
  const canManage = q.data?.canManage ?? false;
  return (
    <Page
      header={
        <TabHeader title="Trackers">
          {canManage ? (
            <PressableScale
              haptic="tap"
              onPress={() => router.push('/tracker-edit')}
              accessibilityLabel="New tracker"
              style={[styles.newBtn, { backgroundColor: theme.accent }]}>
              <Icon icon={faPlus} size={11} color={theme.onAccent} />
              <Text size="13" weight="semibold" color={theme.onAccent}>
                New
              </Text>
            </PressableScale>
          ) : null}
        </TabHeader>
      }
      gap={16}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}>
      <TrackersScreen />
    </Page>
  );
}

function TrackersScreen() {
  const { org, userId } = useWorkspace();
  const q = useMyTrackers(org?.id);
  const canManage = q.data?.canManage ?? false;
  // `undefined` = untouched: the first due log starts open, so the common case is one tap away.
  const [picked, setOpen] = useState<string | null | undefined>(undefined);

  const { due, done, other, team } = useMemo(() => {
    const all = q.data?.trackers ?? [];
    // Yours first (what you log), then — for owners and managers — everyone else's.
    const mine = all.filter((t) => t.assigneeId === userId);
    return {
      due: mine.filter((t) => t.stats.dueKey && !t.stats.dueLogged),
      done: mine.filter((t) => t.stats.dueKey && t.stats.dueLogged),
      other: mine.filter((t) => !t.stats.dueKey),
      team: all.filter((t) => t.assigneeId !== userId),
    };
  }, [q.data, userId]);
  const open = picked !== undefined ? picked : due[0] ? `${due[0].id}:${due[0].stats.dueKey}` : null;

  if (q.isLoading) return <CenteredSpinner />;
  const today = q.data?.today;
  const count = due.length;
  let enter = 2;

  return (
    <>
      {q.error ? <ErrorBanner message={q.error.message} onRetry={() => void q.refetch()} /> : null}

      <Animated.View entering={sequenceEnter(1, 8)} style={styles.titleWrap}>
        <Text font="outfit" size="2xl" weight="bold" tracking={-0.4} lh={30}>
          Today
        </Text>
        <Text size="xs" color="muted">
          {today ? `${dayLabel(today)} · ` : ''}
          {count ? `${count} to log` : 'All logged'}
        </Text>
      </Animated.View>

      {(q.data?.trackers.length ?? 0) === 0 ? (
        <View style={{ marginTop: 24 }}>
          <EmptyState
            icon={faBullseye}
            title="No trackers yet"
            description={
              canManage
                ? 'Give someone a number to hit — orders and revenue for the quarter, leads for the month.'
                : 'When someone gives you a target to track, it shows up here.'
            }
            action={canManage ? <Button title="Create a tracker" onPress={() => router.push('/tracker-edit')} haptic="tap" /> : undefined}
          />
        </View>
      ) : null}

      {[
        { label: 'To log today', rows: due },
        { label: 'Logged', rows: done },
        { label: 'Not due today', rows: other },
        { label: 'Team', rows: team },
      ]
        .filter((g) => g.rows.length)
        .map((g) => (
          <Animated.View key={g.label} entering={sequenceEnter(enter++, 8)} layout={layout} style={styles.section}>
            <Text size="11" weight="semibold" color="muted" uppercase tracking={0.6} style={{ paddingHorizontal: 4 }}>
              {g.label}
            </Text>
            {g.rows.map((t) => (
              <TrackerCard key={t.id} t={t} today={today} openKey={open} onToggle={setOpen} canManage={canManage} />
            ))}
          </Animated.View>
        ))}
    </>
  );
}

function paceLine(t: TrackerSummary) {
  const i = t.metrics.findIndex((m) => m.kind === 'input' && m.target != null);
  if (i < 0) return { text: t.checkIn === 'weekly' ? 'Logged weekly' : 'Logged daily', tone: 'muted' as const };
  const m = t.metrics[i]!;
  const s = t.stats.metrics[i]!;
  const unit = t.split === 'week' ? 'week' : 'day';
  switch (s.pace) {
    case 'behind':
      return {
        text: `Behind · ${fmt(m, Math.abs(s.delta ?? 0))} ${m.name.toLowerCase()}${s.neededPerUnit != null ? ` · need ${fmt(m, s.neededPerUnit)} a ${unit}` : ''}`,
        tone: 'bad' as const,
      };
    case 'ahead':
      return { text: `Ahead by ${fmt(m, s.delta ?? 0)} ${m.name.toLowerCase()}`, tone: 'good' as const };
    case 'on_pace':
      return { text: 'On pace', tone: 'good' as const };
    case 'met':
      return { text: 'Target met', tone: 'good' as const };
    case 'missed':
      return { text: 'Target missed', tone: 'bad' as const };
    default:
      return { text: t.checkIn === 'weekly' ? 'Logged weekly' : 'Logged daily', tone: 'muted' as const };
  }
}

/** One tracker = one grouped card: a header row, then its log rows when open. */
function TrackerCard({
  t,
  today,
  openKey,
  onToggle,
  canManage,
}: {
  t: TrackerSummary;
  today?: string;
  openKey: string | null;
  onToggle: (k: string | null) => void;
  canManage: boolean;
}) {
  const theme = useTheme();
  const dark = useIsDark();
  const divider = alpha(theme.fg, dark ? 0.08 : 0.07);
  const missed = t.stats.slots.filter((s) => s.state === 'missed').map((s) => s.key);
  // An unassigned tracker takes no logs yet, so it never opens a log form.
  const dates = !t.assigneeId ? [] : [...(t.stats.dueKey ? [t.stats.dueKey] : []), ...missed.slice(-4).reverse()];
  const openDate = openKey?.startsWith(`${t.id}:`) ? openKey.slice(t.id.length + 1) : null;
  const pace = paceLine(t);
  const { members } = useWorkspace();
  const who = members.find((m) => m.userId === t.assigneeId);
  const assigneeLabel = !t.assigneeId ? 'Unassigned' : who ? (who.name ?? '').trim() || who.email : 'Someone';
  const toneColor = pace.tone === 'bad' ? Tone.red500 : pace.tone === 'good' ? Tone.emerald500 : theme.muted;

  return (
    <Animated.View layout={layout} style={[styles.group, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
      <PressableScale
        scaleTo={0.99}
        haptic="select"
        disabled={dates.length === 0}
        onPress={() => onToggle(openDate ? null : `${t.id}:${dates[0]}`)}
        accessibilityRole="button"
        accessibilityLabel={t.name}
        style={({ pressed }) => [styles.headRow, pressed && { backgroundColor: theme.surfaceHover }]}>
        <Icon icon={faBullseye} size={13} color="muted" style={{ width: 16 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="15" weight="semibold" numberOfLines={1}>
            {t.name}
          </Text>
          {canManage ? (
            <Text size="11" color="muted" numberOfLines={1}>
              {assigneeLabel}
            </Text>
          ) : null}
          <Text size="xs" color={toneColor} numberOfLines={1}>
            {pace.text}
          </Text>
        </View>
        {t.stats.dueLogged && !openDate ? (
          <Animated.View entering={ZoomIn.springify().damping(14)}>
            <Icon icon={faCircleCheck} size={20} color={Tone.emerald500} />
          </Animated.View>
        ) : missed.length > 0 && !openDate ? (
          <Text size="xs" weight="semibold" color={Tone.amber500}>
            {`${missed.length} missed`}
          </Text>
        ) : null}
        {canManage ? (
          <PressableScale
            scaleTo={0.9}
            haptic="select"
            onPress={() => router.push({ pathname: '/tracker-edit', params: { id: t.id } })}
            accessibilityLabel={`Edit ${t.name}`}
            style={[styles.editBtn, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }]}>
            <Icon icon={faPen} size={10} color="muted" />
          </PressableScale>
        ) : null}
        {dates.length > 0 ? (
          <Icon icon={openDate ? faChevronDown : faChevronRight} size={10} color="muted" style={{ opacity: 0.6 }} />
        ) : null}
      </PressableScale>

      {openDate ? (
        <Animated.View entering={FadeIn.duration(Duration.base)} exiting={FadeOut.duration(Duration.micro)}>
          {dates.length > 1 ? (
            <>
              <Divider color={divider} />
              <PropRow icon={faCalendarDays} label="Day">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dates}>
                  {dates.map((d) => {
                    const on = d === openDate;
                    return (
                      <PressableScale
                        key={d}
                        haptic="select"
                        onPress={() => onToggle(`${t.id}:${d}`)}
                        style={[
                          styles.dateChip,
                          on
                            ? { backgroundColor: theme.accent, borderColor: theme.accent }
                            : { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle },
                        ]}>
                        <Text size="xs" weight="semibold" color={on ? theme.onAccent : d === t.stats.dueKey ? 'fg' : Tone.amber500}>
                          {dayLabel(d, today)}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </ScrollView>
              </PropRow>
            </>
          ) : null}
          <LogRows key={openDate} t={t} date={openDate} divider={divider} onDone={() => onToggle(null)} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function PropRow({ icon, label, children }: { icon: IconDefinition; label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Icon icon={icon} size={13} color="muted" style={{ width: 16 }} />
      <Text size="sm" color="muted" style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.value}>{children}</View>
    </View>
  );
}

const Divider = ({ color }: { color: string }) => <View style={[styles.divider, { backgroundColor: color }]} />;

function LogRows({
  t,
  date,
  divider,
  onDone,
}: {
  t: TrackerSummary;
  date: string;
  divider: string;
  onDone: () => void;
}) {
  const theme = useTheme();
  const { org } = useWorkspace();
  const log = useLogProgress(org?.id);
  const prefill = t.dueEntry && t.dueEntry.entryDate === date ? t.dueEntry : null;
  const inputs = t.metrics.filter((m) => m.kind === 'input');
  const formulas = t.metrics.filter((m) => m.kind === 'formula');
  const [raw, setRaw] = useState<Record<string, string>>(() =>
    Object.fromEntries(inputs.map((m) => [m.id, prefill?.values[m.id] != null ? String(prefill.values[m.id]) : ''])),
  );
  const [note, setNote] = useState(prefill?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const values = Object.fromEntries(
    Object.entries(raw)
      .map(([id, v]) => [id, v.trim() === '' ? NaN : Number(v.replace(/,/g, ''))] as const)
      .filter(([, v]) => Number.isFinite(v)),
  ) as Record<string, number>;

  const share = (m: TrackerMetric) => {
    const i = t.metrics.findIndex((x) => x.id === m.id);
    const s = t.stats.metrics[i];
    return s?.slice != null ? fmt(m, s.slice) : null;
  };

  function save() {
    if (Object.keys(values).length === 0) {
      setError('Enter at least one number');
      return;
    }
    setError(null);
    // Applied optimistically: close and confirm now; a rejected save rolls back and says why.
    haptics.success();
    onDone();
    log.mutate(
      { trackerId: t.id, date, input: { values, note: note.trim() || null } },
      { onError: (e) => Alert.alert("Couldn't save the log", e.message) },
    );
  }

  return (
    <View>
      {inputs.map((m) => {
        const s = share(m);
        return (
          <View key={m.id}>
            <Divider color={divider} />
            <PropRow icon={faHashtag} label={m.name}>
              {s ? (
                <Text size="11" color="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {`share ${s}`}
                </Text>
              ) : null}
                <TextInput
                  value={raw[m.id]}
                  onChangeText={(v) => {
                    setRaw((r) => ({ ...r, [m.id]: v }));
                    setError(null);
                  }}
                  // Whole numbers for counts, decimals for money and the rest.
                  keyboardType={m.unit === 'count' ? 'number-pad' : 'decimal-pad'}
                  returnKeyType="done"
                  selectTextOnFocus
                  placeholder="0"
                  placeholderTextColor={alpha(theme.muted, 0.7)}
                  style={[styles.numInput, { color: theme.fg }]}
                  accessibilityLabel={m.name}
                />
            </PropRow>
          </View>
        );
      })}
      {formulas.map((m) => {
        const v =
          m.formula && values[m.formula.a] != null && values[m.formula.b] != null
            ? applyTrackerFormula(m.formula, values[m.formula.a]!, values[m.formula.b]!)
            : null;
        return (
          <View key={m.id}>
            <Divider color={divider} />
            <PropRow icon={faCalculator} label={m.name}>
              <Text size="sm" weight="semibold" color="muted" tabular>
                {fmt(m, v)}
              </Text>
            </PropRow>
          </View>
        );
      })}
      <Divider color={divider} />
      <PropRow icon={faNoteSticky} label="Note">
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Optional"
          placeholderTextColor={alpha(theme.muted, 0.7)}
          maxLength={1000}
          style={[styles.noteInput, { color: theme.fg }]}
        />
      </PropRow>
      <View style={styles.saveWrap}>
        {error ? (
          <Text size="13" color={Tone.red500}>
            {error}
          </Text>
        ) : null}
        <Button title={prefill ? 'Update log' : 'Save log'} onPress={save} haptic="tap" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120, gap: 16 },
  titleWrap: { gap: 4, paddingHorizontal: 2 },
  section: { gap: 8 },
  group: { borderRadius: Radius.xxl, borderWidth: 1, overflow: 'hidden' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 58, paddingHorizontal: 14, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14 },
  label: { width: 96 },
  value: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginLeft: 40 },
  dates: { gap: 6, justifyContent: 'flex-end', flexGrow: 1 },
  dateChip: { borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: 10, paddingVertical: 5 },
  numInput: { minWidth: 96, textAlign: 'right', fontSize: 15, fontFamily: Fonts.sans.semibold, padding: 0 },
  noteInput: { flex: 1, textAlign: 'right', fontSize: 14, fontFamily: Fonts.sans.regular, padding: 0 },
  saveWrap: { gap: 8, padding: 14, paddingTop: 6 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 30, borderRadius: Radius.lg, marginLeft: 10 },
  editBtn: { width: 28, height: 28, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
