import { View } from 'react-native';

import { digits, grouped } from '@/features/customer/ui/filterOptions';
import { space } from '@/shared/theme';
import { Input } from '@/shared/ui';

type Props = {
  /** Whole naira as digits ("" = no limit). */
  min: string;
  max: string;
  /** Shown on the maximum (min > max is checked on Show results). */
  error: string | undefined;
  onChange: (next: { min: string; max: string }) => void;
};

// Two naira fields, no slider (Mobbin §3: sliders are poor for exact naira on small phones).
// Shown grouped ("250,000"); the value kept is digits only, so it stays a whole number.
export function PriceRangeFields({ min, max, error, onChange }: Props) {
  return (
    <View style={{ flexDirection: 'row', gap: space.s3 }}>
      <View style={{ flex: 1 }}>
        <Input
          label="Minimum (₦)"
          value={grouped(min)}
          onChangeText={(t) => {
            onChange({ min: digits(t), max });
          }}
          keyboardType="number-pad"
          placeholder="No minimum"
          testID="price-min"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Input
          label="Maximum (₦)"
          value={grouped(max)}
          error={error}
          onChangeText={(t) => {
            onChange({ min, max: digits(t) });
          }}
          keyboardType="number-pad"
          placeholder="No maximum"
          testID="price-max"
        />
      </View>
    </View>
  );
}
