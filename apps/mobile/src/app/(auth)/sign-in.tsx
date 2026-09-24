import { faDiscord, faGoogle } from '@fortawesome/free-brands-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faArrowLeft, faEnvelope, faEye, faEyeSlash, faLock } from '@fortawesome/free-solid-svg-icons';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectingStep } from '@/components/auth/connecting-step';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { LogoMark } from '@/components/logo-mark';
import { BarSurface } from '@/components/shell/tab-bar/bar-surface';
import { Text } from '@/components/text';
import { Button, ErrorBanner } from '@/components/ui';
import { sequenceEnter, stateTransition } from '@/constants/motion';
import { alpha, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';
import { clearForcedSignOut } from '@/lib/sign-out';
import { nativeGoogleSignIn, pickGoogleIdToken } from '@/lib/google-sign-in';

type Provider = 'discord' | 'google';

/** Provider tints from `LoginForm.tsx`: 30% border, 8% fill, brand-coloured icon. */
const PROVIDERS = {
  discord: { label: 'Discord', icon: faDiscord, color: '#5865F2' },
  google: { label: 'Google', icon: faGoogle, color: '#4285F4' },
} as const;

/** Big icon + wordmark lockup (`BigLogo`). */
function BigLogo({ size, text }: { size: number; text: number }) {
  return (
    <View style={styles.logo}>
      <LogoMark size={size} />
      <Text font="outfit" weight="bold" tracking={-text * 0.03} style={{ fontSize: text, lineHeight: text * 1.15 }}>
        LogBase
      </Text>
    </View>
  );
}

/** A rounded field row: leading icon, the input, an optional trailing control; the border lights up on focus. */
function Field({ label, icon, focused, children }: { label: string; icon: IconDefinition; focused: boolean; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text size="11" weight="semibold" color="muted" uppercase tracking={0.8} style={{ paddingLeft: 4 }}>
        {label}
      </Text>
      <View
        style={[
          styles.field,
          { backgroundColor: theme.surfaceElevated, borderColor: focused ? theme.accent : theme.borderSubtle },
          stateTransition,
        ]}>
        <Icon icon={icon} size={15} color={focused ? 'fg' : 'muted'} />
        {children}
      </View>
    </View>
  );
}

export default function SignIn() {
  const theme = useTheme();
  const [step, setStep] = useState<'hub' | 'email'>('hub');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focus, setFocus] = useState<'email' | 'password' | null>(null);
  const [busy, setBusy] = useState<'email' | Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** `action` resolves to null when the user backed out (closed the account picker / auth sheet). */
  async function run(kind: NonNullable<typeof busy>, action: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    let signedIn = false;
    try {
      const result = (await action()) as { data?: unknown; error?: { message?: string } | null } | null;
      if (result?.error) setError(result.error.message || 'Sign in failed');
      else signedIn = !!result?.data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Can't reach the server.");
    } finally {
      // Signed in: stay on the connecting state until the app swaps this screen out, instead of flashing the
      // options back for a moment.
      if (signedIn) clearForcedSignOut();
      else setBusy(null);
    }
  }

  const signInEmail = () => run('email', () => authClient.signIn.email({ email: email.trim(), password }));
  const signInSocial = (provider: Provider) =>
    run(provider, async () => {
      // Google: the native account picker, then the ID token straight to the auth server.
      if (provider === 'google' && nativeGoogleSignIn) {
        const token = await pickGoogleIdToken();
        if (!token) return null;
        return authClient.signIn.social({ provider, idToken: { token }, callbackURL: '/' });
      }
      // Discord has no native sign-in for third-party apps (it won't hand OAuth logins to its app), so it runs
      // in an in-app auth sheet (Custom Tabs / ASWebAuthenticationSession) that returns here via `logbase://`.
      // It resolves the same way whether the sheet was completed or closed, so ask for the session to tell.
      const res = await authClient.signIn.social({ provider, callbackURL: '/' });
      if (res.error) return res;
      const session = await authClient.getSession();
      return session.data ? session : null;
    });

  return (
    <View style={[styles.fill, { backgroundColor: theme.surfaceBase }]}>
      <SafeAreaView style={styles.fill}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {busy === 'discord' || busy === 'google' ? (
              <ConnectingStep {...PROVIDERS[busy]} />
            ) : step === 'hub' ? (
              <View style={styles.hub}>
                <Animated.View entering={sequenceEnter(0, 12)}>
                  <BigLogo size={64} text={36} />
                </Animated.View>
                <View style={styles.buttons}>
                  {(Object.keys(PROVIDERS) as Provider[]).map((p, i) => {
                    const meta = PROVIDERS[p];
                    return (
                      // Entrance and press-scale can't share one node (see the KPI cards comment in
                      // dashboard.tsx), so the keyframe lives on this wrapper.
                      <Animated.View key={p} entering={sequenceEnter(i + 1, 12)}>
                        <PressableScale
                          accessibilityRole="button"
                          scaleTo={0.98}
                          disabled={busy !== null}
                          onPress={() => signInSocial(p)}
                          style={({ pressed }) => [
                            styles.hubButton,
                            {
                              borderColor: alpha(meta.color, 0.3),
                              backgroundColor: alpha(meta.color, pressed ? 0.14 : 0.08),
                            },
                          ]}>
                          <Icon icon={meta.icon} size={20} color={meta.color} />
                          <Text size="base" weight="medium">
                            {`Continue with ${meta.label}`}
                          </Text>
                        </PressableScale>
                      </Animated.View>
                    );
                  })}
                  <Animated.View entering={sequenceEnter(3, 12)}>
                    <PressableScale
                      accessibilityRole="button"
                      scaleTo={0.98}
                      disabled={busy !== null}
                      onPress={() => {
                        setError(null);
                        setStep('email');
                      }}
                      style={({ pressed }) => [
                        styles.hubButton,
                        {
                          borderColor: theme.borderSubtle,
                          backgroundColor: pressed ? theme.surfaceHover : theme.surfaceBase,
                        },
                      ]}>
                      <Icon icon={faEnvelope} size={20} color={theme.accent} />
                      <Text size="base" weight="medium">
                        Continue with Email
                      </Text>
                    </PressableScale>
                  </Animated.View>
                </View>
                {error ? (
                  <View style={{ width: '100%', maxWidth: 384 }}>
                    <ErrorBanner message={error} />
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.emailWrap}>
                <Animated.View entering={sequenceEnter(0, 12)} style={styles.backPill}>
                  <BarSurface radius={22} />
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    scaleTo={0.96}
                    haptic="select"
                    hitSlop={8}
                    onPress={() => {
                      setError(null);
                      setStep('hub');
                    }}
                    style={styles.backInner}>
                    <Icon icon={faArrowLeft} size={13} color="fg" />
                    <Text size="sm" weight="medium">
                      Back
                    </Text>
                  </PressableScale>
                </Animated.View>

                <Animated.View entering={sequenceEnter(1, 12)} style={{ alignItems: 'center' }}>
                  <BigLogo size={44} text={28} />
                </Animated.View>

                <Animated.View
                  entering={sequenceEnter(2, 12)}
                  style={styles.form}>
                  <View style={{ gap: 2 }}>
                    <Text font="outfit" size="xl" weight="bold" tracking={-0.4}>
                      Welcome back
                    </Text>
                    <Text size="sm" color="muted">
                      Sign in with your email to continue
                    </Text>
                  </View>

                  <View style={{ gap: 14 }}>
                    <Field label="Email" icon={faEnvelope} focused={focus === 'email'}>
                      <TextInput
                        style={[styles.fieldInput, { color: theme.fg }]}
                        placeholder="you@company.com"
                        placeholderTextColor={theme.muted}
                        cursorColor={theme.accent}
                        value={email}
                        onChangeText={setEmail}
                        onFocus={() => setFocus('email')}
                        onBlur={() => setFocus(null)}
                        autoCapitalize="none"
                        autoComplete="email"
                        autoCorrect={false}
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        returnKeyType="next"
                      />
                    </Field>
                    <Field label="Password" icon={faLock} focused={focus === 'password'}>
                      <TextInput
                        style={[styles.fieldInput, { color: theme.fg }]}
                        placeholder="Your password"
                        placeholderTextColor={theme.muted}
                        cursorColor={theme.accent}
                        value={password}
                        onChangeText={setPassword}
                        onFocus={() => setFocus('password')}
                        onBlur={() => setFocus(null)}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoComplete="current-password"
                        textContentType="password"
                        returnKeyType="go"
                        onSubmitEditing={signInEmail}
                      />
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                        onPress={() => setShowPassword((v) => !v)}
                        hitSlop={10}>
                        <Icon icon={showPassword ? faEyeSlash : faEye} size={15} color="muted" />
                      </PressableScale>
                    </Field>
                  </View>

                  {error ? <ErrorBanner message={error} /> : null}

                  <Button
                    title="Sign in"
                    onPress={signInEmail}
                    loading={busy === 'email'}
                    disabled={!email.trim() || !password || busy !== null}
                    style={styles.submit}
                  />
                </Animated.View>
              </View>
            )}
          </ScrollView>

          <Text font="mono" size="xs" color="muted" uppercase tracking={2} style={styles.tagline}>
            LogBase · Organize · Track · Execute
          </Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16, paddingVertical: 40 },
  hub: { width: '100%', alignItems: 'center', gap: 40 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  buttons: { width: '100%', maxWidth: 384, gap: 14 },
  hubButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  emailWrap: { width: '100%', maxWidth: 400, gap: 24 },
  form: { gap: 24 },
  backPill: { alignSelf: 'flex-start', height: 44, borderRadius: 22 },
  backInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  field: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.xxxl,
    borderWidth: 1,
  },
  fieldInput: { flex: 1, height: '100%', fontSize: 15, padding: 0 },
  submit: { height: 52, borderRadius: Radius.xxxl },
  tagline: { textAlign: 'center', paddingBottom: 16 },
});
