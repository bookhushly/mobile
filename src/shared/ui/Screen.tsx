import { StatusBar } from 'expo-status-bar';
import {
  cloneElement,
  useContext,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { ScrollView, View, type RefreshControlProps } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';

import { borderWidth, color, layout, space } from '@/shared/theme';

import { useDensityName } from './DensityProvider';
import { refreshColors } from './refreshColors';
import { useWide } from './useWide';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  header?: ReactNode;
  /** Sticky bottom area (primary action in the thumb zone). */
  footer?: ReactNode;
  bg?: 'canvas' | 'surface';
  refreshControl?: ReactElement<RefreshControlProps>;
  /** `panel`: the tablet two-pane width (960) instead of the form width (640). */
  width?: 'form' | 'panel';
  /** The scroll view, for scrolling to a section (with `scroll`). */
  scrollRef?: Ref<ScrollView>;
  /**
   * The header floats over the content, which starts under the status bar (Airbnb and Luma
   * listing pages: the photo runs to the top edge). The first child supplies its own top space.
   * Once the page has scrolled past `overlayUntil`, a white bar fades in behind the header.
   */
  overlayHeader?: boolean;
  overlayUntil?: number;
};

// About a photo's height: past it the floating buttons would sit on the page's text.
const OVERLAY_UNTIL = 240;

export function Screen({
  children,
  scroll,
  header,
  footer,
  bg,
  refreshControl,
  width = 'form',
  scrollRef,
  overlayHeader = false,
  overlayUntil = OVERLAY_UNTIL,
}: Props) {
  const [solid, setSolid] = useState(false);
  // Context, not the hook: the hook throws without a provider, which bare unit renders lack.
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0 };
  // DESIGN_SYSTEM §2: 16 pt side gutters on phones, 24 on tablets.
  const gutter = useWide() ? layout.tabletGutter : layout.phoneGutter;
  // Customers get white pages (Expedia, Airbnb: cards sit on white with a hairline); staff tools
  // keep the grey canvas that separates dense panels.
  const densityName = useDensityName();
  const page = bg ?? (densityName === 'customer' ? 'surface' : 'canvas');
  const refresh =
    refreshControl === undefined
      ? undefined
      : cloneElement(refreshControl, {
          tintColor: refreshControl.props.tintColor ?? refreshColors.tintColor,
          colors: refreshControl.props.colors ?? refreshColors.colors,
          progressBackgroundColor:
            refreshControl.props.progressBackgroundColor ?? refreshColors.progressBackgroundColor,
        });
  const body = {
    paddingHorizontal: gutter,
    paddingTop: overlayHeader ? 0 : space.s5,
    paddingBottom: space.s5,
    gap: space.s5,
    width: '100%' as const,
    maxWidth: width === 'panel' ? layout.panelMaxWidth : layout.formMaxWidth,
    alignSelf: 'center' as const,
  };
  const top = overlayHeader ? [] : (['top'] as const);
  return (
    <SafeAreaView
      edges={footer !== undefined ? [...top] : [...top, 'bottom']}
      style={{ flex: 1, backgroundColor: color[page] }}
    >
      {header !== undefined && !overlayHeader ? (
        <View style={{ paddingHorizontal: gutter }}>{header}</View>
      ) : null}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={body}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          refreshControl={refresh}
          {...(overlayHeader
            ? {
                scrollEventThrottle: 32,
                onScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => {
                  const past = e.nativeEvent.contentOffset.y > overlayUntil;
                  if (past !== solid) setSolid(past);
                },
              }
            : {})}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, body]}>{children}</View>
      )}
      {header !== undefined && overlayHeader ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top + space.s2,
            paddingBottom: space.s2,
            paddingHorizontal: gutter,
            backgroundColor: solid ? color.surface : 'transparent',
            borderBottomWidth: solid ? borderWidth.hairline : 0,
            borderBottomColor: color.border,
          }}
        >
          {solid ? <StatusBar style="dark" /> : null}
          {header}
        </View>
      ) : null}
      {footer !== undefined ? (
        <View
          style={{
            paddingHorizontal: gutter,
            paddingTop: space.s3,
            paddingBottom: Math.max(insets.bottom, space.s5),
            gap: space.s3,
          }}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
