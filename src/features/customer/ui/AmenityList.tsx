import { Check } from 'lucide-react-native';
import { View } from 'react-native';

import { space } from '@/shared/theme';
import { Button, Icon, Text } from '@/shared/ui';

/** How many amenities show before "All amenities". */
export const AMENITIES_SHOWN = 6;

type Props = {
  amenities: readonly string[];
  /** Absent: every item shows (the sheet itself). */
  onShowAll?: () => void;
  testID?: string;
};

/** Icon and word, one per line. */
export function AmenityLines({ items }: { items: readonly string[] }) {
  return (
    <View style={{ gap: space.s3 }}>
      {items.map((a) => (
        <View key={a} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
          <Icon as={Check} size="xs" tone="textSecondary" />
          <Text variant="body" style={{ flex: 1 }}>
            {a}
          </Text>
        </View>
      ))}
    </View>
  );
}

// Mobbin §4: the first six, then "All amenities" (a sheet the screen owns: one Modal at a time).
export function AmenityList({ amenities, onShowAll, testID }: Props) {
  if (amenities.length === 0) return null;
  const more = onShowAll !== undefined && amenities.length > AMENITIES_SHOWN;
  return (
    <View testID={testID} style={{ gap: space.s4 }}>
      <AmenityLines items={more ? amenities.slice(0, AMENITIES_SHOWN) : amenities} />
      {more ? (
        <Button
          variant="secondary"
          label={`All amenities (${String(amenities.length)})`}
          onPress={onShowAll}
        />
      ) : null}
    </View>
  );
}
