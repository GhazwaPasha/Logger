import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { apiFetch, apiJson } from "./src/api";
import { authClient } from "./src/auth-client";
import { enqueueOutbox, listOutbox, removeOutbox } from "./src/outbox";

type Org = { id: string; name: string };
type TaskRow = {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
  dueRepeat?: string | null;
};

function formatDueCompact(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

async function flushOutbox(token: string) {
  const rows = listOutbox();
  for (const row of rows) {
    try {
      const res = await apiFetch(row.endpoint, {
        method: "POST",
        token,
        body: row.body,
      });
      if (res.ok) {
        removeOutbox(row.id);
      }
    } catch {
      /* offline */
    }
  }
}

const logoLight = require("./assets/logbase-light.png");
const logoDark = require("./assets/logbase-dark.png");

export default function App() {
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [sheetTask, setSheetTask] = useState<TaskRow | null>(null);
  const [logJson, setLogJson] = useState('{"message":"Field note"}');
  const [err, setErr] = useState<string | null>(null);

  const org = useMemo(() => orgs.find((o) => o.id === orgId) ?? null, [orgs, orgId]);

  const refreshToken = useCallback(async () => {
    const { data, error } = await authClient.token();
    if (error || !data?.token) {
      setToken(null);
      return;
    }
    setToken(data.token);
  }, []);

  const loadOrgs = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const o = await apiJson<Org[]>("/organizations", { token });
      setOrgs(o);
      setOrgId((prev) => {
        if (prev && o.some((x) => x.id === prev)) return prev;
        return o[0]?.id ?? null;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load orgs failed");
    }
  }, [token]);

  const loadTasks = useCallback(async () => {
    if (!token || !orgId) {
      setTasks([]);
      return;
    }
    setErr(null);
    try {
      const t = await apiJson<TaskRow[]>(`/organizations/${orgId}/tasks`, { token });
      setTasks(t);
      await flushOutbox(token);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load tasks failed");
    }
  }, [token, orgId]);

  useEffect(() => {
    void refreshToken();
  }, [refreshToken]);

  useEffect(() => {
    if (token) void loadOrgs();
  }, [token, loadOrgs]);

  useEffect(() => {
    if (token && orgId) void loadTasks();
  }, [token, orgId, loadTasks]);

  useEffect(() => {
    if (!token) return;
    const t = setInterval(() => {
      void flushOutbox(token);
    }, 15000);
    return () => clearInterval(t);
  }, [token]);

  async function signIn() {
    setBusy(true);
    setErr(null);
    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        setErr(error.message ?? "Sign in failed");
        return;
      }
      await refreshToken();
    } finally {
      setBusy(false);
    }
  }

  async function submitLog() {
    if (!token || !sheetTask) return;
    setErr(null);
    const clientMutationId = `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(logJson) as Record<string, unknown>;
    } catch {
      setErr("Payload must be JSON");
      return;
    }
    const body = JSON.stringify({
      type: "note",
      payload,
      clientMutationId,
    });
    const endpoint = `/tasks/${sheetTask.id}/ledger`;
    try {
      const res = await apiFetch(endpoint, { method: "POST", token, body });
      if (!res.ok) throw new Error(await res.text());
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSheetTask(null);
      await loadTasks();
    } catch {
      enqueueOutbox(clientMutationId, endpoint, JSON.parse(body) as object);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setErr("Queued offline — will sync when API is reachable.");
      setSheetTask(null);
    }
  }

  if (!token) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.screen}
      >
        <StatusBar style="dark" />
        <View style={styles.brandRow}>
          <Image
            source={colorScheme === "dark" ? logoDark : logoLight}
            style={styles.brandMark}
            resizeMode="contain"
            accessible={false}
          />
          <Text style={styles.title}>LogBase</Text>
        </View>
        <Text style={styles.hint}>Sign in (same account as web)</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {err ? <Text style={styles.error}>{err}</Text> : null}
        <Pressable style={styles.primaryBtn} onPress={signIn} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign in</Text>}
        </Pressable>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Chronicle</Text>
        <Pressable onPress={() => authClient.signOut().then(() => setToken(null))}>
          <Text style={styles.link}>Out</Text>
        </Pressable>
      </View>
      {org ? (
        <Text style={styles.sub}>{org.name}</Text>
      ) : (
        <Text style={styles.sub}>No organization</Text>
      )}
      {err ? <Text style={styles.error}>{err}</Text> : null}
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 8 }}
        refreshing={busy}
        onRefresh={() => {
          setBusy(true);
          Promise.all([loadOrgs(), loadTasks()]).finally(() => setBusy(false));
        }}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => setSheetTask(item)}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowMeta}>
              {item.status}
              {item.dueAt ? ` · ${formatDueCompact(item.dueAt)}` : ""}
            </Text>
          </Pressable>
        )}
      />
      <Modal visible={!!sheetTask} transparent animationType="slide">
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{sheetTask?.title}</Text>
            <Text style={styles.hint}>Ledger entry (JSON payload)</Text>
            <TextInput
              style={[styles.input, styles.mono]}
              multiline
              value={logJson}
              onChangeText={setLogJson}
            />
            <View style={styles.sheetActions}>
              <Pressable style={styles.secondaryBtn} onPress={() => setSheetTask(null)}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={submitLog}>
                <Text style={styles.primaryBtnText}>Submit log</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fafafa", padding: 16, paddingTop: 48 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  brandMark: { width: 32, height: 32 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "600" },
  sub: { fontSize: 14, color: "#666", marginTop: 4 },
  hint: { fontSize: 13, color: "#888", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  mono: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", minHeight: 100 },
  primaryBtn: {
    backgroundColor: "#007AFF",
    padding: 14,
    alignItems: "center",
    borderRadius: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "600" },
  secondaryBtn: { padding: 14, borderRadius: 8, borderWidth: 1, borderColor: "#ddd" },
  link: { color: "#007AFF", fontSize: 16 },
  error: { color: "#b00020", marginBottom: 8, fontSize: 13 },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
  },
  rowTitle: { fontSize: 16 },
  rowMeta: { fontSize: 12, color: "#666", marginTop: 4 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  sheetActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 12 },
});
