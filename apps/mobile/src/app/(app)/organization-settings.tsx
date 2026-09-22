import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { MenuSheet } from '@/components/menu-sheet';
import { Page, PageTitle, Panel, SectionLabel } from '@/components/page';
import { Text } from '@/components/text';
import { Button, ErrorBanner, Input } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useUpdateOrganization } from '@/lib/queries';
import { isWorkspaceOwner } from '@/lib/permissions';
import { useWorkspace } from '@/lib/workspace';

const ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Istanbul',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

/** Organization settings — rename the workspace and set its time zone (owners only). */
export default function OrganizationSettingsScreen() {
  const theme = useTheme();
  const { org, members, userId } = useWorkspace();
  const update = useUpdateOrganization(org?.id);
  const isOwner = isWorkspaceOwner(members, userId);

  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? org?.name ?? '';
  const [zoneOpen, setZoneOpen] = useState(false);

  const zones = Array.from(new Set([org?.timeZone ?? 'UTC', ...ZONES])).map((z) => ({ value: z, label: z }));
  const dirty = !!org && name.trim() !== org.name && name.trim().length > 0;

  return (
    <Page gap={16}>
      <PageTitle>Organization settings</PageTitle>
      {!isOwner ? (
        <Text size="sm" color="muted">
          Only workspace owners can change these settings.
        </Text>
      ) : null}
      {update.error ? <ErrorBanner message={update.error.message} /> : null}

      <Panel style={{ gap: 10 }}>
        <SectionLabel>Workspace name</SectionLabel>
        <Input value={name} onChangeText={setDraft} editable={isOwner} maxLength={256} />
        {isOwner ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              title="Save name"
              loading={update.isPending}
              disabled={!dirty}
              onPress={() => update.mutate({ name: name.trim() }, { onSuccess: () => setDraft(null) })}
            />
          </View>
        ) : null}
      </Panel>

      <Panel style={{ gap: 10 }}>
        <SectionLabel>Time zone</SectionLabel>
        <Text size="sm" color="muted">
          Due dates and activity timestamps are shown in this zone.
        </Text>
        <PressableScale scaleTo={0.985}
          accessibilityRole="button"
          disabled={!isOwner}
          onPress={() => setZoneOpen(true)}
          style={[styles.select, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text size="sm">{org?.timeZone ?? '—'}</Text>
        </PressableScale>
      </Panel>

      <MenuSheet<string>
        visible={zoneOpen}
        title="Time zone"
        value={org?.timeZone}
        options={zones}
        onSelect={(timeZone) => update.mutate({ timeZone })}
        onClose={() => setZoneOpen(false)}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  select: { minHeight: 44, borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
});
