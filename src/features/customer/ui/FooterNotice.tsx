import type { ReactNode } from 'react';
import { View } from 'react-native';

import { space } from '@/shared/theme';

type Props = { children: ReactNode; testID?: string };

// Final UX review U1: a note (Undo, the one-time sign-in note) floats just above the sticky
// footer instead of growing it, so the price and the button never jump. Its parent has no
// padding, so the edges line up with the footer row whatever the layout engine's rule.
export function FooterNotice({ children, testID = 'footer-notice' }: Props) {
  return (
    <View
      testID={testID}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: '100%',
        paddingBottom: space.s3,
      }}
    >
      {children}
    </View>
  );
}
