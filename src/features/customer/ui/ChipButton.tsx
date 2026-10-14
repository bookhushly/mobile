import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, Text, useDensity } from '@/shared/ui';

type Props = {
  label: string;
  icon: LucideIcon;
  accessibilityLabel?: string;
  /** On (e.g. Filters with some set): the selected wash fill, announced as selected (U4). */
  active?: boolean;
  onPress: () => void;
  testID?: string;
};

// An outlined chip that opens something (a category, the place sheet, Sort, Filters). The 3:1
// `borderStrong` outline (U5) keeps it reading as a control on the canvas.
export function ChipButton({
  label,
  icon,
  accessibilityLabel,
  active = false,
  onPress,
  testID,
}: Props) {
  const d = useDensity();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: d.minTarget,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s2,
        paddingHorizontal: space.s4,
        borderRadius: radius.r2,
        borderWidth: borderWidth.hairline,
        borderColor: color.borderStrong,
        backgroundColor: active ? color.selectedWash : pressed ? color.wash : color.surface,
      })}
    >
      <Icon as={icon} size="xs" tone="textSecondary" />
      <Text variant="label" numberOfLines={1} maxScale={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}
