import { X } from 'lucide-react-native';
import { useContext, type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

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
  // Insets from the app's provider: a native full-screen modal's own SafeAreaView reported no top
  // inset on iOS, which put the title under the status bar (seen on the simulator, 2026-11-14).
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0 };
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.surface,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <View style={{ paddingHorizontal: gutter, gap: space.s3 }}>
        <Header
          title={title}
          subtitle={subtitle}
          left={<IconButton icon={X} accessibilityLabel="Close" onPress={onClose} />}
        />
        {notice}
      </View>
      {children}
    </View>
  );
}
