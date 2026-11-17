import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  claimLaunchIntro,
  INTRO,
  LOGO_OUT_AT,
  whenWelcomeDrawn,
} from '@/features/auth/launchIntro';
import { hideSplashOnce } from '@/shared/platform/splash';
import { color, motion } from '@/shared/theme';
import { useMotionTier } from '@/shared/ui/motion';

const mark = require('../../../../assets/images/brand-mark-white.png') as number;
const name = require('../../../../assets/images/brand-name-white.png') as number;
// Same size and place as the native splash (app.json `imageWidth`), so nothing jumps. The images
// are drawn from the vector logo (assets/brand/), sharp well past this size.
export const MARK_PT = 72;
// The full logo's proportions, from the vector lockup (the mark 91.29 wide; the name 219.89 by
// 40.49, its top 34.15 below the mark's, 10.71 after it), scaled to the mark's size here.
const UNIT = MARK_PT / 91.29;
const NAME_W = 219.89 * UNIT;
const NAME_H = 40.49 * UNIT;
const NAME_TOP = 34.15 * UNIT;
const GAP = 10.71 * UNIT;
const LOGO_W = MARK_PT + GAP + NAME_W;
/** How far the mark steps left so the whole logo ends up centred. */
const MARK_SHIFT = LOGO_W / 2 - MARK_PT / 2;
// Long enough to register the brand, short enough not to feel like a loading screen.
export const HOLD_MS = INTRO.hold;
/** Until the layer is gone, per tier. Reduced: one short fade (MOTION.md §6). None: no motion. */
export const INTRO_TOTAL_MS = {
  full: LOGO_OUT_AT + INTRO.layerDelay + INTRO.layerOut,
  reduced: INTRO.hold + motion.duration.base,
  none: INTRO.hold,
} as const;
/** Starts anyway if Welcome hasn't drawn by then (a launch deep-linked past it), so it never hangs. */
export const WAIT_CAP_MS = 3000;
// The logo lifts a touch as it goes: small enough to read as settling, not zooming.
const LIFT = 1.04;
// Strong ease-out (expo-animation skill) for the slide: fast start, soft landing. Never ease-in.
const [x1, y1, x2, y2] = motion.easing.decelerate;
// The fades use the gentler standard curve: on decelerate ~70 % of a fade lands in its first
// frames, so the violet read as a cut to Welcome, not a dissolve (recorded 2026-11-15).
const [f1, f2, f3, f4] = motion.easing.standard;

/**
 * The opening screen, once per launch and only when the launch lands on Welcome (owner's pick D,
 * 2026-11-15, after Netflix's and Arc's animated logos). It starts as the native splash: the mark
 * alone on violet. The mark steps left and "Bookhushly" slides out from behind it, the full logo
 * holds a beat, then it lifts away as the violet dissolves into Welcome. Transform and opacity
 * only: the name sits in a fixed clip beside the mark's final place and slides in from its left
 * edge, so it seems to come out of the mark (MOTION.md: no animated layout).
 */
export function BrandIntro() {
  const tier = useMotionTier();
  const [showing, setShowing] = useState(claimLaunchIntro);
  const fade = useSharedValue(1);
  const grow = useSharedValue(1);
  const logoFade = useSharedValue(1);
  const reveal = useSharedValue(0);
  // The reveal plays from mount (Welcome builds underneath meanwhile, on the JS thread); only the
  // dissolve waits for Welcome's photo to be on screen (perf review, 2026-11-17: waiting before
  // the reveal added Welcome's build time to the intro's).
  const [mountedAt] = useState(() => Date.now());
  const [ready, setReady] = useState(false);
  // Opaque until the violet starts to go: no tap reaches Welcome's hidden buttons (code review).
  const [blocking, setBlocking] = useState(true);

  useEffect(() => {
    if (!showing) return;
    if (tier !== 'full') {
      // The tier can settle after mount (its check is async): undo a reveal already started.
      cancelAnimation(reveal);
      reveal.set(0);
      return;
    }
    const ease = Easing.bezier(x1, y1, x2, y2);
    reveal.set(withDelay(INTRO.hold, withTiming(1, { duration: INTRO.reveal, easing: ease })));
  }, [showing, tier, reveal]);

  useEffect(() => {
    if (!showing) return;
    const start = () => {
      setReady(true);
    };
    const off = whenWelcomeDrawn(start);
    const cap = setTimeout(start, WAIT_CAP_MS);
    return () => {
      off();
      clearTimeout(cap);
    };
  }, [showing]);

  useEffect(() => {
    if (!showing || !ready) return;
    const soft = Easing.bezier(f1, f2, f3, f4);
    const since = Date.now() - mountedAt;
    // The logo leaves at its planned moment, or at once if Welcome took longer than that.
    const outAt = Math.max(0, (tier === 'full' ? LOGO_OUT_AT : INTRO.hold) - since);
    let fadeAt = outAt;
    let doneAt = outAt;
    if (tier === 'full') {
      const out = { duration: INTRO.markOut, easing: soft };
      grow.set(withDelay(outAt, withTiming(LIFT, out)));
      logoFade.set(withDelay(outAt, withTiming(0, out)));
      fadeAt = outAt + INTRO.layerDelay;
      fade.set(withDelay(fadeAt, withTiming(0, { duration: INTRO.layerOut, easing: soft })));
      doneAt = fadeAt + INTRO.layerOut;
    } else if (tier === 'reduced') {
      fade.set(withDelay(outAt, withTiming(0, { duration: motion.duration.base, easing: soft })));
      doneAt = outAt + motion.duration.base;
    } else {
      cancelAnimation(fade);
      cancelAnimation(grow);
      cancelAnimation(logoFade);
      fade.set(1);
      grow.set(1);
      logoFade.set(1);
    }
    const unblock = setTimeout(() => {
      setBlocking(false);
    }, fadeAt);
    const done = setTimeout(() => {
      setShowing(false);
    }, doneAt);
    return () => {
      clearTimeout(unblock);
      clearTimeout(done);
    };
  }, [showing, ready, tier, mountedAt, fade, grow, logoFade]);

  const layer = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const logo = useAnimatedStyle(() => ({
    opacity: logoFade.get(),
    transform: [{ scale: grow.get() }],
  }));
  const markMove = useAnimatedStyle(() => ({
    transform: [{ translateX: -MARK_SHIFT * reveal.get() }],
  }));
  const nameMove = useAnimatedStyle(() => ({
    transform: [{ translateX: -NAME_W * (1 - reveal.get()) }],
  }));

  if (!showing) return null;
  return (
    <Animated.View
      testID="brand-intro"
      // Drawn and identical to the native splash: now the splash can go.
      onLayout={hideSplashOnce}
      pointerEvents={blocking ? 'auto' : 'none'}
      // While it covers the screen, the screen reader stays on it, not on the hidden Welcome.
      accessible
      accessibilityRole="image"
      accessibilityLabel="Bookhushly"
      accessibilityViewIsModal={blocking}
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: color.brand, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
        layer,
      ]}
    >
      <Animated.View style={[{ width: LOGO_W, height: MARK_PT }, logo]}>
        {/* The name's window: where it ends up, beside the mark's final place. */}
        <View
          style={{
            position: 'absolute',
            left: MARK_PT + GAP,
            top: NAME_TOP,
            width: NAME_W,
            height: NAME_H,
            overflow: 'hidden',
          }}
        >
          <Animated.View style={nameMove}>
            <Image
              source={name}
              style={{ width: NAME_W, height: NAME_H }}
              contentFit="contain"
              testID="brand-intro-name"
            />
          </Animated.View>
        </View>
        {/* The mark starts centred (where the native splash drew it) and steps left. It sits on a
            violet backing, so the name never shows through the mark's cut-outs as it passes. */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: MARK_SHIFT,
              top: 0,
              width: MARK_PT,
              height: MARK_PT,
              backgroundColor: color.brand,
            },
            markMove,
          ]}
        >
          <Image source={mark} style={{ width: MARK_PT, height: MARK_PT }} contentFit="contain" />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
