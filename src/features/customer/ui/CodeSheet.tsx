import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color, layout, space } from '@/shared/theme';
import { Header, IconButton, useWide } from '@/shared/ui';

type Props = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Under the header (saved-data note). */
  notice?: ReactNode;
  children: ReactNode;
};

// C10/C11: a bare white full-screen sheet for codes shown at a door or desk; nothing else on it.
export function CodeSheet({ title, subtitle, onClose, notice, children }: Props) {
  const gutter = useWide() ? layout.tabletGutter : layout.phoneGutter;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }}>
      <View style={{ paddingHorizontal: gutter, gap: space.s3 }}>
        <Header
          title={title}
          subtitle={subtitle}
          left={<IconButton icon={X} accessibilityLabel="Close" onPress={onClose} />}
        />
        {notice}
      </View>
      {children}
    </SafeAreaView>
  );
}
