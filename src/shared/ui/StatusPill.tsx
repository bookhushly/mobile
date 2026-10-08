import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { borderWidth, color, radius, space, type ColorRole, type StatusTone } from '@/shared/theme';

import { useDensity } from './DensityProvider';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  tone: StatusTone;
  label: string;
  icon?: LucideIcon;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** On a gate outcome fill: outline and text in the fill's foreground colour, no tint. */
  onFill?: string;
  size?: 'sm' | 'md';
  /** Lines the label may take before truncating (the gate status pill allows 2). */
  numberOfLines?: number;
  /** Overrides the label's Dynamic Type cap (outcome tags use 1). */
  maxScale?: number;
  testID?: string;
};

const FG: Record<StatusTone, ColorRole> = {
  neutral: 'neutralFg',
  info: 'infoFg',
  success: 'successFg',
  warning: 'warningFg',
  danger: 'dangerFg',
};

// Status reads by tone, never violet (DESIGN_SYSTEM 70/20/10).
export function StatusPill({
  tone,
  label,
  icon,
  onPress,
  accessibilityLabel,
  onFill,
  size = 'md',
  numberOfLines = 1,
  maxScale,
  testID = 'status-pill',
}: Props) {
  const d = useDensity();
  const s = color.status[tone];
  const outlined = onFill !== undefined;
  const face = (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: space.s2,
        paddingHorizontal: size === 'sm' ? space.s2 : space.s3,
        paddingVertical: size === 'sm' ? space.s1 : space.s2,
        borderRadius: radius.rFull,
        backgroundColor: outlined ? 'transparent' : s.bg,
        borderWidth: outlined ? borderWidth.thick : 0,
        borderColor: onFill,
      }}
    >
      {icon !== undefined ? <Icon as={icon} size="xs" tone={FG[tone]} color={onFill} /> : null}
      <Text
        variant="labelSm"
        tone={FG[tone]}
        style={[{ flexShrink: 1 }, outlined ? { color: onFill } : null]}
        numberOfLines={numberOfLines}
        maxScale={maxScale}
      >
        {label}
      </Text>
    </View>
  );
  if (onPress === undefined) return face;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={size === 'sm' ? 12 : 8}
      style={{ minHeight: size === 'sm' ? 32 : d.minTarget, justifyContent: 'center' }}
    >
      {face}
    </Pressable>
  );
}
