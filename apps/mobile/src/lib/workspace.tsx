import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { authClient } from '@/lib/auth-client';
import { useOrgs, useWorkspaceBootstrap } from '@/lib/queries';
import type { Dept, ListRow, MemberRow, Org } from '@/lib/types';

const ORG_KEY = 'logbase.orgId';
const scopeKey = (orgId: string) => `logbase.scope.${orgId}`;

/** Board scope: the channel the work board shows (and the category it sits in) — never "everything". */
export type BoardScope = { levelId: string | null; listId: string | null };

type WorkspaceValue = {
  orgs: Org[];
  org: Org | null;
  setOrgId: (id: string) => void;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;

  depts: Dept[];
  lists: ListRow[];
  members: MemberRow[];
  /** The signed-in user's id (from the Better Auth session). */
  userId: string | null;
  /** Their membership row in this workspace. */
  me: MemberRow | null;

  scope: BoardScope;
  level: Dept | null;
  list: ListRow | null;
  /** Open a channel on the board. Channels are the only board destination; categories just group them. */
  setList: (listId: string) => void;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

const byOrder = <T extends { orderIndex: number }>(rows: T[]) => [...rows].sort((a, b) => a.orderIndex - b.orderIndex);

/**
 * Channels are the only board destination. Honour the stored channel while it still exists; otherwise land on
 * the first channel of the first category that has one.
 */
function resolveScope(raw: BoardScope | null, depts: Dept[], lists: ListRow[]): BoardScope {
  const kept = raw?.listId ? lists.find((l) => l.id === raw.listId) : undefined;
  if (kept) return { levelId: kept.departmentId, listId: kept.id };
  for (const d of depts) {
    const first = lists.filter((l) => l.departmentId === d.id).sort((x, y) => x.orderIndex - y.orderIndex)[0];
    if (first) return { levelId: d.id, listId: first.id };
  }
  return { levelId: depts[0]?.id ?? null, listId: null };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const orgsQuery = useOrgs();
  const [storedOrgId, setStoredOrgId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(ORG_KEY)
      .then(setStoredOrgId)
      .catch(() => {})
      .finally(() => setRestored(true));
  }, []);

  const orgs = useMemo(() => orgsQuery.data ?? [], [orgsQuery.data]);
  const org = orgs.find((o) => o.id === storedOrgId) ?? orgs[0] ?? null;

  const orgId = org?.id;
  const bootstrap = useWorkspaceBootstrap(orgId);
  const depts = useMemo(() => byOrder(bootstrap.data?.departments ?? []), [bootstrap.data?.departments]);
  const lists = useMemo(() => bootstrap.data?.lists ?? [], [bootstrap.data?.lists]);
  const members = useMemo(() => bootstrap.data?.members ?? [], [bootstrap.data?.members]);

  // Persisted scope per workspace, resolved so it always lands on a real category.
  const [stored, setStored] = useState<{ orgId: string; scope: BoardScope } | null>(null);
  useEffect(() => {
    if (!orgId) return;
    let live = true;
    SecureStore.getItemAsync(scopeKey(orgId))
      .then((raw) => {
        if (!live) return;
        try {
          setStored({ orgId, scope: raw ? (JSON.parse(raw) as BoardScope) : { levelId: null, listId: null } });
        } catch {
          setStored({ orgId, scope: { levelId: null, listId: null } });
        }
      })
      .catch(() => live && setStored({ orgId, scope: { levelId: null, listId: null } }));
    return () => {
      live = false;
    };
  }, [orgId]);

  const scope = useMemo<BoardScope>(
    () => resolveScope(stored && stored.orgId === orgId ? stored.scope : null, depts, lists),
    [stored, orgId, depts, lists],
  );

  const setList = useCallback(
    (listId: string) => {
      if (!orgId) return;
      // The category is derived from the channel when the scope resolves, so only the channel is stored.
      const next: BoardScope = { levelId: null, listId };
      setStored({ orgId, scope: next });
      SecureStore.setItemAsync(scopeKey(orgId), JSON.stringify(next)).catch(() => {});
    },
    [orgId],
  );

  const setOrgId = useCallback((id: string) => {
    setStoredOrgId(id);
    SecureStore.setItemAsync(ORG_KEY, id).catch(() => {});
  }, []);

  const userId = session?.user.id ?? null;

  const value = useMemo<WorkspaceValue>(
    () => ({
      orgs,
      org,
      setOrgId,
      isLoading: orgsQuery.isLoading || !restored || (!!org && bootstrap.isLoading),
      error: (orgsQuery.error ?? bootstrap.error) as Error | null,
      refetch: () => {
        void orgsQuery.refetch();
        void bootstrap.refetch();
      },
      depts,
      lists,
      members,
      userId,
      me: members.find((m) => m.userId === userId) ?? null,
      scope,
      level: depts.find((d) => d.id === scope.levelId) ?? null,
      list: lists.find((l) => l.id === scope.listId) ?? null,
      setList,
    }),
    [orgs, org, setOrgId, orgsQuery, restored, bootstrap, depts, lists, members, userId, scope, setList],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return ctx;
}
