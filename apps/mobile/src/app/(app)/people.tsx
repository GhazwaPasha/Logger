import { UserMinusIcon, UserPlusIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { Page, Panel, Segmented } from '@/components/page';
import { StackHeader } from '@/components/shell/screen-header';
import { Text } from '@/components/text';
import { Avatar, Button, Chip, ErrorBanner, IconButton, Input } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { NODE_LABELS } from '@/lib/labels';
import { isWorkspaceOwner } from '@/lib/permissions';
import { useInviteMember, useRemoveMember, type InviteRole } from '@/lib/queries';
import { useWorkspace } from '@/lib/workspace';

const ROLES: { value: InviteRole; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'manager', label: 'Manager' },
  { value: 'owner', label: 'Owner' },
];

/** Team — everyone in the workspace with their role. Owners can invite people by email and remove anyone but themselves. */
export default function PeopleScreen() {
  const theme = useTheme();
  const { org, members, depts, userId } = useWorkspace();
  const remove = useRemoveMember(org?.id);
  const isOwner = isWorkspaceOwner(members, userId);
  const deptName = (id: string | null) => depts.find((d) => d.id === id)?.name;

  // Role pills on the web's tokens: owner violet, manager blue, member neutral.
  const roleColors = {
    owner: { bg: theme.statusProgressBg, fg: theme.statusProgressInk },
    manager: { bg: theme.infoBg, fg: theme.infoInk },
    member: { bg: theme.fill2, fg: theme.ink2 },
  } as const;

  function confirmRemove(memberId: string, name: string) {
    Alert.alert(`Remove ${name}?`, 'They lose access to this workspace and their tasks go back to unassigned. Their comments and history stay.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(memberId) },
    ]);
  }

  return (
    <Page header={<StackHeader title="Team" />} gap={12}>
      {isOwner ? <InviteCard /> : null}

      {remove.error ? <ErrorBanner message={remove.error.message} /> : null}
      <Panel style={{ padding: 0 }}>
        {members.map((m, i) => {
          const tone = roleColors[m.role as keyof typeof roleColors] ?? roleColors.member;
          const managed = (m.managedDepartmentIds ?? []).map(deptName).filter(Boolean).join(', ');
          return (
            <View
              key={m.userId}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: theme.line }]}>
              <Avatar name={m.name} email={m.email} image={m.image} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" weight="semibold" numberOfLines={1}>
                  {m.name || m.email}
                </Text>
                <Text size="xs" color="muted" numberOfLines={1}>
                  {m.email}
                </Text>
                {m.role === 'manager' && managed ? (
                  <Text size="xs" color="muted" numberOfLines={1}>
                    Manages {managed}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.role, { backgroundColor: tone.bg }]}>
                <Text size="xs" weight="semibold" color={tone.fg}>
                  {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                </Text>
              </View>
              {isOwner && m.userId !== userId ? (
                <IconButton
                  icon={UserMinusIcon}
                  label={`Remove ${m.name || m.email}`}
                  iconSize={16}
                  size={36}
                  onPress={() => confirmRemove(m.userId, m.name || m.email)}
                />
              ) : null}
            </View>
          );
        })}
      </Panel>
    </Page>
  );
}

/**
 * Invite by email (the web Team page's card): email, role, and — for a manager — which departments they manage.
 * The person needs an existing account; inviting someone already in the workspace updates their role.
 */
function InviteCard() {
  const theme = useTheme();
  const { org, depts, members } = useWorkspace();
  const invite = useInviteMember(org?.id);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('member');
  const [deptIds, setDeptIds] = useState<Set<string>>(new Set());
  const [problem, setProblem] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const trimmed = email.trim();
  const already = members.some((m) => m.email.toLowerCase() === trimmed.toLowerCase());

  function toggleDept(id: string) {
    setDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (!trimmed) return;
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setProblem('Enter a valid email address.');
      return;
    }
    if (role === 'manager' && deptIds.size === 0) {
      setProblem(`Pick at least one ${NODE_LABELS.level.toLowerCase()} for a manager.`);
      return;
    }
    setProblem(null);
    setAdded(null);
    invite.mutate(
      { email: trimmed, role, departmentIds: [...deptIds] },
      {
        onSuccess: () => {
          setAdded(already ? `Updated ${trimmed}'s role` : `Added ${trimmed}`);
          setEmail('');
          setDeptIds(new Set());
        },
        onError: (e) => setProblem(e.message),
      },
    );
  }

  return (
    <Panel style={{ gap: 12 }}>
      <View style={styles.inviteHead}>
        <View style={[styles.inviteIcon, { backgroundColor: theme.fill2 }]}>
          <Icon icon={UserPlusIcon} size={16} color="fg" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text font="outfit" size="base" weight="semibold">
            Invite by email
          </Text>
          <Text size="xs" color="muted">
            They need a LogBase account already.
          </Text>
        </View>
      </View>

      <Input
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setProblem(null);
          setAdded(null);
        }}
        placeholder="colleague@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={submit}
        accessibilityLabel="Email"
      />

      <Segmented<InviteRole> value={role} onChange={setRole} options={ROLES} stretch />

      {role === 'manager' ? (
        <Animated.View entering={FadeIn.duration(180)} style={{ gap: 8 }}>
          <Text size="xs" weight="semibold" color="muted">
            {`${NODE_LABELS.levelPlural} they manage`}
          </Text>
          {depts.length ? (
            <View style={styles.chips}>
              {depts.map((d) => (
                <Chip key={d.id} label={d.name} selected={deptIds.has(d.id)} onPress={() => toggleDept(d.id)} />
              ))}
            </View>
          ) : (
            <Text size="sm" color="muted">
              {`No ${NODE_LABELS.levelPlural.toLowerCase()} yet.`}
            </Text>
          )}
        </Animated.View>
      ) : null}

      {problem ? (
        <Text size="13" color={theme.danger}>
          {problem}
        </Text>
      ) : added ? (
        <Text size="13" color={theme.success}>
          {added}
        </Text>
      ) : null}

      <Button
        title={already ? 'Update role' : 'Invite'}
        icon={UserPlusIcon}
        onPress={submit}
        loading={invite.isPending}
        disabled={!trimmed}
        haptic="tap"
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  role: { paddingHorizontal: 10, height: 24, justifyContent: 'center', borderRadius: Radius.full },
  inviteHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inviteIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
