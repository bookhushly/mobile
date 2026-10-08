import type { ReactNode } from 'react';
import { View } from 'react-native';

import { space } from '@/shared/theme';

import { Text } from './Text';

type Props = { title: string; subtitle?: string; left?: ReactNode; right?: ReactNode };

export function Header({ title, subtitle, left, right }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 56 }}>
      {left}
      <View style={{ flex: 1, gap: space.s1 }}>
        <Text variant="title" accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {subtitle !== undefined ? (
          <Text variant="bodySm" tone="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
