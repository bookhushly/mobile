import { useRef, useState } from 'react';
import {
  FlatList,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { color, radius, space } from '@/shared/theme';
import { Button, Illustration, Screen, Stack, Text, useMotionTier, type IllustrationName } from '@/shared/ui';

type Page = { scene: IllustrationName; headline: string; body: string };

const PAGES: readonly Page[] = [
  {
    scene: 'find',
    headline: 'Find your place',
    body: 'Hotels, apartments and events across Nigeria, in one app.',
  },
  {
    scene: 'pay',
    headline: 'Pay in naira',
    body: 'Card, bank transfer or crypto. You see the full price before you pay.',
  },
  {
    scene: 'showUp',
    headline: 'Show up',
    body: 'Your tickets and bookings stay on your phone, even offline.',
  },
];

const LAST = PAGES.length - 1;

type Props = { onDone: () => void };

// Find · Pay · Show up (spec §3 flow 6). Swipeable and button-navigable; no autoplay; under
// Reduce Motion the pager jumps instead of sliding (MOTION.md §6).
export function TourScreen({ onDone }: Props) {
  const tier = useMotionTier();
  const dims = useWindowDimensions();
  const list = useRef<FlatList<Page>>(null);
  const [page, setPage] = useState(0);
  // Pages are as wide as the list itself (the Screen body pads and caps the width).
  const [width, setWidth] = useState(dims.width);

  const go = (next: number) => {
    const index = Math.min(LAST, Math.max(0, next));
    setPage(index);
    list.current?.scrollToIndex({ index, animated: tier !== 'none' });
  };
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setWidth(w);
  };
  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(Math.min(LAST, Math.max(0, index)));
  };

  return (
    <Screen
      header={
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button variant="ghost" label="Skip" onPress={onDone} />
        </View>
      }
      footer={
        <Stack gap="s5">
          <View
            accessible
            accessibilityLabel={`Page ${String(page + 1)} of ${String(PAGES.length)}`}
            accessibilityLiveRegion="polite"
            style={{ flexDirection: 'row', justifyContent: 'center', gap: space.s3 }}
          >
            {PAGES.map((p, i) => (
              <View
                key={p.scene}
                style={{
                  width: space.s3,
                  height: space.s3,
                  borderRadius: radius.rFull,
                  backgroundColor: i === page ? color.actionFill : color.border,
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: space.s3 }}>
            {page > 0 ? (
              <View style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  label="Back"
                  onPress={() => {
                    go(page - 1);
                  }}
                />
              </View>
            ) : null}
            <View style={{ flex: 2 }}>
              <Button
                label={page === LAST ? 'Get started' : 'Next'}
                onPress={() => {
                  if (page === LAST) onDone();
                  else go(page + 1);
                }}
              />
            </View>
          </View>
        </Stack>
      }
    >
      <FlatList
        ref={list}
        testID="tour-pager"
        data={PAGES}
        keyExtractor={(p) => p.scene}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onLayout={onLayout}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        style={{ flex: 1, marginHorizontal: -space.s5 }}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: space.s5, justifyContent: 'center' }}>
            <View style={{ alignItems: 'center', paddingVertical: space.s7 }}>
              <Illustration name={item.scene} size={200} />
            </View>
            <Stack gap="s3">
              <Text variant="displaySm" accessibilityRole="header">
                {item.headline}
              </Text>
              <Text variant="body" tone="textSecondary">
                {item.body}
              </Text>
            </Stack>
          </View>
        )}
      />
    </Screen>
  );
}
