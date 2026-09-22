import { faRoute } from '@fortawesome/free-solid-svg-icons';
import { StyleSheet, View } from 'react-native';

import { Page, PageTitle, Panel } from '@/components/page';
import { Text } from '@/components/text';
import { CenteredSpinner, EmptyState, ErrorBanner } from '@/components/ui';
import { alpha, Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { formatDateOnly } from '@/lib/format';
import { useRoadmap, type RoadmapStatus } from '@/lib/queries';
import { useWorkspace } from '@/lib/workspace';

const STATUS: Record<RoadmapStatus, { label: string; tone: string }> = {
  on_track: { label: 'On track', tone: Tone.emerald500 },
  at_risk: { label: 'At risk', tone: Tone.amber500 },
  done: { label: 'Done', tone: Tone.sky500 },
  archived: { label: 'Archived', tone: Tone.neutral500 },
};

function Progress({ pct }: { pct: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
      <View style={{ width: `${Math.max(pct, 2)}%`, height: '100%', borderRadius: 4, backgroundColor: theme.accent }} />
    </View>
  );
}

function StatusChip({ status }: { status: RoadmapStatus }) {
  const dark = useIsDark();
  const s = STATUS[status];
  return (
    <View style={[styles.chip, { backgroundColor: alpha(s.tone, dark ? 0.15 : 0.22) }]}>
      <Text size="11" weight="semibold">
        {s.label}
      </Text>
    </View>
  );
}

/** Roadmap — goals with their milestones and rolled-up progress. */
export default function RoadmapScreen() {
  const theme = useTheme();
  const { org } = useWorkspace();
  const q = useRoadmap(org?.id);
  const tz = org?.timeZone;
  const goals = (q.data?.goals ?? []).filter((g) => g.status !== 'archived');

  return (
    <Page gap={12} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <PageTitle>Roadmap</PageTitle>
      {q.error ? <ErrorBanner message={q.error.message} onRetry={() => void q.refetch()} /> : null}
      {q.isLoading ? <CenteredSpinner /> : null}
      {!q.isLoading && goals.length === 0 && !q.error ? (
        <EmptyState icon={faRoute} title="No goals yet" description="Plan goals and milestones on the web app." />
      ) : null}

      {goals.map((g) => {
        const milestones = (q.data?.milestones ?? [])
          .filter((m) => m.goalId === g.id && m.status !== 'archived')
          .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
        return (
          <Panel key={g.id} style={{ gap: 10 }}>
            <View style={styles.head}>
              <Text size="sm" weight="semibold" style={{ flex: 1 }}>
                {g.title}
              </Text>
              <StatusChip status={g.status} />
            </View>
            {g.description ? (
              <Text size="sm" color="muted">
                {g.description}
              </Text>
            ) : null}
            <View style={{ gap: 4 }}>
              <Progress pct={g.progress.pct} />
              <View style={styles.head}>
                <Text size="11" color="muted" tabular>
                  {g.progress.done}/{g.progress.total} tasks · {g.progress.pct}%
                </Text>
                {g.targetDate ? (
                  <Text size="11" color="muted">
                    Target {formatDateOnly(g.targetDate, tz)}
                  </Text>
                ) : null}
              </View>
            </View>

            {milestones.length > 0 ? (
              <View style={[styles.milestones, { borderTopColor: theme.borderSubtle }]}>
                {milestones.map((m) => (
                  <View key={m.id} style={[styles.milestone, { marginLeft: m.parentId ? 12 : 0 }]}>
                    <View style={styles.head}>
                      <Text size="sm" weight="medium" style={{ flex: 1 }}>
                        {m.title}
                      </Text>
                      <StatusChip status={m.status} />
                    </View>
                    <Text size="11" color="muted">
                      {formatDateOnly(m.periodStart, tz)} – {formatDateOnly(m.periodEnd, tz)}
                    </Text>
                    <Progress pct={m.progress.pct} />
                  </View>
                ))}
              </View>
            ) : null}
          </Panel>
        );
      })}
    </Page>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  track: { height: 6, borderRadius: 4, overflow: 'hidden' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.base },
  milestones: { borderTopWidth: StyleSheet.hairlineWidth * 2, paddingTop: 10, gap: 12 },
  milestone: { gap: 4 },
});
