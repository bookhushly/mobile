import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color, space } from '@/shared/theme';

export function Screen({ children, scroll }: { children: ReactNode; scroll?: boolean }) {
  const body = { paddingHorizontal: space.s5, paddingVertical: space.s5, gap: space.s5 };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.canvas }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={body}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, body]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
