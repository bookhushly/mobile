import { Minus, Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { space } from '@/shared/theme';

import { IconButton } from './IconButton';
import { Text } from './Text';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  testID?: string;
};

export function Stepper({ label, value, min, max, onChange, testID }: Props) {
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${label}, ${String(value)}`}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment' && !atMax) onChange(value + 1);
        if (e.nativeEvent.actionName === 'decrement' && !atMin) onChange(value - 1);
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.s5 }}
    >
      <IconButton
        icon={Minus}
        accessibilityLabel={`Decrease ${label}`}
        disabled={atMin}
        onPress={() => {
          onChange(value - 1);
        }}
      />
      <View style={{ minWidth: space.s8, alignItems: 'center' }}>
        <Text variant="num" tabular align="center">
          {String(value)}
        </Text>
      </View>
      <IconButton
        icon={Plus}
        accessibilityLabel={`Increase ${label}`}
        disabled={atMax}
        onPress={() => {
          onChange(value + 1);
        }}
      />
    </View>
  );
}
