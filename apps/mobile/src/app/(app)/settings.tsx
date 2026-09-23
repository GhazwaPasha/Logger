import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { Page, Panel, SectionLabel, Segmented } from '@/components/page';
import { StackHeader } from '@/components/shell/screen-header';
import { Text } from '@/components/text';
import { Avatar, Button } from '@/components/ui';
import { useThemePreference, useTheme, type ThemePreference } from '@/hooks/use-theme';
import { clearTokenCache } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { API_URL } from '@/lib/config';
import { queryClient } from '@/lib/query-client';
import { useWorkspace } from '@/lib/workspace';

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderTopColor: theme.borderSubtle }]}>
      <Text size="sm" color="muted">
        {label}
      </Text>
      <Text size="sm" style={{ flexShrink: 1, textAlign: 'right' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Your settings — profile, appearance, session. */
export default function SettingsScreen() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const { org, me } = useWorkspace();
  const [pref, setPref] = useThemePreference();

  async function signOut() {
    clearTokenCache();
    queryClient.clear();
    await authClient.signOut();
  }

  return (
    <Page header={<StackHeader title="Your settings" />} gap={16}>

      <Panel style={{ gap: 12 }}>
        <SectionLabel>Profile</SectionLabel>
        <View style={styles.profile}>
          <Avatar name={user?.name} email={user?.email} image={user?.image} size={48} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size="base" weight="semibold" numberOfLines={1}>
              {user?.name || '—'}
            </Text>
            <Text font="mono" size="xs" color="muted" numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
        </View>
        {org ? <Row label="Workspace" value={org.name} /> : null}
        {me ? <Row label="Role" value={me.role.charAt(0).toUpperCase() + me.role.slice(1)} /> : null}
      </Panel>

      <Panel style={{ gap: 10 }}>
        <SectionLabel>Appearance</SectionLabel>
        <Segmented<ThemePreference>
          value={pref}
          onChange={setPref}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Panel>

      <Panel>
        <SectionLabel>About</SectionLabel>
        <Row label="Version" value={Constants.expoConfig?.version ?? '—'} />
        <Row label="Server" value={API_URL.replace(/^https?:\/\//, '')} />
      </Panel>

      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </Page>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    marginTop: 4,
  },
});
