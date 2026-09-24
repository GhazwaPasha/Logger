import { faCheck, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { usePresence } from '@/components/motion/use-presence';
import { Panel, SectionLabel } from '@/components/page';
import { Text } from '@/components/text';
import { Avatar } from '@/components/ui';
import { listLayout, revealIn, revealOut, stateTransition } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MemberRow } from '@/lib/types';

function primaryLabel(m: MemberRow): string {
  return (m.name?.trim() || m.email || '').trim() || 'Unknown';
}

/** Assignees card — removable chips + an "add" chip that opens a bottom sheet (same pattern as the due date). */
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
  const [open, setOpen] = useState(false);

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
            accessibilityRole="button"
            accessibilityLabel="Add assignee"
            style={[styles.addChip, { borderColor: theme.borderSubtle }]}
            onPress={() => setOpen(true)}>
            <Icon icon={faPlus} size={10} color="muted" />
            <Text size="xs" weight="medium" color="muted">
              {assigneeIds.length === 0 ? 'Add assignee' : 'Add'}
            </Text>
          </PressableScale>
        ) : null}
      </View>

      <AssigneeSheet visible={open} assigneeIds={assigneeIds} members={members} onToggle={onToggle} onClose={() => setOpen(false)} />
    </Panel>
  );
}

function AssigneeSheet({
  visible,
  assigneeIds,
  members,
  onToggle,
  onClose,
}: {
  visible: boolean;
  assigneeIds: string[];
  members: MemberRow[];
  onToggle: (userId: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { mounted, progress } = usePresence(visible, { spring: true });
  const [query, setQuery] = useState('');

  const backdrop = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.value)) }));
  const sheet = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.value));
    return { opacity: p, transform: [{ translateY: (1 - p) * height * 0.4 }] };
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => !q || primaryLabel(m).toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q))
      .sort((a, b) => primaryLabel(a).localeCompare(primaryLabel(b)));
  }, [members, query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none" style={styles.anchor}>
        <Animated.View pointerEvents="box-none" style={[styles.anchor, sheet]}>
          <Pressable
            onPress={() => {}}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                paddingBottom: Math.max(insets.bottom, 12),
                maxHeight: height * 0.7,
              },
            ]}>
            <Text size="11" weight="semibold" color="muted" uppercase tracking={0.8} style={{ paddingHorizontal: 4, paddingBottom: 4 }}>
              Assignees
            </Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name or email…"
              placeholderTextColor={theme.muted}
              autoCorrect={false}
              style={[styles.search, { backgroundColor: theme.surfaceMuted, color: theme.fg, borderColor: theme.border }]}
            />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {rows.length === 0 ? (
                <Text size="xs" color="muted" style={{ padding: 12 }}>
                  {members.length === 0 ? 'No team members in this workspace.' : 'No matches.'}
                </Text>
              ) : (
                rows.map((m) => {
                  const selected = assigneeIds.includes(m.userId);
                  return (
                    <PressableScale
                      key={m.userId}
                      scaleTo={0.985}
                      haptic="select"
                      accessibilityRole="menuitem"
                      onPress={() => onToggle(m.userId)}
                      style={({ pressed }) => [
                        styles.option,
                        { backgroundColor: selected ? theme.accentMuted : pressed ? theme.surfaceHover : 'transparent' },
                        stateTransition,
                      ]}>
                      <Avatar name={m.name} email={m.email} image={m.image} size={26} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" weight="semibold" numberOfLines={1}>
                          {primaryLabel(m)}
                        </Text>
                        {m.name && m.email ? (
                          <Text size="11" color="muted" numberOfLines={1}>
                            {m.email}
                          </Text>
                        ) : null}
                      </View>
                      {selected ? <Icon icon={faCheck} size={13} color="fg" /> : null}
                    </PressableScale>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 6, paddingRight: 10, borderRadius: Radius.full, borderWidth: 1 },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1, borderStyle: 'dashed' },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 8, borderTopLeftRadius: Radius.xxxl, borderTopRightRadius: Radius.xxxl, borderWidth: StyleSheet.hairlineWidth * 2, gap: 6 },
  search: { height: 40, borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: Radius.lg },
});
