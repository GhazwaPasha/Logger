import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { usePresence } from '@/components/motion/use-presence';
import { Text } from '@/components/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { NODE_LABELS } from '@/lib/labels';
import type { Dept, ListRow } from '@/lib/types';

/** Category/channel field — a mobile port of the web's two-stage `TaskLevelListField` search. */
export function LevelListFieldCard({
  listId,
  lists,
  depts,
  canEdit,
  onChange,
}: {
  listId: string;
  lists: ListRow[];
  depts: Dept[];
  canEdit: boolean;
  onChange: (listId: string) => void;
}) {
  const theme = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const committedList = lists.find((l) => l.id === listId) ?? null;
  const committedDept = committedList ? (depts.find((d) => d.id === committedList.departmentId) ?? null) : null;

  if (!canEdit) {
    if (!committedDept && !committedList) return null;
    return (
      <View style={styles.chips}>
        {committedDept ? (
          <View style={[styles.chip, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }]}>
            <Text size="sm" color="muted">
              {committedDept.name}
            </Text>
          </View>
        ) : null}
        {committedList ? (
          <View style={[styles.chip, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }]}>
            <Text size="sm">{committedList.name}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <View style={styles.chips}>
        {committedDept ? (
          <View style={[styles.chip, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }]}>
            <Text size="sm" color="muted">
              {committedDept.name}
            </Text>
          </View>
        ) : null}
        <PressableScale
          style={[styles.chip, styles.editChip, { borderColor: theme.borderSubtle }]}
          onPress={() => setSheetOpen(true)}>
          <Text size="sm" weight={committedList ? 'medium' : undefined} color={committedList ? 'fg' : 'muted'}>
            {committedList ? committedList.name : `Search ${NODE_LABELS.level.toLowerCase()} & ${NODE_LABELS.list.toLowerCase()}`}
          </Text>
        </PressableScale>
      </View>

      <LevelListSheet
        visible={sheetOpen}
        lists={lists}
        depts={depts}
        initialDeptId={committedDept?.id ?? null}
        onClose={() => setSheetOpen(false)}
        onPick={(id) => {
          onChange(id);
          setSheetOpen(false);
        }}
      />
    </>
  );
}

function LevelListSheet({
  visible,
  lists,
  depts,
  initialDeptId,
  onClose,
  onPick,
}: {
  visible: boolean;
  lists: ListRow[];
  depts: Dept[];
  initialDeptId: string | null;
  onClose: () => void;
  onPick: (listId: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { mounted, progress } = usePresence(visible, { spring: true });
  const [stagedDeptId, setStagedDeptId] = useState<string | null>(initialDeptId);
  const [query, setQuery] = useState('');

  const backdrop = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.value)) }));
  const sheet = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.value));
    return { opacity: p, transform: [{ translateY: (1 - p) * height * 0.4 }] };
  });

  const stagedDept = stagedDeptId ? (depts.find((d) => d.id === stagedDeptId) ?? null) : null;

  const deptOptions = useMemo(
    () =>
      depts
        .filter((d) => !query.trim() || d.name.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [depts, query],
  );
  const listOptions = useMemo(
    () =>
      lists
        .filter((l) => l.departmentId === stagedDeptId)
        .filter((l) => !query.trim() || l.name.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [lists, stagedDeptId, query],
  );

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View pointerEvents="box-none" style={[styles.anchor, sheet]}>
        <Pressable
          onPress={() => {}}
          style={[styles.sheet, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.sheetHead}>
            {stagedDept ? (
              <View style={[styles.chip, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }]}>
                <Text size="sm" color="muted">
                  {stagedDept.name}
                </Text>
                <PressableScale
                  hitSlop={6}
                  onPress={() => {
                    setStagedDeptId(null);
                    setQuery('');
                  }}>
                  <Icon icon={faXmark} size={11} color="muted" />
                </PressableScale>
              </View>
            ) : (
              <Text size="11" weight="semibold" color="muted" uppercase tracking={0.8}>
                {`Choose a ${NODE_LABELS.level.toLowerCase()}`}
              </Text>
            )}
          </View>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={stagedDept ? `Search ${NODE_LABELS.list.toLowerCase()}s…` : `Search ${NODE_LABELS.level.toLowerCase()}s…`}
            placeholderTextColor={theme.muted}
            style={[styles.search, { backgroundColor: theme.surfaceMuted, color: theme.fg, borderColor: theme.border }]}
          />
          <View style={{ maxHeight: 280 }}>
            {!stagedDept
              ? deptOptions.map((d) => (
                  <PressableScale
                    key={d.id}
                    style={styles.option}
                    onPress={() => {
                      setStagedDeptId(d.id);
                      setQuery('');
                    }}>
                    <Text size="sm" weight="medium">
                      {d.name}
                    </Text>
                  </PressableScale>
                ))
              : listOptions.map((l) => (
                  <PressableScale key={l.id} style={styles.option} onPress={() => onPick(l.id)}>
                    <Text size="sm" weight="medium">
                      {l.name}
                    </Text>
                  </PressableScale>
                ))}
            {(stagedDept ? listOptions.length === 0 : deptOptions.length === 0) ? (
              <Text size="sm" color="muted" style={{ paddingVertical: 8 }}>
                No matches.
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.lg, borderWidth: 1 },
  editChip: { borderStyle: 'dashed' },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 12, borderTopLeftRadius: Radius.xxxl, borderTopRightRadius: Radius.xxxl, borderWidth: StyleSheet.hairlineWidth * 2, gap: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center' },
  search: { height: 40, borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  option: { paddingVertical: 10 },
});
