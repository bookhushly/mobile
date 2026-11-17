import { useRef, useState } from 'react';
import {
  View,
  useWindowDimensions,
  type FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { TourPanel, type TourScene } from '@/features/customer/ui/TourPanel';
import { CHECKOUT_EVENTS_ENABLED } from '@/shared/config/features';
import { color, radius, space } from '@/shared/theme';
import { Button, Screen, Stack, Text, useMotionTier } from '@/shared/ui';

type Page = { scene: TourScene; headline: string; body: string };

// D15: booking and payment handed off to the website until in-app checkout (Phase 4c, P2).
const PAY_ON_WEB =
  'For now you book and pay on bookhushly.com. You see the full price before you pay.';
const PAY_IN_APP =
  'Book and pay in the app or on bookhushly.com. You see the full price before you pay.';

const PAGES: readonly Page[] = [
  {
    scene: 'find',
    headline: 'Find your place',
    body: 'Hotels, apartments and events across Nigeria, in one app.',
  },
  {
    scene: 'pay',
    headline: 'Pay in naira',
    // Read when shown, so the switch decides (and a test can flip it).
    get body() {
      return CHECKOUT_EVENTS_ENABLED ? PAY_IN_APP : PAY_ON_WEB;
    },
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
// Reduce Motion the pager jumps instead of sliding (MOTION.md §6). Each slide is a grey panel of
// real app pieces over left-aligned words (owner's pick A, 2026-11-15, after Mindtrip and Rodeo);
// the pieces drift against the page as it slides.
export function TourScreen({ onDone }: Props) {
  const tier = useMotionTier();
  const dims = useWindowDimensions();
  const list = useRef<FlatList<Page>>(null);
  const [page, setPage] = useState(0);
  // Pages are as wide as the list itself (the Screen body pads and caps the width).
  const [width, setWidth] = useState(dims.width);
  // Each page is as tall as the list: the panel takes whatever the words leave, so the words
  // always sit just above the footer, on any phone and at any text size.
  const [height, setHeight] = useState(0);
  // The pager's offset on the UI thread, for the panel pieces' drift.
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.set(e.contentOffset.x);
  });

  const go = (next: number) => {
    const index = Math.min(LAST, Math.max(0, next));
    setPage(index);
    list.current?.scrollToIndex({ index, animated: tier !== 'none' });
  };
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0) setWidth(w);
    if (h > 0) setHeight(h);
  };
  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(Math.min(LAST, Math.max(0, index)));
  };

  return (
    <Screen
      overlayHeader
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
                  // The current page is a short bar, so it reads by shape as well as colour.
                  width: i === page ? space.s6 : space.s3,
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
      <Animated.FlatList
        ref={list}
        testID="tour-pager"
        data={PAGES}
        // Items read the current page (which one screen readers see) and the motion tier.
        extraData={`${String(page)}:${tier}`}
        keyExtractor={(p) => p.scene}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onLayout={onLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        style={{ flex: 1, marginHorizontal: -space.s5 }}
        renderItem={({ item, index }) => (
          <View
            style={{ width, height: height > 0 ? height : undefined }}
            // Only the page on screen is readable: a screen reader moving into the next page's
            // text would scroll the pager without the dots or Next knowing (UX review).
            accessibilityElementsHidden={index !== page}
            importantForAccessibility={index === page ? 'auto' : 'no-hide-descendants'}
          >
            <TourPanel
              scene={item.scene}
              scrollX={scrollX}
              index={index}
              width={width}
              tier={tier}
            />
            <Stack gap="s3" style={{ paddingHorizontal: space.s5, paddingTop: space.s7 }}>
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
