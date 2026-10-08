import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { borderWidth, color, space } from '@/shared/theme';

import { useDensity } from './DensityProvider';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  icon: LucideIcon;
  /** Icon while checked (e.g. Volume2 vs VolumeX); defaults to `icon`. */
  iconOn?: LucideIcon;
  label: string;
  accessibilityLabel?: string;
  /** Hide the visible label (top-bar toggles); the switch keeps its name. */
  hideLabel?: boolean;
  checked: boolean;
  onChange: (next: boolean) => void;
  variant?: 'plain' | 'inverse';
  size?: 'md' | 'lg';
  testID?: string;
};

// Effective touch target after hitSlop; gate controls must reach this even at `md`.
const MIN_EFFECTIVE_TARGET = 56;

export function ToggleButton({
  icon,
  iconOn,
  label,
  accessibilityLabel,
  hideLabel,
  checked,
  onChange,
  variant = 'plain',
  size = 'md',
  testID,
}: Props) {
  const d = useDensity();
  const px = size === 'lg' ? d.controlHeight : d.minTarget;
  const inverse = variant === 'inverse';
  // Checked is shown by fill + icon, never by violet alone.
  const face = checked
    ? inverse
      ? color.onInverse
      : color.textPrimary
    : inverse
      ? color.inverse
      : color.surface;
  const fg = checked
    ? inverse
      ? 'textPrimary'
      : 'onInverse'
    : inverse
      ? 'onInverse'
      : 'textPrimary';
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked }}
      onPress={() => {
        onChange(!checked);
      }}
      hitSlop={Math.max(0, Math.ceil((MIN_EFFECTIVE_TARGET - px) / 2))}
      style={{ alignItems: 'center', gap: space.s2 }}
    >
      <View
        style={{
          width: px,
          height: px,
          borderRadius: px / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: face,
          borderWidth: borderWidth.hairline,
          borderColor: inverse ? color.onInverse : color.border,
        }}
      >
        <Icon
          as={checked && iconOn !== undefined ? iconOn : icon}
          size={size === 'lg' ? 'lg' : 'md'}
          tone={fg}
        />
      </View>
      {hideLabel === true ? null : (
        <Text
          variant="label"
          tone={inverse ? 'onInverse' : 'textPrimary'}
          maxScale={1.3}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </PressableScale>
  );
}
