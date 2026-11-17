import type { LucideIcon } from 'lucide-react-native';
import type { ColorValue } from 'react-native';
import { View } from 'react-native';

import { color, radius, space } from '@/shared/theme';

// The indicator bar's size: short and slim, a mark rather than a fill (Expedia's active tab).
const BAR_WIDTH = space.s7;
const BAR_HEIGHT = space.s2;

type Props = { icon: LucideIcon; focused: boolean; tint: ColorValue; size: number };

// A tab icon with a bar above it when active: the non-colour cue for the selected tab (WCAG 1.4.1),
// replacing the violet wash behind it, so violet stays a mark and never a fill.
export function DeskTabIcon({ icon: Glyph, focused, tint, size }: Props) {
  return (
    <View style={{ alignItems: 'center', gap: space.s2 }}>
      <View
        testID={focused ? 'tab-indicator' : undefined}
        style={{
          width: BAR_WIDTH,
          height: BAR_HEIGHT,
          borderRadius: radius.rFull,
          backgroundColor: focused ? color.actionPressed : 'transparent',
        }}
      />
      <Glyph color={tint} size={size} />
    </View>
  );
}
