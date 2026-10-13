import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, Text, useDensity } from '@/shared/ui';

type Props = {
  label: string;
  icon: LucideIcon;
  accessibilityLabel?: string;
  onPress: () => void;
  testID?: string;
};

// An outlined chip that opens something (a category, the place sheet, Sort, Filters).
export function ChipButton({ label, icon, accessibilityLabel, onPress, testID }: Props) {
  const d = useDensity();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: d.minTarget,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s2,
        paddingHorizontal: space.s4,
        borderRadius: radius.r2,
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
        backgroundColor: pressed ? color.wash : color.surface,
      })}
    >
      <Icon as={icon} size="xs" tone="textSecondary" />
      <Text variant="label" numberOfLines={1} maxScale={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}
