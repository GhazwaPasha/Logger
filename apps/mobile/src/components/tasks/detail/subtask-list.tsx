import { faCheck, faPlus } from '@fortawesome/free-solid-svg-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Panel, SectionLabel } from '@/components/page';
import { Text } from '@/components/text';
import { listLayout, revealOut } from '@/constants/motion';
import { alpha, Radius } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import type { SubtaskRow } from '@/lib/types';

/**
 * The checklist card — a port of the web's `TaskSubtaskList`: checkbox + inline rename-on-tap +
 * swipe-free "Remove", plus an "Add a subtask…" row. `toggleOnly` drops rename/remove/add for
 * participants who can't edit fields (the checkbox itself still works for anyone who can participate).
 */
export function SubtaskListCard({
  subtasks,
  disabled,
  toggleOnly,
  pendingSubtaskId,
  onToggle,
  onRename,
  onDelete,
  onCreate,
  creating,
}: {
  subtasks: SubtaskRow[];
  disabled?: boolean;
  toggleOnly?: boolean;
  pendingSubtaskId?: string | null;
  onToggle: (subtaskId: string, done: boolean) => void;
  onRename: (subtaskId: string, title: string) => void;
  onDelete: (subtaskId: string) => void;
  onCreate: (title: string) => void;
  creating?: boolean;
}) {
  const theme = useTheme();
  const dark = useIsDark();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState('');
  const [draft, setDraft] = useState('');
  const creatingRef = useRef(false);

  if (subtasks.length === 0 && toggleOnly) return null;

  const doneCount = subtasks.filter((s) => s.done).length;

  const commitDraft = () => {
    const title = draft.trim();
    if (!title || disabled || creatingRef.current) return;
    creatingRef.current = true;
    setDraft('');
    onCreate(title);
    queueMicrotask(() => {
      creatingRef.current = false;
    });
  };

  const commitEdit = (id: string, original: string) => {
    const next = editingVal.trim();
    setEditingId(null);
    if (!next || next === original) return;
    onRename(id, next);
  };

  return (
    <Panel style={{ gap: 4 }}>
      <SectionLabel size="10">{subtasks.length > 0 ? `Subtasks — ${doneCount}/${subtasks.length} done` : 'Subtasks'}</SectionLabel>
      {subtasks.map((item) => {
        const busy = item.id.startsWith('optimistic-') || pendingSubtaskId === item.id;
        return (
          <Animated.View key={item.id} layout={listLayout} exiting={revealOut} style={styles.row}>
            <PressableScale
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.done }}
              disabled={disabled || busy}
              haptic="select"
              onPress={() => onToggle(item.id, !item.done)}
              style={[
                styles.checkbox,
                item.done
                  ? { backgroundColor: theme.accent, borderColor: theme.accent }
                  : { backgroundColor: theme.surfaceElevated, borderColor: alpha(theme.fg, dark ? 0.22 : 0.18) },
              ]}>
              {busy ? (
                <ActivityIndicator size="small" color={theme.muted} style={{ transform: [{ scale: 0.55 }] }} />
              ) : item.done ? (
                <Icon icon={faCheck} size={10} color={theme.onAccent} />
              ) : null}
            </PressableScale>
            {!toggleOnly && editingId === item.id ? (
              <TextInput
                autoFocus
                value={editingVal}
                onChangeText={setEditingVal}
                onBlur={() => commitEdit(item.id, item.title)}
                onSubmitEditing={() => commitEdit(item.id, item.title)}
                style={[styles.editInput, { color: theme.fg }]}
              />
            ) : (
              <PressableScale
                disabled={disabled || toggleOnly}
                style={{ flex: 1 }}
                onPress={() => {
                  setEditingId(item.id);
                  setEditingVal(item.title);
                }}>
                <Text
                  size="sm"
                  color={item.done ? 'muted' : 'fg'}
                  style={item.done ? { textDecorationLine: 'line-through', textDecorationColor: theme.muted } : undefined}>
                  {item.title}
                </Text>
              </PressableScale>
            )}
            {!toggleOnly ? (
              <PressableScale disabled={disabled || busy} hitSlop={8} onPress={() => onDelete(item.id)}>
                <Text size="11" color="muted">
                  Remove
                </Text>
              </PressableScale>
            ) : null}
          </Animated.View>
        );
      })}
      {!toggleOnly ? (
        <View style={[styles.row, { paddingVertical: 6 }]}>
          <Text size="sm" color="muted">
            +
          </Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a subtask…"
            placeholderTextColor={theme.muted}
            onBlur={commitDraft}
            onSubmitEditing={commitDraft}
            style={[styles.editInput, { color: theme.fg }]}
          />
          {creating ? <ActivityIndicator size="small" color={theme.muted} /> : <Icon icon={faPlus} size={13} color="muted" style={{ opacity: 0.5 }} />}
        </View>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkbox: { width: 18, height: 18, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  editInput: { flex: 1, fontSize: 14, padding: 0 },
});
