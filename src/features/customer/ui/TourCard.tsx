import type { ReactNode } from 'react';
import { View } from 'react-native';

import { color, elevation, radius, space } from '@/shared/theme';

/** The white card the tour's panel pieces sit on: lifted, since it floats over the panel. */
export function TourCard({ children, pad = true }: { children: ReactNode; pad?: boolean }) {
  return (
    <View
      style={[
        {
          backgroundColor: color.surface,
          borderRadius: radius.r4,
          padding: pad ? space.s4 : space.s2,
          gap: space.s2,
        },
        elevation.e3,
      ]}
    >
      {children}
    </View>
  );
}
