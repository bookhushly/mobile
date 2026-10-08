import { useContext, type ReactElement, type ReactNode } from 'react';
import { ScrollView, View, type RefreshControlProps } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';

import { color, layout, space } from '@/shared/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  header?: ReactNode;
  /** Sticky bottom area (primary action in the thumb zone). */
  footer?: ReactNode;
  bg?: 'canvas' | 'surface';
  refreshControl?: ReactElement<RefreshControlProps>;
};

export function Screen({ children, scroll, header, footer, bg = 'canvas', refreshControl }: Props) {
  // Context, not the hook: the hook throws without a provider, which bare unit renders lack.
  const insets = useContext(SafeAreaInsetsContext) ?? { bottom: 0 };
  const body = {
    paddingHorizontal: space.s5,
    paddingVertical: space.s5,
    gap: space.s5,
    width: '100%' as const,
    maxWidth: layout.formMaxWidth,
    alignSelf: 'center' as const,
  };
  return (
    <SafeAreaView
      edges={footer !== undefined ? ['top'] : ['top', 'bottom']}
      style={{ flex: 1, backgroundColor: color[bg] }}
    >
      {header !== undefined ? (
        <View style={{ paddingHorizontal: space.s5 }}>{header}</View>
      ) : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={body}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, body]}>{children}</View>
      )}
      {footer !== undefined ? (
        <View
          style={{
            paddingHorizontal: space.s5,
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
