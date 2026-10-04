import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import {
  color,
  radius,
  space,
  type RadiusKey,
  type SpaceKey,
  type SurfaceRole,
} from '@/shared/theme';

export type BoxProps = {
  p?: SpaceKey;
  px?: SpaceKey;
  py?: SpaceKey;
  gap?: SpaceKey;
  bg?: SurfaceRole;
  rounded?: RadiusKey;
  border?: boolean;
  flex?: number;
  testID?: string;
  children?: ReactNode;
  style?: ViewStyle;
};

export function Box({
  p,
  px,
  py,
  gap,
  bg,
  rounded,
  border,
  flex,
  testID,
  children,
  style,
}: BoxProps) {
  return (
    <View
      testID={testID}
      style={[
        {
          padding: p ? space[p] : undefined,
          paddingHorizontal: px ? space[px] : undefined,
          paddingVertical: py ? space[py] : undefined,
          gap: gap ? space[gap] : undefined,
          backgroundColor: bg ? color[bg] : undefined,
          borderRadius: rounded ? radius[rounded] : undefined,
          borderWidth: border ? 1 : undefined,
          borderColor: border ? color.border : undefined,
          flex,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
