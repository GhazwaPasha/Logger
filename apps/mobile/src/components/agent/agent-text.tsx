import { router } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/text';

const TOKEN_RE = /\[([^\]]+)\]\(task:([0-9a-f-]{36})\)|\*\*([^*]+)\*\*/g;

/**
 * An agent answer: paragraphs, `- ` bullets, `**bold**`, and `[Title](task:<id>)` links that open the task.
 * Mirrors the web's `AgentText`; the prompt only allows these, anything else stays plain text.
 */
export function AgentText({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <View style={{ gap: 10 }}>
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim());
        const isList = lines.length > 0 && lines.every((l) => /^\s*[-*•]\s+/.test(l));
        if (isList) {
          return (
            <View key={i} style={{ gap: 4 }}>
              {lines.map((l, j) => (
                <View key={j} style={{ flexDirection: 'row', gap: 8, paddingRight: 4 }}>
                  <Text size="15" color="muted">
                    •
                  </Text>
                  <Text size="15" style={{ flex: 1 }}>
                    {inline(l.replace(/^\s*[-*•]\s+/, ''))}
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={i} size="15">
            {lines.map((l, j) => (j > 0 ? ['\n', ...inline(l)] : inline(l)))}
          </Text>
        );
      })}
    </View>
  );
}

function inline(line: string) {
  const out: (string | React.JSX.Element)[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN_RE)) {
    if (m.index! > last) out.push(line.slice(last, m.index));
    if (m[2]) {
      const id = m[2];
      out.push(
        <Text
          key={m.index}
          size="15"
          weight="semibold"
          accessibilityRole="link"
          style={{ textDecorationLine: 'underline' }}
          onPress={() => router.push({ pathname: '/task/[id]', params: { id } })}>
          {m[1]}
        </Text>,
      );
    } else {
      out.push(
        <Text key={m.index} size="15" weight="semibold">
          {m[3]}
        </Text>,
      );
    }
    last = m.index! + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}
