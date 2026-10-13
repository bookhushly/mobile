import { Square, SquareCheck } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { borderWidth, color, space } from '@/shared/theme';
import { Icon, Text, useDensity } from '@/shared/ui';

type Props = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  testID?: string;
};

// A checkbox row (Marriott's filter list): the box's fill and tick carry the state, not hue alone.
export function CheckRow({ label, checked, onChange, testID }: Props) {
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
        minHeight: d.rowMin,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s4,
        paddingVertical: space.s3,
        borderBottomWidth: borderWidth.hairline,
        borderBottomColor: color.border,
        backgroundColor: pressed ? color.wash : 'transparent',
      })}
    >
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Icon
        as={checked ? SquareCheck : Square}
        size="md"
        tone={checked ? 'textPrimary' : 'textMuted'}
      />
    </Pressable>
  );
}
