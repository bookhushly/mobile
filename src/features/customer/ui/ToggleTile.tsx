import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, Text, useDensity } from '@/shared/ui';

type Props = {
  icon: LucideIcon;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testID?: string;
};

// Google Maps' amenity tiles: an icon over a word, tapped on and off. On: the selected wash with a
// violet outline and icon (colour plus the heavier border, never hue alone).
export function ToggleTile({ icon, label, checked, onChange, testID }: Props) {
  const d = useDensity();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => {
        onChange(!checked);
      }}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: '30%',
        minHeight: d.minTarget * 2,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.s2,
        padding: space.s4,
        borderRadius: radius.r4,
        borderCurve: 'continuous',
        borderWidth: checked ? borderWidth.thick : borderWidth.hairline,
        borderColor: checked ? color.actionPressed : color.border,
        backgroundColor: checked ? color.selectedWash : pressed ? color.wash : color.surface,
      })}
    >
      <Icon as={icon} size="md" color={checked ? color.actionPressed : color.textPrimary} />
      <Text variant="labelSm" align="center" numberOfLines={2} maxScale={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}
