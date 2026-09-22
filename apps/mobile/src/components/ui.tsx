import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { useState, type ReactNode } from 'react';
import Animated from 'react-native-reanimated';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { emptyEnter, stateTransition } from '@/constants/motion';
import { alpha, Fonts, Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { nameInitials } from '@/lib/format';
import type { HapticKind } from '@/lib/haptics';

// ---------------------------------------------------------------------------------------------
// Buttons (`.btn-primary`, `.btn-secondary`, `.btn-ghost` in the web's globals.css)
// ---------------------------------------------------------------------------------------------

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: IconDefinition;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  /** Tactile feedback on press; primary buttons tap by default. */
  haptic?: HapticKind | false;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  compact,
  haptic,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const off = disabled || loading;
  const fg = variant === 'primary' ? theme.onAccent : theme.fg;

  return (
    <PressableScale
      accessibilityRole="button"
      disabled={off}
      onPress={onPress}
      scaleTo={0.98}
      haptic={haptic ?? (variant === 'primary' ? 'tap' : false)}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === 'primary' && { backgroundColor: theme.accent, borderColor: theme.accent },
        variant === 'secondary' && { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
        variant === 'ghost' && { backgroundColor: 'transparent', borderColor: 'transparent' },
        { opacity: off ? 0.55 : pressed ? 0.85 : 1 },
        stateTransition,
        style as object,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? <Icon icon={icon} size={14} color={fg} /> : null}
          <Text weight="medium" size={compact ? 'xs' : 'sm'} color={fg}>
            {title}
          </Text>
        </>
      )}
    </PressableScale>
  );
}

/** Square icon-only control (`size-9`/`size-10` in the web chrome and toolbars). */
export function IconButton({
  icon,
  children,
  onPress,
  label,
  size = 40,
  iconSize = 16,
  active,
  tone = 'muted',
  style,
}: {
  /** FontAwesome icon; omit and pass `children` to draw a custom glyph instead. */
  icon?: IconDefinition;
  children?: ReactNode;
  onPress: () => void;
  label: string;
  size?: number;
  iconSize?: number;
  /** Filled state (`bg-fg text-surface-base` in the web toolbar). */
  active?: boolean;
  tone?: 'muted' | 'fg';
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.96}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: Radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? theme.fg : pressed ? theme.surfaceHover : 'transparent',
        },
        stateTransition,
        style as object,
      ]}>
      {children ??
        (icon ? (
          <Icon icon={icon} size={iconSize} color={active ? theme.surfaceBase : tone === 'fg' ? theme.fg : theme.muted} />
        ) : null)}
    </PressableScale>
  );
}

/** Toggle / option chip (`rounded-lg border px-3 py-1.5 text-xs font-medium`). */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  iconColor,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconDefinition;
  iconColor?: string;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      haptic="select"
      style={[
        styles.chip,
        selected
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
        stateTransition,
      ]}>
      {icon ? <Icon icon={icon} size={12} color={selected ? theme.onAccent : (iconColor ?? theme.muted)} /> : null}
      <Text size="xs" weight="medium" color={selected ? theme.onAccent : theme.fg}>
        {label}
      </Text>
    </PressableScale>
  );
}

// ---------------------------------------------------------------------------------------------
// Inputs (`.input`)
// ---------------------------------------------------------------------------------------------

export function Input({ style, onFocus, onBlur, ...rest }: TextInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={theme.muted}
      cursorColor={theme.accent}
      selectionColor={theme.accentMuted}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        styles.input,
        {
          backgroundColor: theme.surfaceElevated,
          borderColor: focused ? theme.accent : theme.border,
          color: theme.fg,
          fontFamily: Fonts.sans.regular,
        },
        style,
      ]}
      {...rest}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Avatar (initials fallback, like `components/ui/Avatar.tsx`)
// ---------------------------------------------------------------------------------------------

export function Avatar({
  name,
  email,
  image,
  size = 20,
  tint,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: number;
  /** Background behind the initials. Defaults to `accent-muted`. */
  tint?: string;
}) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const showImage = !!image && !failed;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tint ?? theme.accentMuted,
      }}>
      {showImage ? (
        <ImageFill uri={image!} onError={() => setFailed(true)} />
      ) : (
        <Text weight="semibold" size={size <= 22 ? '10' : size <= 32 ? '11' : 'xs'} uppercase tracking={-0.2}>
          {nameInitials(name, email)}
        </Text>
      )}
    </View>
  );
}

function ImageFill({ uri, onError }: { uri: string; onError: () => void }) {
  return <Image source={{ uri }} onError={onError} style={StyleSheet.absoluteFill} resizeMode="cover" />;
}

// ---------------------------------------------------------------------------------------------
// Feedback: spinner, empty state, error banner, skeleton
// ---------------------------------------------------------------------------------------------

export function Spinner({ size = 'small' }: { size?: 'small' | 'large' }) {
  const theme = useTheme();
  return <ActivityIndicator size={size} color={theme.muted} />;
}

export function CenteredSpinner() {
  return (
    <View style={styles.center}>
      <Spinner />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  compact,
  action,
}: {
  icon: IconDefinition;
  title: string;
  description?: string;
  compact?: boolean;
  action?: ReactNode;
}) {
  const theme = useTheme();
  const badge = compact ? 36 : 48;
  return (
    <Animated.View entering={emptyEnter} style={[styles.empty, { gap: compact ? 6 : 10, paddingVertical: compact ? 12 : 24 }]}>
      <View
        style={{
          width: badge,
          height: badge,
          borderRadius: badge / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.surfaceMuted,
        }}>
        <Icon icon={icon} size={compact ? 14 : 16} color="muted" />
      </View>
      <Text size={compact ? 'xs' : 'sm'} weight="medium" style={styles.centerText}>
        {title}
      </Text>
      {description ? (
        <Text size={compact ? '11' : 'xs'} color="muted" style={styles.centerText}>
          {description}
        </Text>
      ) : null}
      {action}
    </Animated.View>
  );
}

/** `ErrorBanner` — red tinted alert with an optional retry. */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const dark = useIsDark();
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        { backgroundColor: alpha(Tone.red500, 0.1), borderColor: alpha(Tone.red500, 0.25) },
      ]}>
      <Icon icon={faCircleExclamation} size={14} color={dark ? Tone.red400 : Tone.red600} style={{ marginTop: 3 }} />
      <Text size="sm" color={dark ? '#fecaca' : '#991b1b'} style={{ flex: 1 }}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text size="xs" weight="medium" color={dark ? Tone.red400 : Tone.red600}>
            Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonCompact: { minHeight: 32, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.lg },
  input: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { textAlign: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
