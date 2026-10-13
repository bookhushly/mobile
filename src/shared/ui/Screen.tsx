import { cloneElement, useContext, type ReactElement, type ReactNode } from 'react';
import { ScrollView, View, type RefreshControlProps } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';

import { color, layout, space } from '@/shared/theme';

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
};

export function Screen({
  children,
  scroll,
  header,
  footer,
  bg = 'canvas',
  refreshControl,
  width = 'form',
}: Props) {
  // Context, not the hook: the hook throws without a provider, which bare unit renders lack.
  const insets = useContext(SafeAreaInsetsContext) ?? { bottom: 0 };
  // DESIGN_SYSTEM §2: 16 pt side gutters on phones, 24 on tablets.
  const gutter = useWide() ? layout.tabletGutter : layout.phoneGutter;
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
    paddingVertical: space.s5,
    gap: space.s5,
    width: '100%' as const,
    maxWidth: width === 'panel' ? layout.panelMaxWidth : layout.formMaxWidth,
    alignSelf: 'center' as const,
  };
  return (
    <SafeAreaView
      edges={footer !== undefined ? ['top'] : ['top', 'bottom']}
      style={{ flex: 1, backgroundColor: color[bg] }}
    >
      {header !== undefined ? <View style={{ paddingHorizontal: gutter }}>{header}</View> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={body}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          refreshControl={refresh}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, body]}>{children}</View>
      )}
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
