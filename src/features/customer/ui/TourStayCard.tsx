import { Image } from 'expo-image';
import { View } from 'react-native';

import { TourCard } from '@/features/customer/ui/TourCard';
import { radius, space } from '@/shared/theme';
import { Text, formatNaira } from '@/shared/ui';

type Props = { photo: number; name: string; place: string; nightly: number };

/** A listing card in miniature, as Explore shows one: photo, name, place, price a night. */
export function TourStayCard({ photo, name, place, nightly }: Props) {
  return (
    <TourCard pad={false}>
      <Image
        source={photo}
        style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: radius.r3 }}
        contentFit="cover"
      />
      <View style={{ paddingHorizontal: space.s2, paddingBottom: space.s2, gap: space.s1 }}>
        <Text variant="labelSm" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" tone="textSecondary" numberOfLines={1}>
          {place}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          <Text variant="labelSm" tabular style={{ textDecorationLine: 'underline' }}>
            {formatNaira(nightly)}
          </Text>{' '}
          night
        </Text>
      </View>
    </TourCard>
  );
}
