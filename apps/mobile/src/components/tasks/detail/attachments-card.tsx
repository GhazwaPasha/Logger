import { faDiscord } from '@fortawesome/free-brands-svg-icons';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Panel, SectionLabel } from '@/components/page';
import { Text } from '@/components/text';
import { listLayout, revealOut } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AttachmentRow } from '@/lib/task-detail-queries';

function formatBytes(bytes: string): string {
  const n = parseInt(bytes, 10);
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileEmoji(mime: string): string {
  if (mime.startsWith('image/')) return '🖼';
  if (mime === 'application/pdf') return '📄';
  if (mime.startsWith('text/')) return '📝';
  return '📎';
}

/**
 * Attachments card — read + delete only, matching the web's `AttachmentZone`. Direct upload is
 * disabled org-wide server-side (the API rejects it); new files only arrive via Discord submission.
 */
export function AttachmentsCard({
  attachments,
  attachmentRequired,
  userId,
  isOwner,
  onDelete,
}: {
  attachments: AttachmentRow[];
  attachmentRequired?: boolean;
  userId: string;
  isOwner: boolean;
  onDelete: (attachmentId: string) => void;
}) {
  const theme = useTheme();
  if (attachments.length === 0) return null;

  return (
    <Panel style={{ gap: 8 }}>
      <SectionLabel size="10">Attachments</SectionLabel>
      {attachmentRequired ? (
        <Text size="xs" weight="medium" color="muted">
          Attachment required before marking done
        </Text>
      ) : null}
      {attachments.map((a) => (
        <Animated.View
          key={a.id}
          layout={listLayout}
          exiting={revealOut}
          style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.borderSubtle }]}>
          {a.storageKey ? (
            <Text size="base">{fileEmoji(a.mimeType)}</Text>
          ) : (
            <Icon icon={faDiscord} size={16} color="#5865F2" />
          )}
          <PressableScale style={{ flex: 1, minWidth: 0 }} onPress={() => Linking.openURL(a.url).catch(() => {})}>
            <Text size="sm" weight="medium" numberOfLines={1}>
              {a.fileName}
            </Text>
            <Text font="mono" size="10" color="muted">
              {a.storageKey ? formatBytes(a.fileSize) : 'View in Discord'}
            </Text>
          </PressableScale>
          {a.discordDeliveredAt ? (
            <View style={[styles.discordBadge, { backgroundColor: 'rgba(88,101,242,0.15)' }]}>
              <Text size="10" weight="semibold" color="#5865F2">
                Discord
              </Text>
            </View>
          ) : null}
          {a.uploadedBy === userId || isOwner ? (
            <PressableScale
              hitSlop={8}
              onPress={() =>
                Alert.alert('Delete this attachment?', `This will permanently remove "${a.fileName}". This cannot be undone.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => onDelete(a.id) },
                ])
              }>
              <Icon icon={faTrashCan} size={13} color="muted" />
            </PressableScale>
          ) : null}
        </Animated.View>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  discordBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
});
