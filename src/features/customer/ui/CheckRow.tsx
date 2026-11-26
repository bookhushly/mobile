import { Square, SquareCheck } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { borderWidth, color, space } from '@/shared/theme';
import { Icon, Text, useDensity } from '@/shared/ui';

type Props = {
  label: string;
  checked: boolean;
  /** A line under the label (what the option is). */
  hint?: string;
  onChange: (next: boolean) => void;
  testID?: string;
};

// A checkbox row (Marriott's filter list): the box's fill and tick carry the state, not hue alone.
export function CheckRow({ label, hint, checked, onChange, testID }: Props) {
  const d = useDensity();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={hint === undefined ? label : `${label}, ${hint}`}
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
      {hint === undefined ? (
        <Text variant="body" style={{ flex: 1 }}>
          {label}
        </Text>
      ) : (
        <View style={{ flex: 1, gap: space.s1 }}>
          <Text variant="body">{label}</Text>
          <Text variant="bodySm" tone="textSecondary">
            {hint}
          </Text>
        </View>
      )}
      <Icon
        as={checked ? SquareCheck : Square}
        size="md"
        tone={checked ? 'textPrimary' : 'textMuted'}
      />
    </Pressable>
  );
}
