import { faCheck, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { SectionLabel } from '@/components/page';
import { Text } from '@/components/text';
import { listLayout } from '@/constants/motion';
import { alpha, Radius } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import type { SubtaskRow } from '@/lib/types';

/**
 * The checklist, inline with the rest of the task (no card around it): each line is edited right where it sits
 * — tap the text and type, it saves when you leave the line — and new lines are typed straight into the last row,
 * which stays focused so several can be added in a row. `toggleOnly` (participants who can't edit fields) keeps
 * just the checkboxes.
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
  const [draft, setDraft] = useState('');

  if (subtasks.length === 0 && toggleOnly) return null;

  const doneCount = subtasks.filter((s) => s.done).length;

  const commitDraft = () => {
    const title = draft.trim();
    if (!title || disabled) return;
    setDraft('');
    onCreate(title);
  };

  return (
    <View style={styles.wrap}>
      <SectionLabel size="10">{subtasks.length > 0 ? `Subtasks · ${doneCount}/${subtasks.length} done` : 'Subtasks'}</SectionLabel>
      {subtasks.map((item) => (
        <SubtaskLine
          key={item.id}
          item={item}
          busy={item.id.startsWith('optimistic-') || pendingSubtaskId === item.id}
          disabled={disabled}
          toggleOnly={toggleOnly}
          onToggle={onToggle}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
      {!toggleOnly ? (
        <View style={styles.row}>
          <View style={styles.addMark}>
            {creating ? (
              <ActivityIndicator size="small" color={theme.muted} style={{ transform: [{ scale: 0.6 }] }} />
            ) : (
              <Icon icon={faPlus} size={11} color="muted" />
            )}
          </View>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a subtask"
            placeholderTextColor={theme.muted}
            editable={!disabled}
            returnKeyType="done"
            // Return adds the line and keeps the cursor here for the next one.
            submitBehavior="submit"
            onSubmitEditing={commitDraft}
            onBlur={commitDraft}
            style={[styles.input, { color: theme.fg }]}
          />
        </View>
      ) : null}
    </View>
  );
}

function SubtaskLine({
  item,
  busy,
  disabled,
  toggleOnly,
  onToggle,
  onRename,
  onDelete,
}: {
  item: SubtaskRow;
  busy: boolean;
  disabled?: boolean;
  toggleOnly?: boolean;
  onToggle: (subtaskId: string, done: boolean) => void;
  onRename: (subtaskId: string, title: string) => void;
  onDelete: (subtaskId: string) => void;
}) {
  const theme = useTheme();
  const dark = useIsDark();
  const [value, setValue] = useState(item.title);
  const focused = useRef(false);
  const [editing, setEditing] = useState(false);

  // Follow the saved title (a teammate's edit, the server's answer) unless this line is being typed in.
  useEffect(() => {
    if (!focused.current) setValue(item.title);
  }, [item.title]);

  const commit = () => {
    focused.current = false;
    setEditing(false);
    const next = value.trim();
    if (!next) setValue(item.title); // an emptied line goes back to what it was; ✕ removes a line
    else if (next !== item.title) onRename(item.id, next);
  };

  const struck = item.done ? ({ textDecorationLine: 'line-through', textDecorationColor: theme.muted } as const) : null;

  return (
    <Animated.View layout={listLayout} style={styles.row}>
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        accessibilityLabel={item.title}
        disabled={disabled || busy}
        haptic="select"
        hitSlop={8}
        onPress={() => onToggle(item.id, !item.done)}
        style={[
          styles.checkbox,
          item.done
            ? { backgroundColor: theme.accent, borderColor: theme.accent }
            : { borderColor: alpha(theme.fg, dark ? 0.28 : 0.22) },
        ]}>
        {busy ? (
          <ActivityIndicator size="small" color={theme.muted} style={{ transform: [{ scale: 0.55 }] }} />
        ) : item.done ? (
          <Icon icon={faCheck} size={10} color={theme.onAccent} />
        ) : null}
      </PressableScale>

      {toggleOnly ? (
        <Text size="sm" color={item.done ? 'muted' : 'fg'} style={[{ flex: 1 }, struck]}>
          {item.title}
        </Text>
      ) : (
        <TextInput
          value={value}
          onChangeText={setValue}
          editable={!disabled && !busy}
          multiline
          submitBehavior="blurAndSubmit"
          returnKeyType="done"
          onFocus={() => {
            focused.current = true;
            setEditing(true);
          }}
          onBlur={commit}
          style={[styles.input, { color: item.done && !editing ? theme.muted : theme.fg }, !editing && struck]}
        />
      )}

      {!toggleOnly && editing ? (
        <PressableScale
          disabled={disabled || busy}
          hitSlop={10}
          accessibilityLabel={`Remove ${item.title}`}
          onPress={() => onDelete(item.id)}>
          <Icon icon={faXmark} size={13} color="muted" />
        </PressableScale>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2, paddingHorizontal: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  checkbox: { width: 18, height: 18, borderRadius: Radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  addMark: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontSize: 15, paddingVertical: 6, paddingHorizontal: 0 },
});
