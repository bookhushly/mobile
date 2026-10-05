import type { ReactNode } from 'react';
import { Text as RNText, type StyleProp, type TextStyle } from 'react-native';

import { color, typeVariants, type ColorRole, type Variant } from '@/shared/theme';
import { fontFamily } from '@/shared/theme/fonts';

type Props = {
  variant?: Variant;
  tone?: ColorRole;
  tabular?: boolean;
  align?: TextStyle['textAlign'];
  numberOfLines?: number;
  testID?: string;
  accessibilityRole?: 'header' | 'link' | 'text' | 'alert';
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
  /** Overrides the variant's Dynamic Type cap (gate results use 1 so actions never leave the screen). */
  maxScale?: number;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
};

export function Text({
  variant = 'body',
  tone = 'textPrimary',
  tabular,
  align,
  numberOfLines,
  testID,
  accessibilityRole,
  accessibilityLiveRegion,
  maxScale,
  style,
  children,
}: Props) {
  const v = typeVariants[variant];
  return (
    <RNText
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLiveRegion={accessibilityLiveRegion}
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={maxScale ?? v.maxScale}
      style={[
        {
          fontFamily: fontFamily(v.font, v.weight),
          fontSize: v.size,
          lineHeight: v.lineHeight,
          letterSpacing: v.letterSpacing,
          color: color[tone],
          textAlign: align,
        },
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
