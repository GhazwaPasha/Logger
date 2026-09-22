import { faDiscord, faGoogle } from '@fortawesome/free-brands-svg-icons';
import { faArrowLeft, faEnvelope, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { LogoMark } from '@/components/logo-mark';
import { Text } from '@/components/text';
import { Button, ErrorBanner, Input } from '@/components/ui';
import { sequenceEnter } from '@/constants/motion';
import { alpha, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';

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

function Label({ children }: { children: string }) {
  return (
    <Text size="xs" weight="medium" color="muted" style={{ marginBottom: 6 }}>
      {children}
    </Text>
  );
}

export default function SignIn() {
  const theme = useTheme();
  const [step, setStep] = useState<'hub' | 'email'>('hub');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<'email' | Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: NonNullable<typeof busy>, action: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    try {
      const { error: err } = (await action()) as { error?: { message?: string } | null };
      if (err) setError(err.message || 'Sign in failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Can't reach the server.");
    } finally {
      setBusy(null);
    }
  }

  const signInEmail = () => run('email', () => authClient.signIn.email({ email: email.trim(), password }));
  const signInSocial = (provider: Provider) => run(provider, () => authClient.signIn.social({ provider, callbackURL: '/' }));

  return (
    <View style={[styles.fill, { backgroundColor: theme.surfaceBase }]}>
      <SafeAreaView style={styles.fill}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {step === 'hub' ? (
              <View style={styles.hub}>
                <Animated.View entering={sequenceEnter(0, 12)}>
                  <BigLogo size={64} text={36} />
                </Animated.View>
                <View style={styles.buttons}>
                  {(Object.keys(PROVIDERS) as Provider[]).map((p, i) => {
                    const meta = PROVIDERS[p];
                    return (
                      <PressableScale
                        key={p}
                        accessibilityRole="button"
                        scaleTo={0.98}
                        entering={sequenceEnter(i + 1, 12)}
                        disabled={busy !== null}
                        onPress={() => signInSocial(p)}
                        style={({ pressed }) => [
                          styles.hubButton,
                          {
                            borderColor: alpha(meta.color, 0.3),
                            backgroundColor: alpha(meta.color, pressed ? 0.14 : 0.08),
                            opacity: busy !== null && busy !== p ? 0.6 : 1,
                          },
                        ]}>
                        <Icon icon={meta.icon} size={20} color={meta.color} />
                        <Text size="base" weight="medium">
                          {busy === p ? 'Connecting…' : `Continue with ${meta.label}`}
                        </Text>
                      </PressableScale>
                    );
                  })}
                  <PressableScale
                    accessibilityRole="button"
                    scaleTo={0.98}
                    entering={sequenceEnter(3, 12)}
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
                </View>
                {error ? (
                  <View style={{ width: '100%', maxWidth: 384 }}>
                    <ErrorBanner message={error} />
                  </View>
                ) : null}
              </View>
            ) : (
              <Animated.View
                entering={sequenceEnter(0, 14)}
                style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
                <PressableScale
                  accessibilityRole="button"
                  onPress={() => {
                    setError(null);
                    setStep('hub');
                  }}
                  style={styles.back}
                  hitSlop={8}>
                  <Icon icon={faArrowLeft} size={14} color="muted" />
                  <Text size="sm" color="muted">
                    Back
                  </Text>
                </PressableScale>

                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Text size="sm" color="muted">
                    Continue to your
                  </Text>
                  <BigLogo size={40} text={24} />
                </View>

                <View style={{ gap: 14, marginTop: 20 }}>
                  <View>
                    <Label>Email</Label>
                    <Input
                      style={{ borderRadius: Radius.xl }}
                      placeholder="you@company.com"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoComplete="email"
                      autoCorrect={false}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                    />
                  </View>
                  <View>
                    <Label>Password</Label>
                    <View>
                      <Input
                        style={{ borderRadius: Radius.xl, paddingRight: 44 }}
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoComplete="current-password"
                        textContentType="password"
                        onSubmitEditing={signInEmail}
                      />
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                        onPress={() => setShowPassword((v) => !v)}
                        hitSlop={8}
                        style={styles.eye}>
                        <Icon icon={showPassword ? faEyeSlash : faEye} size={16} color="muted" />
                      </PressableScale>
                    </View>
                  </View>

                  {error ? <ErrorBanner message={error} /> : null}

                  <Button
                    title="Sign in"
                    onPress={signInEmail}
                    loading={busy === 'email'}
                    disabled={!email.trim() || !password || busy !== null}
                    style={{ borderRadius: Radius.xl }}
                  />
                </View>
              </Animated.View>
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
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20, alignSelf: 'flex-start' },
  eye: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  tagline: { textAlign: 'center', paddingBottom: 16 },
});
