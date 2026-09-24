import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { listLayout, revealIn, revealOut } from '@/constants/motion';
import { alpha, Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { aiFillSummary, requestTaskAiFill, type TaskAiExistingDraft, type TaskAiFillResult } from '@/lib/task-ai-fill';
import type { MemberRow } from '@/lib/types';

/** "Describe your task in natural language" — the web's `TaskPanelAiFill`: a blue-tinted card with a toggle that reveals a prompt box. */
export function AiFillCard({
  members,
  existingDraft,
  onApply,
}: {
  members: MemberRow[];
  existingDraft: TaskAiExistingDraft;
  onApply: (result: TaskAiFillResult) => void;
}) {
  const theme = useTheme();
  const dark = useIsDark();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const blue = dark ? Tone.blue400 : Tone.blue500;

  async function run() {
    const prompt = text.trim();
    if (!prompt) {
      setError('Describe the task in plain language first.');
      return;
    }
    setError(null);
    setOk(null);
    setLoading(true);
    try {
      const result = await requestTaskAiFill(prompt, members, existingDraft);
      onApply(result);
      setOk(aiFillSummary(result));
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Animated.View
      layout={listLayout}
      style={[styles.card, { borderColor: alpha(Tone.blue500, 0.3), backgroundColor: alpha(Tone.blue500, dark ? 0.07 : 0.06) }]}>
      <View style={styles.head}>
        <Icon icon={faWandMagicSparkles} size={15} color={blue} />
        <Text size="sm" weight="semibold" style={{ flex: 1 }}>
          Describe your task in natural language
        </Text>
        <Switch
          value={open}
          onValueChange={(v) => {
            setOpen(v);
            setError(null);
            setOk(null);
          }}
          trackColor={{ false: theme.surfaceMuted, true: Tone.blue500 }}
          thumbColor="#fff"
          accessibilityLabel="Describe your task in natural language"
        />
      </View>

      {open ? (
        <Animated.View entering={revealIn} exiting={revealOut} style={{ gap: 8 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="e.g. High priority — have Dana review the Q2 deck by Friday 5pm, weekly. Subtasks: outline, slides, dry run."
            placeholderTextColor={theme.muted}
            cursorColor={blue}
            style={[
              styles.input,
              { color: theme.fg, borderColor: theme.borderSubtle, backgroundColor: alpha(Tone.blue500, dark ? 0.07 : 0.05) },
            ]}
          />
          <Button
            title="AI fill"
            icon={faWandMagicSparkles}
            variant="secondary"
            loading={loading}
            onPress={() => void run()}
            haptic="tap"
            style={{ backgroundColor: alpha(Tone.blue500, dark ? 0.16 : 0.12) }}
          />
          {error ? (
            <Text size="xs" color={dark ? Tone.red400 : Tone.red600}>
              {error}
            </Text>
          ) : null}
          {ok && !error ? (
            <Text size="xs" color={dark ? Tone.emerald400 : Tone.emerald500}>
              {ok}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.xxxl, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { minHeight: 88, borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, textAlignVertical: 'top' },
});
