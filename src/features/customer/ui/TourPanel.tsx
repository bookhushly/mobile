import { useContext } from 'react';
import { View } from 'react-native';
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import type { TourMotion } from '@/features/customer/ui/TourFloat';
import { TourFindScene } from '@/features/customer/ui/TourFindScene';
import { TourPayScene } from '@/features/customer/ui/TourPayScene';
import { TourShowUpScene } from '@/features/customer/ui/TourShowUpScene';
import { color, radius, space } from '@/shared/theme';
import { useDensity } from '@/shared/ui/DensityProvider';

export type TourScene = 'find' | 'pay' | 'showUp';

const SCENES = { find: TourFindScene, pay: TourPayScene, showUp: TourShowUpScene } as const;

type Props = Omit<TourMotion, 'arrived'> & { scene: TourScene };

// The slide counts as arrived once it's this far on screen, so it's already moving as it comes in.
const ARRIVED = 0.65;

/**
 * The top of a tour slide (owner's pick A, after Mindtrip): a soft grey panel, edge to edge and
 * under the status bar, filling the page above the words. The scene is one composed group,
 * centred in the space below Skip, so it holds together on any phone. Decorative: the headline
 * and text below say the same thing, so screen readers skip it.
 */
export function TourPanel({ scene, ...motion }: Props) {
  const Scene = SCENES[scene];
  const { scrollX, index, width } = motion;
  // One check per slide on each scroll frame; its pieces wait on this value alone (perf review).
  const arrived = useSharedValue(0);
  useAnimatedReaction(
    () => Math.abs(scrollX.get() - index * width) < width * ARRIVED,
    (now, before) => {
      if (!now || arrived.get() !== 0) return;
      // No earlier answer: this is the slide the tour opens on.
      arrived.set(before === null ? 2 : 1);
    },
  );
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0 };
  const { minTarget } = useDensity();
  return (
    <View
      testID={`tour-scene-${scene}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        flex: 1,
        backgroundColor: color.canvas,
        borderBottomLeftRadius: radius.r4,
        borderBottomRightRadius: radius.r4,
        overflow: 'hidden',
        // Clear of the status bar and the Skip row (the Screen's floating header).
        paddingTop: insets.top + space.s2 + minTarget,
        paddingBottom: space.s5,
        paddingHorizontal: space.s5,
        justifyContent: 'center',
      }}
    >
      <Scene {...motion} arrived={arrived} />
    </View>
  );
}
