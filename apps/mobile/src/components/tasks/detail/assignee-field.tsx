import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Panel, SectionLabel } from '@/components/page';
import { Text } from '@/components/text';
import { listLayout, revealIn, revealOut } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Avatar } from '@/components/ui';
import type { MemberRow } from '@/lib/types';

function primaryLabel(m: MemberRow): string {
  return (m.name?.trim() || m.email || '').trim() || 'Unknown';
}

/** Assignees card — a port of the web's `AssigneeSearchField`: removable chips + a name/email search-to-add list. */
export function AssigneeFieldCard({
  assigneeIds,
  members,
  canEdit,
  onToggle,
}: {
  assigneeIds: string[];
  members: MemberRow[];
  canEdit: boolean;
  onToggle: (userId: string) => void;
}) {
  const theme = useTheme();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const available = useMemo(
    () =>
      members
        .filter((m) => !assigneeIds.includes(m.userId))
        .filter((m) => !query.trim() || primaryLabel(m).toLowerCase().includes(query.toLowerCase()) || (m.email ?? '').toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => primaryLabel(a).localeCompare(primaryLabel(b))),
    [members, assigneeIds, query],
  );

  return (
    <Panel style={{ gap: 8 }}>
      <SectionLabel size="10">Assignees</SectionLabel>
      <View style={styles.chips}>
        {assigneeIds.length === 0 && !canEdit ? (
          <Text size="sm" color="muted">
            Unassigned
          </Text>
        ) : (
          assigneeIds.map((id) => {
            const m = members.find((r) => r.userId === id);
            const name = m ? primaryLabel(m) : 'Unknown';
            return (
              <Animated.View
                key={id}
                entering={revealIn}
                exiting={revealOut}
                layout={listLayout}
                style={[styles.chip, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }]}>
                <Avatar name={m?.name} email={m?.email} image={m?.image} size={20} />
                <Text size="sm" weight="medium">
                  {name}
                </Text>
                {canEdit ? (
                  <PressableScale hitSlop={6} accessibilityLabel={`Remove ${name}`} onPress={() => onToggle(id)}>
                    <Icon icon={faXmark} size={12} color="muted" />
                  </PressableScale>
                ) : null}
              </Animated.View>
            );
          })
        )}
        {canEdit ? (
          <PressableScale
            style={[styles.addChip, { borderColor: theme.borderSubtle }]}
            onPress={() => setSearching((v) => !v)}>
            <Text size="xs" weight="medium" color="muted">
              {assigneeIds.length === 0 ? 'Add assignee' : '+ Add'}
            </Text>
          </PressableScale>
        ) : null}
      </View>

      {canEdit && searching ? (
        <Animated.View entering={revealIn} exiting={revealOut} style={{ gap: 6 }}>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search name or email…"
            placeholderTextColor={theme.muted}
            style={[styles.search, { backgroundColor: theme.surfaceMuted, color: theme.fg, borderColor: theme.border }]}
          />
          {available.length === 0 ? (
            <Text size="xs" color="muted" style={{ paddingVertical: 6 }}>
              {members.length === 0 ? 'No team members in this workspace.' : 'No matches.'}
            </Text>
          ) : (
            available.slice(0, 8).map((m) => (
              <PressableScale
                key={m.userId}
                style={styles.option}
                onPress={() => {
                  onToggle(m.userId);
                  setQuery('');
                }}>
                <Avatar name={m.name} email={m.email} image={m.image} size={22} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" weight="medium" numberOfLines={1}>
                    {primaryLabel(m)}
                  </Text>
                  {m.name && m.email ? (
                    <Text size="11" color="muted" numberOfLines={1}>
                      {m.email}
                    </Text>
                  ) : null}
                </View>
              </PressableScale>
            ))
          )}
        </Animated.View>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 6, paddingRight: 10, borderRadius: Radius.full, borderWidth: 1 },
  addChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1, borderStyle: 'dashed' },
  search: { height: 40, borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
});
