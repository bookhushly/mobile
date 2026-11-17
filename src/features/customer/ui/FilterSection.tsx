import type { ReactNode } from 'react';
import { View } from 'react-native';

import { borderWidth, color, space } from '@/shared/theme';
import { Text } from '@/shared/ui';

type Props = { title: string; subtitle?: string; children: ReactNode };

// Airbnb's filter sections: a title (and a grey line under it), the controls, a hairline between.
export function FilterSection({ title, subtitle, children }: Props) {
  return (
    <View
      style={{
        gap: space.s4,
        paddingBottom: space.s7,
        borderBottomWidth: borderWidth.hairline,
        borderBottomColor: color.border,
      }}
    >
      <View style={{ gap: space.s1 }}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {subtitle !== undefined ? (
          <Text variant="bodySm" tone="textSecondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
