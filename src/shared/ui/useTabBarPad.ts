import { useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { space, typeVariants } from '@/shared/theme';

/** The router's tab bar is UIKit's 49 pt plus the bottom safe area. */
const UIKIT_TAB_BAR = 49;

/**
 * Room under the tab labels on phones with a home button (iPhone SE, 8): no bottom safe area, so
 * the labels lost their descenders at the screen edge, more so with larger text (device check,
 * 2026-11-28). The room grows with the label's own line as Dynamic Type scales it, up to the
 * label's cap. Phones with a home indicator keep the router's sizing: the labels use the inset.
 */
export function useTabBarPad(
  labelMaxScale: number,
): { height: number; paddingBottom: number } | null {
  // The context, not useSafeAreaInsets: with no provider (some screen tests) there is nothing to fix.
  const insets = useContext(SafeAreaInsetsContext);
  const { fontScale } = useWindowDimensions();
  if (insets === null || insets.bottom > 0) return null;
  const scale = Math.min(Math.max(fontScale, 1), labelMaxScale);
  const grown = Math.ceil(typeVariants.labelSm.lineHeight * (scale - 1));
  const pad = space.s3 + grown;
  return { height: UIKIT_TAB_BAR + pad, paddingBottom: pad };
}
