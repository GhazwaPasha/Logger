import { StyleSheet, View } from 'react-native';

import { Page, Panel } from '@/components/page';
import { StackHeader } from '@/components/shell/screen-header';
import { Text } from '@/components/text';
import { Avatar } from '@/components/ui';
import { alpha, Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/lib/workspace';

const ROLE_TONE = { owner: Tone.violet500, manager: Tone.sky500, member: Tone.slate500 } as const;

/** Team — everyone in the workspace with their role. */
export default function PeopleScreen() {
  const theme = useTheme();
  const dark = useIsDark();
  const { members, depts } = useWorkspace();
  const deptName = (id: string | null) => depts.find((d) => d.id === id)?.name;

  return (
    <Page header={<StackHeader title="Team" />} gap={12}>
      <Panel style={{ padding: 0 }}>
        {members.map((m, i) => {
          const tone = ROLE_TONE[m.role as keyof typeof ROLE_TONE] ?? Tone.slate500;
          const managed = (m.managedDepartmentIds ?? []).map(deptName).filter(Boolean).join(', ');
          return (
            <View
              key={m.userId}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: theme.borderSubtle }]}>
              <Avatar name={m.name} email={m.email} image={m.image} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" weight="semibold" numberOfLines={1}>
                  {m.name || m.email}
                </Text>
                <Text font="mono" size="11" color="muted" numberOfLines={1}>
                  {m.email}
                </Text>
                {m.role === 'manager' && managed ? (
                  <Text size="11" color="muted" numberOfLines={1}>
                    Manages {managed}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.role, { backgroundColor: alpha(tone, dark ? 0.15 : 0.22) }]}>
                <Text size="11" weight="semibold">
                  {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                </Text>
              </View>
            </View>
          );
        })}
      </Panel>
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  role: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.base },
});
