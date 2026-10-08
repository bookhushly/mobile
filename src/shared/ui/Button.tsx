import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { borderWidth, color, radius, space, type ColorRole } from '@/shared/theme';

import { useDensity } from './DensityProvider';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Spinner } from './Spinner';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type Props = {
  label: string;
  /** Screen-reader label when several buttons share a visible label (defaults to label). */
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /**
   * On a coloured full-screen fill or the dark scanner: `light` = white fill / white outline,
   * `dark` = ink fill / ink outline (for the amber "Already used" fill).
   */
  onInverse?: 'light' | 'dark';
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  /** Overrides the label's Dynamic Type cap (gate outcome actions use 1 so they stay on screen). */
  maxScale?: number;
  testID?: string;
};

type Look = { bg: string; pressed: string; border: string | null; fg: ColorRole };

function look(variant: ButtonVariant, onInverse: 'light' | 'dark' | undefined): Look {
  if (onInverse === 'light')
    return variant === 'primary'
      ? { bg: color.onInverse, pressed: color.wash, border: null, fg: 'textPrimary' }
      : { bg: 'transparent', pressed: 'transparent', border: color.onInverse, fg: 'onInverse' };
  if (onInverse === 'dark')
    return variant === 'primary'
      ? { bg: color.textPrimary, pressed: color.textSecondary, border: null, fg: 'onInverse' }
      : { bg: 'transparent', pressed: 'transparent', border: color.textPrimary, fg: 'textPrimary' };
  switch (variant) {
    case 'primary':
      return { bg: color.actionFill, pressed: color.actionPressed, border: null, fg: 'onAction' };
    case 'secondary':
      return {
        bg: color.surface,
        pressed: color.wash,
        border: color.borderStrong,
        fg: 'textPrimary',
      };
    case 'ghost':
      return { bg: 'transparent', pressed: color.wash, border: null, fg: 'linkText' };
    case 'destructive':
      return {
        bg: color.status.danger.solid,
        pressed: color.status.danger.fg,
        border: null,
        fg: 'onAction',
      };
  }
}

export function Button({
  label,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  onInverse,
  disabled,
  loading,
  icon,
  maxScale,
  testID,
}: Props) {
  const d = useDensity();
  const inactive = disabled === true || loading === true;
  const l = look(variant, onInverse);
  // Disabled is a muted fill, not 50 % opacity (unreadable in sunlight).
  const muted = disabled === true && loading !== true;
  const fg: ColorRole = muted ? 'textMuted' : l.fg;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading === true }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: d.controlHeight,
        paddingHorizontal: space.s5,
        borderRadius: radius.r3,
        borderCurve: 'continuous',
        justifyContent: 'center',
        backgroundColor: muted ? color.wash : pressed ? l.pressed : l.bg,
        borderWidth: l.border === null ? 0 : borderWidth.thick,
        borderColor: muted ? color.border : (l.border ?? undefined),
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.s3,
        }}
      >
        {loading === true ? (
          <Spinner tone={fg} />
        ) : icon !== undefined ? (
          <Icon as={icon} size="sm" tone={fg} />
        ) : null}
        <Text variant="bodyStrong" tone={fg} numberOfLines={2} align="center" maxScale={maxScale}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}
