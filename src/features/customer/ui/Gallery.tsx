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
import { color, layout, radius, space } from '@/shared/theme';
import { Icon, Text, useWide } from '@/shared/ui';

// Owner's picks (2026-11-15, second round, Mobbin): hotels and apartments after Airbnb's listing
// (the photo to the screen's top edge, a "1 / 20" counter that moves as you swipe, the page's sheet
// riding up over its foot); events after Luma (the poster as a rounded square card on a dark hero).
const RATIO: Record<ListingKind, number> = { hotel: 5 / 4, apartment: 5 / 4, event: 1 };

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
  /** Luma: a rounded card inside the page's gutters instead of edge to edge. */
  framed?: boolean;
  /** Space kept clear at the photo's foot (the sheet that rides over it), above the counter. */
  footInset?: number;
};

/** "2 / 12" (Airbnb), counting as the photos move; the photo's own label is what's spoken. */
export function Counter({
  index,
  total,
  lift = 0,
}: {
  index: number;
  total: number;
  lift?: number;
}) {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', right: space.s4, bottom: space.s4 + lift }}
    >
      <View
        style={{
          paddingHorizontal: space.s4,
          paddingVertical: space.s2,
          borderRadius: radius.rFull,
          backgroundColor: color.inverse,
        }}
      >
        <Text variant="labelSm" tone="onInverse" tabular testID="gallery-counter">
          {`${String(index + 1)} / ${String(total)}`}
        </Text>
      </View>
    </View>
  );
}

// Spec §3/§6, D14: a pager; a tap opens the full-screen viewer. No photo → a wash block with the
// kind's icon, never a stock image. No resize endpoint yet (BACKEND_STATUS §9): originals, at most
// ~3 at a time (`initialNumToRender` 1, `windowSize` 3; perf review P4).
export function Gallery({ kind, title, images, onOpen, framed = false, footInset = 0 }: Props) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  // Edge to edge (Expedia, Airbnb): the photo runs past the page gutters to the screen's sides.
  const gutter = useWide() ? layout.tabletGutter : layout.phoneGutter;
  const ratio = RATIO[kind];
  const frame = framed
    ? {
        alignSelf: 'stretch' as const,
        aspectRatio: ratio,
        borderRadius: radius.r4,
        borderCurve: 'continuous' as const,
      }
    : { alignSelf: 'stretch' as const, marginHorizontal: -gutter, aspectRatio: ratio };
  const many = images.length > 1;
  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };
  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(Math.min(images.length - 1, Math.max(0, i)));
  };
  const overlay = many ? <Counter index={index} total={images.length} lift={footInset} /> : null;
  if (images.length === 0)
    return (
      <View
        testID="gallery-empty"
        style={[
          frame,
          {
            overflow: 'hidden',
            backgroundColor: color.wash,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <Icon as={KIND_ICON[kind]} size="lg" tone="textMuted" />
        {overlay}
      </View>
    );
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
          initialNumToRender={1}
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
                style={{ width, aspectRatio: ratio, backgroundColor: color.wash }}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={item}
                transition={0}
              />
            </Pressable>
          )}
        />
      ) : null}
      {overlay}
    </View>
  );
}
