import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { borderWidth, color, space } from '@/shared/theme';

import { useDensity } from './DensityProvider';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  icon: LucideIcon;
  accessibilityLabel: string;
  onPress: () => void;
  /** Visible label under the circle (scanner bottom controls). */
  label?: string;
  variant?: 'plain' | 'filled' | 'inverse';
  size?: 'md' | 'lg';
  disabled?: boolean;
  testID?: string;
};

// Effective touch target after hitSlop; gate controls must reach this even at `md`.
const MIN_EFFECTIVE_TARGET = 56;

const FACE = { plain: color.surface, filled: color.actionFill, inverse: color.inverse } as const;
const FG = { plain: 'textPrimary', filled: 'onAction', inverse: 'onInverse' } as const;

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  label,
  variant = 'plain',
  size = 'md',
  disabled,
  testID,
}: Props) {
  const d = useDensity();
  const px = size === 'lg' ? d.controlHeight : d.minTarget;
  const slop = Math.max(0, Math.ceil((MIN_EFFECTIVE_TARGET - px) / 2));
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={slop}
    >
      {/* PressableScale wraps children in one Animated.View, so centring and gap live here. */}
      <View style={{ alignItems: 'center', gap: space.s2 }}>
        <View
          testID="icon-button-face"
          style={{
            width: px,
            height: px,
            borderRadius: px / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: FACE[variant],
            borderWidth: variant === 'plain' ? borderWidth.hairline : 0,
            borderColor: color.border,
          }}
        >
          <Icon as={icon} size={size === 'lg' ? 'lg' : 'md'} tone={FG[variant]} />
        </View>
        {label !== undefined ? (
          <Text
            variant="label"
            tone={variant === 'inverse' ? 'onInverse' : 'textPrimary'}
            maxScale={1.3}
            numberOfLines={1}
            align="center"
          >
            {label}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}
