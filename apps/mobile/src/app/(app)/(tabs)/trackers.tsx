import { CalculatorIcon, CalendarDaysIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, CircleCheckIcon, HashIcon, PencilIcon, PlusIcon, StickyNoteIcon, TargetIcon } from 'lucide-react-native';
import { applyTrackerFormula, type TrackerEntry, type TrackerMetric, type TrackerPace, type TrackerSummary } from '@work-ledger/contracts';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, ZoomIn } from 'react-native-reanimated';

import { Icon, type IconType } from '@/components/icon';
import { MenuSheet } from '@/components/menu-sheet';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Page } from '@/components/page';
import { TabHeader } from '@/components/shell/screen-header';
import { Text } from '@/components/text';
import { Avatar, Button, CenteredSpinner, EmptyState, ErrorBanner } from '@/components/ui';
import { Duration, POP_EASE, sequenceEnter } from '@/constants/motion';
import { alpha, elevation, Fonts, Radius } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { useLogProgress, useMyTrackers, useTrackerDetail } from '@/lib/trackers';
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
const fmt = (m: Pick<TrackerMetric, 'unit'>, v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '–' : m.unit === 'percent' ? `${compact(v)}%` : compact(v);

/** Trackers: every tracker assigned to you, today's logs first. Same grouped-card language as the task screen. */
export default function TrackersRoute() {
  const { org } = useWorkspace();
  const q = useMyTrackers(org?.id);
  return (
    <Page
      header={<TabHeader title="Trackers" />}
      gap={16}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}>
      <TrackersScreen />
    </Page>
  );
}

function TrackersScreen() {
  const theme = useTheme();
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
  let enter = 2;

  return (
    <>
      {q.error ? <ErrorBanner message={q.error.message} onRetry={() => void q.refetch()} /> : null}

      {(q.data?.trackers.length ?? 0) === 0 ? (
        <View style={{ marginTop: 24 }}>
          <EmptyState
            icon={TargetIcon}
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
        { label: 'To log', rows: due, date: today ? dayLabel(today) : null },
        { label: 'Logged', rows: done, date: null },
        { label: 'Not due today', rows: other, date: null },
        { label: 'Team', rows: team, date: null },
      ]
        .filter((g) => g.rows.length)
        .map((g, gi) => (
          <Animated.View key={g.label} entering={sequenceEnter(enter++, 8)} layout={layout} style={styles.section}>
            {/* Section heading (web card-heading style): name, count chip, and today's date on the due section. */}
            <View style={styles.sectionHead}>
              {gi === 0 && canManage ? (
                // Web NewButton: a 40px primary square with a plus, leftmost on the page.
                <PressableScale
                  haptic="tap"
                  scaleTo={0.94}
                  onPress={() => router.push('/tracker-edit')}
                  accessibilityRole="button"
                  accessibilityLabel="New tracker"
                  style={[styles.newBtn, { backgroundColor: theme.primary, ...elevation(theme, 'card') }]}>
                  <Icon icon={PlusIcon} size={20} color={theme.onPrimary} />
                </PressableScale>
              ) : null}
              <Text font="outfit" size="base" weight="semibold" numberOfLines={1}>
                {g.label}
              </Text>
              <View style={[styles.countChip, { backgroundColor: theme.fill2 }]}>
                <Text size="xs" weight="semibold" color="muted" tabular>
                  {g.rows.length}
                </Text>
              </View>
              {g.date ? (
                <Text size="13" color="muted" style={{ marginLeft: 'auto' }}>
                  {g.date}
                </Text>
              ) : null}
            </View>
            {g.rows.map((t) => (
              <TrackerCard key={t.id} t={t} today={today} openKey={open} onToggle={setOpen} canManage={canManage} />
            ))}
          </Animated.View>
        ))}
    </>
  );
}

const PACE_LABEL: Record<TrackerPace, string> = {
  ahead: 'Ahead',
  on_pace: 'On pace',
  behind: 'Behind',
  met: 'Target met',
  missed: 'Missed',
  none: 'No target',
};

/** Colour only ever carries status (web `PACE_TEXT`). */
function paceInk(p: TrackerPace) {
  return p === 'ahead' || p === 'on_pace' || p === 'met' ? 'success' : p === 'behind' || p === 'missed' ? 'danger' : 'muted';
}

function shortDate(key: string) {
  const [, m, d] = key.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}`;
}
const periodLabel = (start: string, end: string) => `${shortDate(start)} – ${shortDate(end)}`;

/** "Day 12 of 30 · 18 days left" (the web's period line). */
function phaseLine(t: TrackerSummary) {
  const { stats } = t;
  const unit = t.split === 'week' ? 'week' : 'day';
  if (stats.phase === 'upcoming') return 'Not started';
  if (stats.phase === 'ended') return 'Ended';
  const left = Math.max(0, stats.totalUnits - stats.elapsedUnits);
  const current = Math.min(stats.totalUnits, stats.elapsedUnits + 1);
  return `${unit === 'week' ? 'Week' : 'Day'} ${current} of ${stats.totalUnits} · ${left} ${unit}${left === 1 ? '' : 's'} left`;
}

/** A metric tile's status line: a few words that fit one line (web `metricNote`, short form). */
function metricNote(t: TrackerSummary, m: TrackerMetric, i: number): string {
  const s = t.stats.metrics[i]!;
  if (m.kind === 'formula' && m.formula) {
    const a = t.metrics.find((x) => x.id === m.formula!.a)?.name ?? '?';
    const b = t.metrics.find((x) => x.id === m.formula!.b)?.name ?? '?';
    const sym = { div: '÷', mul: '×', add: '+', sub: '−' }[m.formula.op];
    return `${a} ${sym} ${b}${m.formula.percent ? ' × 100' : ''}`;
  }
  if (s.target == null) return 'No target';
  if (s.pace === 'met') return 'Target met';
  if (s.pace === 'missed') return m.direction === 'at_most' ? 'Over limit' : 'Missed';
  const d = Math.abs(s.delta ?? 0);
  const perUnit = (v: number) => fmt(m, v >= 10 ? Math.ceil(v) : Math.round(v * 10) / 10);
  if (s.pace === 'behind') {
    return s.neededPerUnit != null
      ? `${fmt(m, d)} behind · ${perUnit(s.neededPerUnit)}/${t.split === 'week' ? 'wk' : 'day'}`
      : `${fmt(m, d)} behind`;
  }
  if (s.pace === 'ahead') return `${fmt(m, d)} ahead`;
  return 'On pace';
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
  // Every day (or week) of the period up to today, newest first — any of them can be logged or corrected.
  const pastSlots = useMemo(() => t.stats.slots.filter((s) => s.state !== 'upcoming').reverse(), [t.stats.slots]);
  // An unassigned tracker takes no logs yet, so it never opens a log form.
  const firstDate = !t.assigneeId ? null : (t.stats.dueKey ?? missed[missed.length - 1] ?? pastSlots[0]?.key ?? null);
  const openDate = openKey?.startsWith(`${t.id}:`) ? openKey.slice(t.id.length + 1) : null;
  const [dayPicker, setDayPicker] = useState(false);
  const { org } = useWorkspace();
  // The list only carries today's log; past days need the full history to prefill a correction.
  const history = useTrackerDetail(openDate ? org?.id : undefined, openDate ? t.id : undefined);
  const { members } = useWorkspace();
  const who = members.find((m) => m.userId === t.assigneeId);
  const assigneeLabel = !t.assigneeId ? 'Unassigned' : who ? (who.name ?? '').trim() || who.email : 'Someone';
  // Progress bar + % follow the first input metric with a target (the web's list row).
  const leadIndex = t.metrics.findIndex((m) => m.kind === 'input' && m.target != null);
  const lead = leadIndex >= 0 ? t.stats.metrics[leadIndex] : null;
  const leadPct = lead?.target ? Math.min(1, Math.max(0, (lead.value ?? 0) / lead.target)) : 0;
  // Missed check-ins lead the pill unless the tracker is behind (then "Behind" says more).
  const missedFirst = t.stats.missedCount > 0 && t.stats.pace !== 'behind';
  const pill = missedFirst
    ? { bg: theme.warningBg, fg: theme.warningInk }
    : t.stats.pace === 'behind'
      ? { bg: alpha(theme.danger, 0.13), fg: theme.danger }
      : t.stats.pace === 'none'
        ? { bg: theme.fill2, fg: theme.muted }
        : { bg: theme.statusDoneBg, fg: theme.statusDoneInk };
  const tileTints = [theme.dept1Tint, theme.dept3Tint, theme.dept4Tint, theme.dept2Tint];
  // The most recent stretch up to today, so a long period doesn't turn into a wall of squares.
  const checkins = t.stats.slots.filter((sl) => sl.state !== 'upcoming').slice(-28);
  const dueNow = !!t.stats.dueKey && !t.stats.dueLogged && !!t.assigneeId;

  return (
    <Animated.View layout={layout} style={[styles.group, { backgroundColor: theme.card, borderColor: 'transparent', ...elevation(theme, 'card') }]}>
      <PressableScale
        scaleTo={0.99}
        haptic="select"
        disabled={!firstDate}
        onPress={() => onToggle(openDate ? null : `${t.id}:${firstDate}`)}
        accessibilityRole="button"
        accessibilityLabel={t.name}
        style={({ pressed }) => [styles.headRow, pressed && { backgroundColor: theme.fill }]}>
        {t.assigneeId ? (
          <Avatar name={who?.name} email={who?.email} image={who?.image} size={36} tint={theme.fill2} />
        ) : (
          // Nobody yet: an empty ring, like the web.
          <View style={[styles.emptyAvatar, { borderColor: theme.lineStrong }]} />
        )}
        <View style={styles.headText}>
          <View style={styles.nameRow}>
            <Text size="15" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
              {t.name}
            </Text>
            {t.stats.dueLogged && !openDate ? (
              <Animated.View entering={ZoomIn.springify().damping(14)}>
                <Icon icon={CircleCheckIcon} size={16} color={theme.success} />
              </Animated.View>
            ) : null}
            {lead?.target != null ? (
              <Text size="xs" weight="semibold" tabular>
                {`${Math.round(leadPct * 100)}%`}
              </Text>
            ) : null}
          </View>
          <View style={[styles.bar, { backgroundColor: theme.fill2 }]}>
            <View style={[styles.barFill, { backgroundColor: theme.dept1, width: `${leadPct * 100}%` }]} />
          </View>
          <View style={styles.metaRow}>
            <Text size="xs" color="muted" numberOfLines={1} style={{ flex: 1 }}>
              {`${assigneeLabel} · ${t.checkIn}`}
            </Text>
            <View style={[styles.pacePill, { backgroundColor: pill.bg }]}>
              <Text size="11" weight="semibold" color={pill.fg}>
                {missedFirst ? `${t.stats.missedCount} missed` : PACE_LABEL[t.stats.pace]}
              </Text>
            </View>
          </View>
        </View>
        {firstDate ? <Icon icon={openDate ? ChevronDownIcon : ChevronRightIcon} size={18} color="muted" /> : null}
      </PressableScale>

      {/* Log progress (the web's right-hand panel), right under the header so it's never scrolled past. */}
      {openDate ? (
        <Animated.View entering={FadeIn.duration(Duration.base)} exiting={FadeOut.duration(Duration.micro)}>
          <View style={styles.logHead}>
            <Text font="outfit" size="base" weight="semibold">
              Log progress
            </Text>
            {dueNow ? (
              <View style={[styles.pacePill, { backgroundColor: theme.warningBg }]}>
                <Text size="11" weight="semibold" color={theme.warningInk}>
                  Due
                </Text>
              </View>
            ) : null}
          </View>
          <Divider color={divider} />
          <PressableScale
            scaleTo={0.99}
            haptic="select"
            onPress={() => setDayPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t.checkIn === 'weekly' ? 'Week' : 'Day'}: ${dayLabel(openDate, today)}`}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.fill }]}>
            <Icon icon={CalendarDaysIcon} size={14} color="muted" style={{ width: 16 }} />
            <Text size="sm" color="muted" style={styles.label}>
              {t.checkIn === 'weekly' ? 'Week of' : 'Day'}
            </Text>
            <View style={styles.value}>
              <Text size="sm" weight="semibold" numberOfLines={1}>
                {dayLabel(openDate, today)}
              </Text>
              <Text size="11" color={slotTone(t, openDate)}>
                {slotStateLabel(t, openDate)}
              </Text>
            </View>
            <Icon icon={ChevronRightIcon} size={16} color="muted" />
          </PressableScale>
          <LogRows
            // Remount once history arrives, so a past day's saved numbers fill the fields.
            key={`${openDate}:${history.data ? 'h' : '-'}`}
            t={t}
            date={openDate}
            saved={history.data?.entries.find((e) => e.entryDate === openDate) ?? null}
            divider={divider}
            onDone={() => onToggle(null)}
          />
          <Divider color={divider} />
        </Animated.View>
      ) : null}

      {/* The tracker's numbers (web TrackerDetail): metric tiles, the period, recent check-ins. */}
      <View style={styles.body}>
        <View style={styles.tiles}>
          {t.metrics.map((m, i) => {
            const st = t.stats.metrics[i];
            if (!st) return null;
            return (
              <View
                key={m.id}
                style={[styles.tile, { backgroundColor: m.kind === 'formula' ? theme.fill : tileTints[i % tileTints.length] }]}>
                <View style={styles.tileHead}>
                  <Text size="13" weight="semibold" color="muted" numberOfLines={1} style={{ flex: 1 }}>
                    {m.name}
                  </Text>
                  {m.kind === 'formula' ? <Icon icon={CalculatorIcon} size={13} color="muted" /> : null}
                </View>
                <View style={styles.tileValue}>
                  <Text font="outfit" weight="semibold" tabular tracking={-0.8} style={styles.tileFigure}>
                    {fmt(m, st.value)}
                  </Text>
                  {st.target != null ? (
                    <Text size="13" color="muted" tabular numberOfLines={1} style={{ flexShrink: 1 }}>
                      {`/ ${m.direction === 'at_most' ? '≤ ' : m.kind === 'formula' ? '≥ ' : ''}${fmt(m, st.target)}`}
                    </Text>
                  ) : null}
                </View>
                <Text
                  size="xs"
                  numberOfLines={1}
                  color={m.kind === 'formula' && st.pace === 'none' ? 'muted' : paceInk(st.pace)}
                  style={{ marginTop: 4 }}>
                  {metricNote(t, m, i)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.period}>
          <Text size="13" weight="semibold" color="muted">
            Period
          </Text>
          <Text size="13" weight="semibold">
            {periodLabel(t.periodStart, t.periodEnd)}
          </Text>
          <View style={[styles.periodBar, { backgroundColor: theme.fill2 }]}>
            <View style={[styles.barFill, { backgroundColor: theme.ink2, width: `${Math.min(100, t.stats.progress * 100)}%` }]} />
          </View>
        </View>
        <Text size="xs" color="muted">
          {phaseLine(t)}
        </Text>

        {checkins.length > 0 ? (
          <View style={{ gap: 8 }}>
            <View style={styles.checkHead}>
              <Text font="outfit" size="sm" weight="semibold">
                Check-ins
              </Text>
              <Text size="xs" color="muted">
                {t.stats.missedCount ? `${t.stats.missedCount} missed` : 'No misses'}
              </Text>
            </View>
            <View style={styles.strip} accessibilityLabel="Check-ins">
              {checkins.map((sl) => (
                <View
                  key={sl.key}
                  style={[
                    styles.square,
                    {
                      backgroundColor:
                        sl.state === 'logged' ? theme.statusDone : sl.state === 'missed' ? theme.danger : theme.warning,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        ) : null}

        {firstDate || canManage ? (
          <View style={styles.actions}>
            {firstDate ? (
              // The way in to logging (or correcting) a day: primary while today's log is still due.
              <PressableScale
                scaleTo={0.97}
                haptic="select"
                onPress={() => onToggle(openDate ? null : `${t.id}:${firstDate}`)}
                accessibilityRole="button"
                accessibilityLabel={openDate ? 'Close log' : 'Log progress'}
                style={[styles.editBtn, { backgroundColor: dueNow && !openDate ? theme.primary : theme.fill2 }]}>
                <Icon icon={openDate ? ChevronUpIcon : PlusIcon} size={14} color={dueNow && !openDate ? theme.onPrimary : theme.fg} />
                <Text size="13" weight="semibold" color={dueNow && !openDate ? theme.onPrimary : 'fg'}>
                  {openDate ? 'Close' : t.stats.dueLogged ? 'Update log' : 'Log progress'}
                </Text>
              </PressableScale>
            ) : null}
            {canManage ? (
              <PressableScale
                scaleTo={0.97}
                haptic="select"
                onPress={() => router.push({ pathname: '/tracker-edit', params: { id: t.id } })}
                accessibilityLabel={`Edit ${t.name}`}
                style={[styles.editBtn, { backgroundColor: theme.fill2 }]}>
                <Icon icon={PencilIcon} size={13} color="fg" />
                <Text size="13" weight="semibold">
                  Edit
                </Text>
              </PressableScale>
            ) : null}
          </View>
        ) : null}
      </View>

      <MenuSheet<string>
        visible={dayPicker}
        title={t.checkIn === 'weekly' ? 'Week to log' : 'Day to log'}
        value={openDate ?? undefined}
        options={pastSlots.map((sl) => ({
          value: sl.key,
          label: `${dayLabel(sl.key, today)}${sl.state === 'logged' ? ' · logged' : sl.state === 'missed' ? ' · missed' : sl.state === 'due' ? ' · to log' : ''}`,
          icon: sl.state === 'logged' ? CircleCheckIcon : CalendarDaysIcon,
          iconColor: sl.state === 'logged' ? theme.success : sl.state === 'missed' ? theme.warning : undefined,
        }))}
        onSelect={(key) => {
          setDayPicker(false);
          onToggle(`${t.id}:${key}`);
        }}
        onClose={() => setDayPicker(false)}
      />
    </Animated.View>
  );
}

function slotStateLabel(t: TrackerSummary, key: string) {
  const st = t.stats.slots.find((s) => s.key === key)?.state;
  return st === 'logged' ? 'Logged' : st === 'missed' ? 'Missed' : st === 'due' ? 'To log' : '';
}
function slotTone(t: TrackerSummary, key: string) {
  const st = t.stats.slots.find((s) => s.key === key)?.state;
  return st === 'logged' ? 'success' : st === 'missed' ? 'warning' : 'muted';
}

function PropRow({ icon, label, children }: { icon: IconType; label: string; children: ReactNode }) {
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
  saved,
  divider,
  onDone,
}: {
  t: TrackerSummary;
  date: string;
  /** The log already saved for `date`, from the tracker's full history (null when none or not loaded yet). */
  saved: TrackerEntry | null;
  divider: string;
  onDone: () => void;
}) {
  const theme = useTheme();
  const { org } = useWorkspace();
  const log = useLogProgress(org?.id);
  const prefill = saved ?? (t.dueEntry && t.dueEntry.entryDate === date ? t.dueEntry : null);
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
            <PropRow icon={HashIcon} label={m.name}>
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
            <PropRow icon={CalculatorIcon} label={m.name}>
              <Text size="sm" weight="semibold" color="muted" tabular>
                {fmt(m, v)}
              </Text>
            </PropRow>
          </View>
        );
      })}
      <Divider color={divider} />
      <PropRow icon={StickyNoteIcon} label="Note">
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
          <Text size="13" color={theme.danger}>
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
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  countChip: { minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  group: { borderRadius: Radius.card, borderWidth: 1, overflow: 'hidden' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  headText: { flex: 1, minWidth: 0, gap: 6 },
  emptyAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  pacePill: { height: 20, paddingHorizontal: 8, borderRadius: 10, justifyContent: 'center' },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexGrow: 1, flexBasis: '46%', minWidth: 0, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileValue: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 4 },
  tileFigure: { fontSize: 26, lineHeight: 30 },
  period: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  periodBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  checkHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  square: { width: 16, height: 16, borderRadius: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14 },
  label: { width: 96 },
  value: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginLeft: 40 },
  numInput: { minWidth: 96, textAlign: 'right', fontSize: 15, fontFamily: Fonts.sans.semibold, padding: 0 },
  noteInput: { flex: 1, textAlign: 'right', fontSize: 14, fontFamily: Fonts.sans.regular, padding: 0 },
  saveWrap: { gap: 8, padding: 14, paddingTop: 6 },
  newBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 10 },
  logHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 10 },
});
