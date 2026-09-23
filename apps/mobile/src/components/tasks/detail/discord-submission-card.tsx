import { faDiscord } from '@fortawesome/free-brands-svg-icons';
import { faCheck, faCircleExclamation, faCloudArrowUp } from '@fortawesome/free-solid-svg-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Pulse } from '@/components/motion/pulse';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { Radius } from '@/constants/theme';
import { useDiscordSubmit } from '@/lib/task-detail-queries';

/** Files sent to Discord in one go; also Discord's own per-message attachment cap. */
const MAX_FILES_PER_SUBMISSION = 5;

type QueueStatus = 'uploading' | 'success' | 'error';
type QueueItem = { id: string; name: string; status: QueueStatus; message?: string };

/**
 * Discord submission card — the mobile counterpart of the web's drag/drop `DiscordSubmissionZone`.
 * There's no drag-and-drop on a phone, so this opens the OS document picker instead; files still
 * post to Discord one at a time and land in the shared Attachments list on success.
 */
export function DiscordSubmissionCard({
  taskId,
  required,
  channelName,
  channelNameLoading,
}: {
  taskId: string;
  required?: boolean;
  channelName?: string | null;
  channelNameLoading?: boolean;
}) {
  const submit = useDiscordSubmit(taskId);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const submitting = queue.some((i) => i.status === 'uploading');

  const pickAndSubmit = async () => {
    if (submitting) return;
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
      type: ['image/*', 'application/pdf', 'text/*'],
    });
    if (result.canceled || !result.assets?.length) return;
    const picked = result.assets.slice(0, MAX_FILES_PER_SUBMISSION);
    const items: QueueItem[] = picked.map((f) => ({ id: `${Date.now()}-${f.name}`, name: f.name, status: 'uploading' }));
    setQueue(items);

    for (let i = 0; i < picked.length; i++) {
      const file = picked[i]!;
      const item = items[i]!;
      try {
        const res = await submit.mutateAsync({ uri: file.uri, name: file.name, mimeType: file.mimeType ?? undefined });
        if (res.discord.ok) {
          setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: 'success', message: 'Sent to Discord' } : q)));
        } else {
          const message = `Discord rejected it: ${res.discord.reason}`;
          setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: 'error', message } : q)));
        }
      } catch (e) {
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'error', message: e instanceof Error ? e.message : 'Submission failed' } : q)),
        );
      }
    }
  };

  return (
    <View style={[styles.card, { borderColor: 'rgba(88,101,242,0.25)', backgroundColor: 'rgba(88,101,242,0.05)' }]}>
      <View style={styles.header}>
        <View style={styles.discordIconWrap}>
          <Icon icon={faDiscord} size={16} color="#5865F2" />
        </View>
        <Text size="sm" weight="semibold" style={{ flex: 1 }}>
          Send to Discord{required ? ' (Required)*' : ''}
        </Text>
        {channelName ? (
          <View style={styles.channelChip}>
            <Text size="xs" weight="medium" color="#5865F2" numberOfLines={1}>
              #{channelName}
            </Text>
          </View>
        ) : channelNameLoading ? (
          <Pulse style={styles.channelChipSkeleton} />
        ) : null}
      </View>

      <PressableScale
        disabled={submitting}
        onPress={pickAndSubmit}
        style={[styles.dropzone, { borderColor: 'rgba(88,101,242,0.3)' }, submitting && { opacity: 0.6 }]}>
        <Icon icon={faCloudArrowUp} size={20} color="#5865F2" />
        <Text size="xs" weight="medium">
          {submitting ? 'Sending to Discord…' : `Tap to pick up to ${MAX_FILES_PER_SUBMISSION} files`}
        </Text>
      </PressableScale>

      {queue.length > 0 ? (
        <View style={{ gap: 4 }}>
          {queue.map((item) => (
            <View key={item.id} style={styles.queueRow}>
              {item.status === 'uploading' ? (
                <ActivityIndicator size="small" color="#5865F2" />
              ) : item.status === 'success' ? (
                <Icon icon={faCheck} size={12} color="#10b981" />
              ) : (
                <Icon icon={faCircleExclamation} size={12} color="#ef4444" />
              )}
              <Text size="xs" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                {item.name}
              </Text>
              <Text size="11" color={item.status === 'error' ? '#ef4444' : item.status === 'success' ? '#10b981' : 'muted'}>
                {item.status === 'uploading' ? 'Sending…' : item.message}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xxl, borderWidth: 1, padding: 14, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  discordIconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(88,101,242,0.15)' },
  channelChip: { borderRadius: Radius.full, borderWidth: 1, borderColor: 'rgba(88,101,242,0.25)', backgroundColor: 'rgba(88,101,242,0.1)', paddingHorizontal: 8, paddingVertical: 3, maxWidth: 140 },
  channelChipSkeleton: { width: 96, height: 22, borderRadius: Radius.full, backgroundColor: 'rgba(88,101,242,0.1)' },
  dropzone: { alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 2, borderStyle: 'dashed', borderRadius: Radius.xl, paddingVertical: 18 },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
