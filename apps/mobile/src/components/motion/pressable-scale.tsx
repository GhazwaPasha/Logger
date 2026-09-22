import { useState, type ComponentProps } from 'react';
import { Pressable, type PressableProps, type PressableStateCallbackType } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Duration, POP_EASE, Spring } from '@/constants/motion';
import { haptics, type HapticKind } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type AnimatedStyle = ComponentProps<typeof Animated.View>['style'];

export type PressableScaleProps = Omit<PressableProps, 'style'> &
  Pick<ComponentProps<typeof Animated.View>, 'entering' | 'exiting' | 'layout'> & {
  /** Like `Pressable`'s `style`, but the state callback only carries `pressed`. */
  style?: AnimatedStyle | ((state: Pick<PressableStateCallbackType, 'pressed'>) => AnimatedStyle);
  /** Scale while pressed: the web uses 0.96 on icon buttons and 0.98–0.99 on larger controls. */
  scaleTo?: number;
  /** Tactile feedback fired when the press completes. */
  haptic?: HapticKind | false;
};

/**
 * A `Pressable` that presses in and springs back (the web's `active:scale-[0.97]`), with optional haptics.
 * Style functions still receive `pressed`, so existing pressed-state styling keeps working.
 */
export function PressableScale({
  style,
  scaleTo = 0.97,
  haptic = false,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.set(withTiming(scaleTo, { duration: Duration.press, easing: POP_EASE }));
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, Spring.press));
        setPressed(false);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) haptics[haptic]();
        onPress?.(e);
      }}
      style={[typeof style === 'function' ? style({ pressed }) : style, animated]}
    />
  );
}
