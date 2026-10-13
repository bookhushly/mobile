import { Image } from 'expo-image';
import { BedDouble, Building2, Ticket, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import {
  FlatList,
  Pressable,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { ListingKind } from '@/features/customer/domain/discover';
import { color, radius, space } from '@/shared/theme';
import { Icon, Text } from '@/shared/ui';

const RATIO = 16 / 10;

const KIND_ICON: Record<ListingKind, LucideIcon> = {
  hotel: BedDouble,
  apartment: Building2,
  event: Ticket,
};

type Props = {
  kind: ListingKind;
  title: string;
  /** https only (D14), already filtered. */
  images: readonly string[];
  onOpen: (index: number) => void;
};

/** "2/12" over the photo; spoken with the photo's own label instead. */
export function Counter({ index, total }: { index: number; total: number }) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        right: space.s4,
        bottom: space.s4,
        paddingHorizontal: space.s3,
        paddingVertical: space.s1,
        borderRadius: radius.r2,
        backgroundColor: color.inverse,
      }}
    >
      <Text variant="labelSm" tone="onInverse" tabular testID="gallery-counter">
        {`${String(index + 1)}/${String(total)}`}
      </Text>
    </View>
  );
}

// Spec §3/§6, D14: a 16:10 pager with a counter; a tap opens the full-screen viewer. No photo →
// a wash block with the kind's icon, never a stock image.
export function Gallery({ kind, title, images, onOpen }: Props) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const frame = { width: '100%' as const, aspectRatio: RATIO, borderRadius: radius.r3 };
  if (images.length === 0)
    return (
      <View
        testID="gallery-empty"
        style={[
          frame,
          { backgroundColor: color.wash, alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <Icon as={KIND_ICON[kind]} size="lg" tone="textMuted" />
      </View>
    );
  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };
  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(Math.min(images.length - 1, Math.max(0, i)));
  };
  return (
    <View
      testID="gallery"
      onLayout={onLayout}
      style={[frame, { overflow: 'hidden', backgroundColor: color.wash }]}
    >
      {width > 0 ? (
        <FlatList
          horizontal
          pagingEnabled
          data={images}
          keyExtractor={(u, i) => `${String(i)}:${u}`}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onSettle}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          initialNumToRender={2}
          windowSize={3}
          renderItem={({ item, index: i }) => (
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel={`Photo ${String(i + 1)} of ${String(images.length)}, ${title}`}
              accessibilityHint="Opens full screen"
              onPress={() => {
                onOpen(i);
              }}
              testID={`gallery-photo-${String(i)}`}
            >
              <Image
                source={{ uri: item }}
                style={{ width, aspectRatio: RATIO, backgroundColor: color.wash }}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={item}
                transition={0}
              />
            </Pressable>
          )}
        />
      ) : null}
      {images.length > 1 ? <Counter index={index} total={images.length} /> : null}
    </View>
  );
}
