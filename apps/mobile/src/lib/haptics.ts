import * as Haptics from 'expo-haptics';

const fire = (run: () => Promise<void>) => {
  run().catch(() => {
    // Haptics are a nicety: devices without a motor (or with them disabled) just skip them.
  });
};

/** Small tactile confirmations, used sparingly on meaningful actions. */
export const haptics = {
  /** A light tap: pressing a primary action. */
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A selection tick: toggling a checkbox, changing a stage, picking an option. */
  select: () => fire(() => Haptics.selectionAsync()),
  /** Something good landed: a new notification arriving. */
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};

export type HapticKind = keyof typeof haptics;
