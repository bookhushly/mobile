import { View } from 'react-native';

import { amenityIcon } from '@/features/customer/ui/amenityIcon';
import { space, typeVariants } from '@/shared/theme';
import { Button, Icon, Text } from '@/shared/ui';

/** How many amenities show before "All amenities". */
export const AMENITIES_SHOWN = 6;

type Props = {
  amenities: readonly string[];
  /** Absent: every item shows (the sheet itself). */
  onShowAll?: () => void;
  testID?: string;
};

/** Expedia's "About this property": each amenity with its own icon, two to a row. */
export function AmenityLines({ items }: { items: readonly string[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.s4 }}>
      {items.map((a) => (
        <View
          key={a}
          style={{
            width: '50%',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: space.s3,
            paddingRight: space.s3,
          }}
        >
          {/* Level with the first line when the name wraps (icon rules §6). */}
          <View style={{ height: typeVariants.body.lineHeight, justifyContent: 'center' }}>
            <Icon as={amenityIcon(a)} size="md" />
          </View>
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
