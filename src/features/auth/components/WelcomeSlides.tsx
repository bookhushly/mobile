import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { slideFromOffset, WELCOME_SLIDES } from '@/features/auth/domain/welcomeSlides';
import { useWelcomeSlide } from '@/features/auth/hooks/useWelcomeSlide';
import { color, density, layout, radius, space } from '@/shared/theme';
import { Text } from '@/shared/ui';
import { useMotionTier } from '@/shared/ui/motion';

// The current dot is wider as well as solid, so state never rests on opacity alone.
const DOT = 8;
const DOT_CURRENT = 20;
const DOT_IDLE_OPACITY = 0.6;
const LAST = WELCOME_SLIDES.length - 1;

// Welcome's onboarding words: swipe between slides; the photo behind follows the same store.
// Pages run edge to edge so a swipe can start anywhere; each page carries the gutter itself.
export function WelcomeSlides() {
  const index = useWelcomeSlide((s) => s.index);
  const show = useWelcomeSlide((s) => s.show);
  const still = useMotionTier() === 'none';
  const pager = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  // The first placement (and a return to Welcome mid-show) lands without sliding past pages.
  const placed = useRef(false);

  // The slideshow and screen readers change the store; the pager catches up.
  useEffect(() => {
    if (width <= 0) return;
    pager.current?.scrollTo({ x: index * width, animated: placed.current && !still });
    placed.current = true;
  }, [index, width, still]);

  return (
    <View
      style={{ marginHorizontal: -layout.formGutter }}
      onLayout={(e) => {
        setWidth(e.nativeEvent.layout.width);
      }}
    >
      <ScrollView
        ref={pager}
        testID="welcome-pager"
        horizontal
        pagingEnabled
        // Nothing to show until the page width is known, so slides never lay out at full width.
        style={{ opacity: width > 0 ? 1 : 0 }}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const at = slideFromOffset(e.nativeEvent.contentOffset.x, width);
          if (at !== index) show(at);
        }}
        // Any drag counts as choosing, so the slideshow never moves a page out from under a finger.
        onScrollBeginDrag={() => {
          show(index);
        }}
      >
        {WELCOME_SLIDES.map((slide, i) => {
          const current = i === index;
          return (
            <View
              key={slide.photo}
              testID={`welcome-slide-${String(i)}`}
              style={{ width: width || undefined, paddingHorizontal: layout.formGutter }}
              // Only the slide on screen is read out.
              accessibilityElementsHidden={!current}
              importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}
            >
              <Text
                variant="displayMd"
                tone="onInverse"
                accessibilityRole={current ? 'header' : undefined}
              >
                {slide.title}
              </Text>
              <View style={{ marginTop: space.s4 }}>
                <Text variant="lead" tone="onInverse">
                  {slide.body}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View
        testID="welcome-dots"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Slides"
        accessibilityValue={{ text: `${String(index + 1)} of ${String(LAST + 1)}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') show(Math.min(index + 1, LAST));
          if (e.nativeEvent.actionName === 'decrement') show(Math.max(index - 1, 0));
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.s3,
          minHeight: density.customer.minTarget,
          paddingHorizontal: layout.formGutter,
          marginTop: space.s3,
        }}
      >
        {WELCOME_SLIDES.map((slide, i) => (
          <View
            key={slide.photo}
            testID={i === index ? 'welcome-dot-current' : undefined}
            style={{
              width: i === index ? DOT_CURRENT : DOT,
              height: DOT,
              borderRadius: radius.rFull,
              backgroundColor: color.onInverse,
              opacity: i === index ? 1 : DOT_IDLE_OPACITY,
            }}
          />
        ))}
      </View>
    </View>
  );
}
