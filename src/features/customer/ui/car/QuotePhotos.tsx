import type { LucideIcon } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, View } from 'react-native';

import { color, radius, space } from '@/shared/theme';
import { CarPhoto } from '@/features/customer/ui/car/CarPhoto';
import { Text } from '@/shared/ui';

type Props = {
  /** https URLs from the company, or one bundled option photo. */
  photos: readonly (string | number)[];
  label: string;
  /** For a quote with no photos. */
  icon?: LucideIcon;
};

const HEIGHT = 240;

// The company's photos of the car, swiped one at a time with an "n / total" count (Turo, Airbnb).
export function QuotePhotos({ photos, label, icon }: Props) {
  // Measured, not the window: on tablets the page is narrower than the screen.
  const [w, setW] = useState(0);
  const [at, setAt] = useState(0);
  if (photos.length === 0) return <CarPhoto source={null} height={HEIGHT} icon={icon} />;
  return (
    // Not merged into one element: each photo is its own, so a screen reader can move through them.
    <View
      onLayout={(e) => {
        setW(e.nativeEvent.layout.width);
      }}
      style={{ height: HEIGHT }}
    >
      {/* Perf (as Gallery's P4): one photo mounted at a time around the one in view, laid out at the
          measured width, cached; nothing renders until the width is known. */}
      {w === 0 ? null : (
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialNumToRender={1}
          windowSize={3}
          getItemLayout={(_d, index) => ({ length: w, offset: w * index, index })}
          keyExtractor={(p, i) => `${String(i)}:${String(p)}`}
          onMomentumScrollEnd={(e) => {
            setAt(Math.round(e.nativeEvent.contentOffset.x / w));
          }}
          style={{ borderRadius: radius.r4, overflow: 'hidden' }}
          renderItem={({ item, index }) => (
            <Image
              source={typeof item === 'string' ? { uri: item } : item}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
              recyclingKey={String(item)}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`${label}, photo ${String(index + 1)} of ${String(photos.length)}`}
              style={{ width: w, height: HEIGHT, backgroundColor: color.wash }}
            />
          )}
        />
      )}
      {photos.length > 1 ? (
        <View
          // The count is already in each photo's label.
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={{
            position: 'absolute',
            right: space.s3,
            bottom: space.s3,
            paddingHorizontal: space.s3,
            paddingVertical: space.s1,
            borderRadius: radius.rFull,
            backgroundColor: color.inverse,
          }}
        >
          <Text variant="caption" tone="onInverse" tabular>
            {`${String(at + 1)} / ${String(photos.length)}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
