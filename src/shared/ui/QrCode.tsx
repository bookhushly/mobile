import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { qrPath } from '@/shared/lib/qrMatrix';
import { color } from '@/shared/theme';

const QUIET_ZONE = 4;

type Props = {
  value: string;
  size: number;
  accessibilityLabel?: string;
  testID?: string;
};

// Ink on white, level M, 4-module quiet zone (DESIGN_SYSTEM ticket rules). One Path keeps the
// native view count at one however dense the code is, and because the modules are filled as a
// single shape there are no anti-aliasing seams between them. (react-native-svg 15 has no
// shapeRendering prop.)
export function QrCode({ value, size, accessibilityLabel = 'QR code', testID }: Props) {
  const qr = useMemo(() => qrPath(value), [value]);
  const box = qr.size + QUIET_ZONE * 2;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size, backgroundColor: color.surface }}
    >
      <Svg
        testID={testID ? `${testID}-svg` : undefined}
        width={size}
        height={size}
        viewBox={[-QUIET_ZONE, -QUIET_ZONE, box, box].join(' ')}
      >
        <Path testID={testID ? `${testID}-path` : undefined} d={qr.d} fill={color.textPrimary} />
      </Svg>
    </View>
  );
}
