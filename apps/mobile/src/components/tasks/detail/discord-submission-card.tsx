import { faDiscord } from '@fortawesome/free-brands-svg-icons';
import {
  faCheck,
  faChevronDown,
  faCircleExclamation,
  faPaperclip,
  faRotateRight,
  faTrashCan,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { MenuSheet } from '@/components/menu-sheet';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Pulse } from '@/components/motion/pulse';
import { Text } from '@/components/text';
import { listLayout, revealIn } from '@/constants/motion';
import { alpha, Radius } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { timeAgo } from '@/lib/format';
import { useDiscordSubmit, type AttachmentRow, type DiscordChannelOption } from '@/lib/task-detail-queries';

const BLURPLE = '#5865F2';
const GREEN = '#10b981';
const RED = '#ef4444';

/** Files picked in one go; also Discord's own per-message attachment cap. */
const MAX_FILES_PER_PICK = 5;

/** A file on its way: bytes leaving the phone (`uploading`, real progress), then the API relaying it (`posting`). */
type Sending = {
  id: string;
  uri: string;
  name: string;
  mimeType?: string;
  phase: 'uploading' | 'posting' | 'error';
  progress: number;
  message?: string;
};

/**
 * "Send to Discord" — the task's Discord hand-in (the web's `DiscordSubmissionZone` + its editor toggle).
 *
 * - Owners switch it on for any task (new ones included), pick the channel and whether a submission is required.
 * - Anyone who can work the task attaches a file: a progress bar follows the real upload, then the post to
 *   Discord; once delivered the file stays listed as "<name> sent to Discord" (from the task's attachments, so
 *   it's still there next time).
 */
export function DiscordSubmissionCard({
  taskId,
  channelId,
  channels,
  channelsLoading,
  canConfigure,
  canEditFields,
  canSubmit,
  required,
  sent,
  userId,
  isOwner,
  onSetChannel,
  onSetRequired,
  onDelete,
}: {
  taskId: string;
  channelId: string | null;
  channels: DiscordChannelOption[];
  channelsLoading?: boolean;
  /** Workspace owner: may switch Discord on/off and change the channel (the API allows only owners). */
  canConfigure: boolean;
  canEditFields: boolean;
  canSubmit: boolean;
  required?: boolean;
  /** Files already delivered to Discord for this task, oldest first. */
  sent: AttachmentRow[];
  userId: string;
  isOwner: boolean;
  onSetChannel: (channelId: string | null) => void;
  onSetRequired: (required: boolean) => void;
  onDelete: (attachmentId: string) => void;
}) {
  const theme = useTheme();
  const dark = useIsDark();
  const submit = useDiscordSubmit(taskId);
  const [sending, setSending] = useState<Sending[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const enabled = !!channelId;
  const channelName = channels.find((c) => c.id === channelId)?.name ?? null;
  const busy = sending.some((s) => s.phase !== 'error');
  const update = (id: string, patch: Partial<Sending>) =>
    setSending((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const send = async (item: Sending) => {
    update(item.id, { phase: 'uploading', progress: 0, message: undefined });
    try {
      const res = await submit.mutateAsync({
        uri: item.uri,
        name: item.name,
        mimeType: item.mimeType,
        onProgress: (f) => update(item.id, f >= 1 ? { phase: 'posting', progress: 1 } : { progress: f }),
      });
      if (res.discord.ok) {
        // Now listed under "sent" from the attachments cache; drop the in-flight row.
        setSending((prev) => prev.filter((s) => s.id !== item.id));
      } else {
        update(item.id, { phase: 'error', message: `Discord rejected it: ${res.discord.reason}` });
      }
    } catch (e) {
      update(item.id, { phase: 'error', message: e instanceof Error ? e.message : 'Could not send' });
    }
  };

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
      type: ['image/*', 'application/pdf', 'text/*'],
    });
    if (result.canceled || !result.assets?.length) return;
    const items: Sending[] = result.assets.slice(0, MAX_FILES_PER_PICK).map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      uri: f.uri,
      name: f.name,
      mimeType: f.mimeType ?? undefined,
      phase: 'uploading',
      progress: 0,
    }));
    setSending((prev) => [...prev, ...items]);
    // One at a time, in the order picked (Discord posts them in that order).
    for (const item of items) await send(item);
  };

  const toggle = (on: boolean) => {
    if (on) setPickerOpen(true);
    else if (sent.length === 0) onSetChannel(null);
    else
      Alert.alert('Turn off Discord for this task?', 'Files already sent stay in Discord.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn off', style: 'destructive', onPress: () => onSetChannel(null) },
      ]);
  };

  return (
    <Animated.View
      layout={listLayout}
      style={[styles.card, { borderColor: alpha(BLURPLE, 0.28), backgroundColor: alpha(BLURPLE, dark ? 0.07 : 0.05) }]}>
      <View style={styles.header}>
        <View style={[styles.logo, { backgroundColor: alpha(BLURPLE, 0.15) }]}>
          <Icon icon={faDiscord} size={16} color={BLURPLE} />
        </View>
        <Text size="sm" weight="semibold" style={{ flex: 1 }}>
          {`Send to Discord${required ? ' · required' : ''}`}
        </Text>
        {canConfigure ? (
          <Switch
            value={enabled}
            onValueChange={toggle}
            trackColor={{ false: theme.surfaceMuted, true: BLURPLE }}
            thumbColor="#fff"
            accessibilityLabel="Send to Discord for this task"
          />
        ) : null}
      </View>

      {enabled ? (
        <Animated.View entering={revealIn} style={{ gap: 10 }}>
          {/* Channel + requirement */}
          <View style={styles.settingRow}>
            <Text size="xs" color="muted" style={{ flex: 1 }}>
              Channel
            </Text>
            <PressableScale
              disabled={!canConfigure}
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Discord channel: ${channelName ?? 'unknown'}${canConfigure ? '. Change' : ''}`}
              style={[styles.channelChip, { borderColor: alpha(BLURPLE, 0.28), backgroundColor: alpha(BLURPLE, 0.1) }]}>
              {channelName ? (
                <Text size="xs" weight="semibold" color={BLURPLE} numberOfLines={1} style={{ flexShrink: 1 }}>
                  {`#${channelName}`}
                </Text>
              ) : channelsLoading ? (
                <Pulse style={{ width: 70, height: 10, borderRadius: 5, backgroundColor: alpha(BLURPLE, 0.2) }} />
              ) : (
                <Text size="xs" weight="semibold" color={BLURPLE}>
                  Linked channel
                </Text>
              )}
              {canConfigure ? <Icon icon={faChevronDown} size={9} color={BLURPLE} /> : null}
            </PressableScale>
          </View>
          {canEditFields ? (
            <View style={styles.settingRow}>
              <Text size="xs" color="muted" style={{ flex: 1 }}>
                Require a submission before marking done
              </Text>
              <Switch
                value={!!required}
                onValueChange={onSetRequired}
                trackColor={{ false: theme.surfaceMuted, true: BLURPLE }}
                thumbColor="#fff"
                accessibilityLabel="Require a Discord submission before marking done"
              />
            </View>
          ) : null}

          {/* Delivered files — these persist (they come from the task's attachments). */}
          {sent.map((a) => (
            <Animated.View
              key={a.id}
              entering={revealIn}
              layout={listLayout}
              style={[styles.fileRow, { backgroundColor: alpha(GREEN, dark ? 0.1 : 0.07), borderColor: alpha(GREEN, 0.25) }]}>
              <View style={[styles.fileIcon, { backgroundColor: alpha(GREEN, 0.18) }]}>
                <Icon icon={faCheck} size={11} color={GREEN} />
              </View>
              <PressableScale
                style={{ flex: 1, minWidth: 0 }}
                accessibilityRole="link"
                accessibilityLabel={`${a.fileName} sent to Discord. Open in Discord`}
                onPress={() => Linking.openURL(a.url).catch(() => {})}>
                <Text size="sm" numberOfLines={1}>
                  <Text size="sm" weight="semibold">
                    {a.fileName}
                  </Text>
                  <Text size="sm" color="muted">
                    {' sent to Discord'}
                  </Text>
                </Text>
                <Text size="11" color="muted">
                  {`${timeAgo(a.discordDeliveredAt ?? a.createdAt)}${channelName ? ` · #${channelName}` : ''}`}
                </Text>
              </PressableScale>
              {a.uploadedBy === userId || isOwner ? (
                <PressableScale
                  hitSlop={8}
                  accessibilityLabel={`Remove ${a.fileName} from this task`}
                  onPress={() =>
                    Alert.alert(
                      'Remove from this task?',
                      `"${a.fileName}" stays in Discord; it's only removed from the task's list.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => onDelete(a.id) },
                      ],
                    )
                  }>
                  <Icon icon={faTrashCan} size={12} color="muted" />
                </PressableScale>
              ) : null}
            </Animated.View>
          ))}

          {/* In flight / failed */}
          {sending.map((s) => (
            <Animated.View
              key={s.id}
              entering={revealIn}
              layout={listLayout}
              style={[
                styles.fileRow,
                styles.sendingRow,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: s.phase === 'error' ? alpha(RED, 0.35) : theme.borderSubtle,
                },
              ]}>
              <View style={styles.sendingHead}>
                <Icon
                  icon={s.phase === 'error' ? faCircleExclamation : faPaperclip}
                  size={12}
                  color={s.phase === 'error' ? RED : 'muted'}
                />
                <Text size="sm" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                  {s.name}
                </Text>
                {s.phase === 'error' ? (
                  <>
                    <PressableScale hitSlop={8} accessibilityLabel={`Retry ${s.name}`} onPress={() => void send(s)}>
                      <Icon icon={faRotateRight} size={12} color={BLURPLE} />
                    </PressableScale>
                    <PressableScale
                      hitSlop={8}
                      accessibilityLabel={`Dismiss ${s.name}`}
                      onPress={() => setSending((prev) => prev.filter((x) => x.id !== s.id))}>
                      <Icon icon={faXmark} size={13} color="muted" />
                    </PressableScale>
                  </>
                ) : (
                  <Text size="11" color="muted" tabular>
                    {s.phase === 'uploading' ? `${Math.round(s.progress * 100)}%` : 'Posting…'}
                  </Text>
                )}
              </View>
              {s.phase === 'error' ? (
                <Text size="11" color={RED}>
                  {s.message}
                </Text>
              ) : (
                <>
                  <ProgressBar progress={s.phase === 'uploading' ? s.progress : null} />
                  <Text size="11" color="muted">
                    {s.phase === 'uploading' ? 'Uploading…' : `Posting to ${channelName ? `#${channelName}` : 'Discord'}…`}
                  </Text>
                </>
              )}
            </Animated.View>
          ))}

          {canSubmit ? (
            <PressableScale
              onPress={() => void pick()}
              scaleTo={0.98}
              haptic="tap"
              accessibilityRole="button"
              accessibilityLabel="Attach a file to send to Discord"
              style={[styles.attach, { backgroundColor: BLURPLE }]}>
              <Icon icon={faPaperclip} size={13} color="#fff" />
              <Text size="sm" weight="semibold" color="#fff">
                {busy || sent.length ? 'Attach another file' : 'Attach a file'}
              </Text>
            </PressableScale>
          ) : null}
        </Animated.View>
      ) : canConfigure ? (
        <Text size="xs" color="muted">
          {"Turn on to have this task's work handed in as a file to a Discord channel."}
        </Text>
      ) : null}

      <MenuSheet<string>
        visible={pickerOpen}
        title="Discord channel"
        value={channelId ?? undefined}
        options={channels.map((c) => ({ value: c.id, label: `#${c.name}` }))}
        onSelect={(id) => {
          setPickerOpen(false);
          if (id !== channelId) onSetChannel(id);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </Animated.View>
  );
}

/** Determinate bar for the upload (follows real progress); an indeterminate sweep while Discord is posted to. */
function ProgressBar({ progress }: { progress: number | null }) {
  const width = useSharedValue(progress ?? 0);
  const sweep = useSharedValue(0);
  const indeterminate = progress === null;

  useEffect(() => {
    if (progress !== null) width.value = withTiming(progress, { duration: 180, easing: Easing.out(Easing.quad) });
  }, [progress, width]);

  useEffect(() => {
    if (!indeterminate) return;
    sweep.value = 0;
    sweep.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(sweep);
  }, [indeterminate, sweep]);

  const fill = useAnimatedStyle(() =>
    indeterminate
      ? { width: '35%', left: `${-35 + sweep.value * 135}%` }
      : { width: `${width.value * 100}%`, left: '0%' },
  );

  return (
    <View style={[styles.track, { backgroundColor: alpha(BLURPLE, 0.14) }]}>
      <Animated.View style={[styles.fill, { backgroundColor: BLURPLE }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xxl, borderWidth: 1, padding: 14, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  channelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 190,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  fileIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sendingRow: { flexDirection: 'column', alignItems: 'stretch', gap: 6 },
  sendingHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3 },
  attach: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.full,
    paddingVertical: 11,
  },
});
