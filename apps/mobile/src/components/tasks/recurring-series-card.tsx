import { faDiscord } from '@fortawesome/free-brands-svg-icons';
import { faBell, faCheck, faChevronDown, faClock } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { Pulse } from '@/components/motion/pulse';
import { PressableScale } from '@/components/motion/pressable-scale';
import { RotatingChevron } from '@/components/motion/rotating-chevron';
import { useBoardActions } from '@/components/tasks/board-context';
import { Text } from '@/components/text';
import { cardEnter, listLayout, revealIn, revealOut } from '@/constants/motion';
import { alpha, Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { formatDateOnly, formatLogTimestamp } from '@/lib/format';
import { useSeriesOccurrences, type SeriesSummaryRow } from '@/lib/queries';
import type { MemberRow, TaskRow } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

/** Minimal shape the completion-line helpers need — satisfied by both a full TaskRow and a series-summary's `lastDone`. */
type CompletionLike = {
  completedAt?: string | null;
  dueAt: string | null;
  assigneeUserIds?: string[];
  lastSubmittedAt?: string | null;
};

function memberName(members: MemberRow[], userId: string): string {
  const m = members.find((x) => x.userId === userId);
  return m?.name?.trim() || m?.email || 'Unknown';
}

function assigneeNames(members: MemberRow[], ids: string[] | undefined): string {
  return ids?.length ? ids.map((id) => memberName(members, id)).join(', ') : 'Someone';
}

/** "{completedAt}, {assignee} completed this task [icon] in time/late". */
function CompletionLine({ t, members, timeZone }: { t: CompletionLike; members: MemberRow[]; timeZone: string }) {
  const dark = useIsDark();
  if (!t.completedAt) return null;
  const late = t.dueAt ? new Date(t.completedAt).getTime() > new Date(t.dueAt).getTime() : null;
  return (
    <View style={styles.inlineRow}>
      <Text font="mono" size="11" color="muted">
        {formatLogTimestamp(t.completedAt, timeZone)}, {assigneeNames(members, t.assigneeUserIds)} completed this task
      </Text>
      {late !== null ? (
        <>
          <Icon icon={late ? faBell : faCheck} size={10} color={late ? (dark ? Tone.red400 : Tone.red500) : Tone.emerald500} />
          <Text font="mono" size="11" color="muted">
            {late ? 'late' : 'in time'}
          </Text>
        </>
      ) : null}
    </View>
  );
}

/** "Sent to [discord] Discord · {timestamp}", pill-chipped like the recurring badge. */
function DiscordSubmissionLine({ t, timeZone }: { t: CompletionLike; timeZone: string }) {
  const theme = useTheme();
  if (!t.lastSubmittedAt) return null;
  return (
    <View style={[styles.pill, { backgroundColor: theme.surfaceHover }]}>
      <Text size="10" color="muted">
        Sent to
      </Text>
      <Icon icon={faDiscord} size={10} color="#5865F2" />
      <Text size="10" color="muted">
        Discord · {formatLogTimestamp(t.lastSubmittedAt, timeZone)}
      </Text>
    </View>
  );
}

function OccurrenceListSkeleton() {
  const theme = useTheme();
  return (
    <View style={styles.skeletonWrap}>
      <Pulse style={[styles.skeletonBar, { width: '75%', backgroundColor: theme.surfaceHover }]} />
      <Pulse style={[styles.skeletonBar, { width: '50%', backgroundColor: theme.surfaceHover }]} />
      <Pulse style={[styles.skeletonBar, { width: '65%', backgroundColor: theme.surfaceHover }]} />
    </View>
  );
}

/**
 * Groups a recurring chain into a single collapsible card (Done/Cancelled columns), matching the
 * web's `RecurringSeriesCard`. Header stats come straight from the already-loaded summary list;
 * only the full occurrence list is fetched on demand, once the card is expanded.
 */
export function RecurringSeriesCard({
  summary,
  occurrenceStatuses,
  enterIndex,
}: {
  summary: SeriesSummaryRow;
  /** Statuses this card's occurrence list should be fetched for once expanded (a kanban column, or done+cancelled together in list view). */
  occurrenceStatuses: readonly string[];
  /** Position in the list, for the staggered entrance; omit for no entrance animation. */
  enterIndex?: number;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const { openTask, timeZone } = useBoardActions();
  const { org, members } = useWorkspace();

  const {
    tasks: occurrences,
    isLoading: occurrencesLoading,
    nextCursor,
    hasMoreBeyondCap,
    loadingMore,
    loadMoreError,
    loadMore,
  } = useSeriesOccurrences(org?.id, summary.seriesId, { statuses: occurrenceStatuses, enabled: expanded });

  return (
    <Animated.View
      layout={listLayout}
      entering={enterIndex === undefined ? undefined : cardEnter(enterIndex)}
      style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
      {/* Series header row */}
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <PressableScale
            scaleTo={0.995}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            onPress={() => openTask(summary.latest.id)}
            accessibilityRole="link">
            <Text size="sm" weight="medium" lh={19} numberOfLines={2}>
              {summary.latest.title}
            </Text>
          </PressableScale>

          <View style={styles.metaRow}>
            <View style={[styles.pill, { backgroundColor: theme.surfaceHover }]}>
              <Icon icon={faClock} size={8} color="muted" />
              <Text size="10" weight="semibold" color="muted" uppercase tracking={0.2}>
                Recurring · {summary.count} {summary.count === 1 ? 'completion' : 'completions'}
              </Text>
            </View>
            {summary.lastDone?.completedAt ? (
              <CompletionLine t={summary.lastDone} members={members} timeZone={timeZone} />
            ) : summary.lastDone ? (
              <Text font="mono" size="10" color="muted">
                Last: {summary.lastDone.dueAt ? formatDateOnly(summary.lastDone.dueAt, timeZone) : '—'}
              </Text>
            ) : null}
            {summary.lastDone?.lastSubmittedAt ? <DiscordSubmissionLine t={summary.lastDone} timeZone={timeZone} /> : null}
          </View>
        </View>

        <PressableScale
          scaleTo={0.92}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse series' : 'Expand series'}
          hitSlop={6}
          onPress={() => setExpanded((x) => !x)}
          style={styles.chevronBtn}>
          <RotatingChevron open={expanded} icon={faChevronDown} openDeg={180} size={14} />
        </PressableScale>
      </View>

      {/* Occurrence list — fetched on demand, only while expanded */}
      {expanded ? (
        <Animated.View
          entering={revealIn}
          exiting={revealOut}
          style={[styles.body, { borderTopColor: alpha(theme.borderSubtle, 0.5) }]}>
          {occurrencesLoading ? (
            <OccurrenceListSkeleton />
          ) : (
            occurrences.map((t: TaskRow, i: number) => (
              <View
                key={t.id}
                style={[styles.occRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: alpha(theme.borderSubtle, 0.3) }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  {t.completedAt ? (
                    <>
                      <CompletionLine t={t} members={members} timeZone={timeZone} />
                      {t.lastSubmittedAt ? <DiscordSubmissionLine t={t} timeZone={timeZone} /> : null}
                    </>
                  ) : (
                    <View style={styles.inlineRow}>
                      <Text font="mono" size="11" color="muted">
                        Due {t.dueAt ? formatDateOnly(t.dueAt, timeZone) : '—'}
                      </Text>
                      {t.assigneeUserIds?.length ? (
                        <Text font="mono" size="11" color="fg" style={{ opacity: 0.7 }}>
                          {assigneeNames(members, t.assigneeUserIds)}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>
                <PressableScale scaleTo={0.92} onPress={() => openTask(t.id)} hitSlop={6} style={styles.openBtn}>
                  <Text size="10" weight="medium" color="muted">
                    Open
                  </Text>
                </PressableScale>
              </View>
            ))
          )}

          {/* A chain's history is unbounded — pagination stops at OCCURRENCE_CAP rather than
              letting a years-old recurring chain page back indefinitely (see useSeriesOccurrences). */}
          {!occurrencesLoading && nextCursor ? (
            <PressableScale
              scaleTo={0.98}
              onPress={() => void loadMore()}
              disabled={loadingMore}
              style={[
                styles.loadMoreBtn,
                { borderColor: loadMoreError ? alpha(Tone.red500, 0.4) : theme.borderSubtle },
                loadingMore && { opacity: 0.6 },
              ]}>
              <Text size="11" weight="medium" color={loadMoreError ? Tone.red500 : 'muted'}>
                {loadMoreError ? "Couldn't load more · retry" : loadingMore ? 'Loading…' : 'Load older occurrences'}
              </Text>
            </PressableScale>
          ) : null}
          {!occurrencesLoading && hasMoreBeyondCap ? (
            <Text size="10" color="muted" style={styles.capNote}>
              Showing the {occurrences.length} most recent occurrences
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  chevronBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.base, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 },
  inlineRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  body: { borderTopWidth: StyleSheet.hairlineWidth * 2 },
  skeletonWrap: { flexDirection: 'column', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  skeletonBar: { height: 10, borderRadius: 3 },
  occRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  openBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.base },
  loadMoreBtn: { margin: 12, marginTop: 6, paddingVertical: 8, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center' },
  capNote: { textAlign: 'center', paddingBottom: 10 },
});
