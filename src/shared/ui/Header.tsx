import type { ReactNode } from 'react';
import { View } from 'react-native';

import { space } from '@/shared/theme';

import { useDensity, useDensityName } from './DensityProvider';
import { Text } from './Text';

type Props = { title: string; subtitle?: string; left?: ReactNode; right?: ReactNode };

// Two shapes, as Expedia and Airbnb use them: a top-level page (no back button) leads with a large
// title; an inner page keeps a compact title beside its back button so the content leads.
export function Header({ title, subtitle, left, right }: Props) {
  const d = useDensity();
  const customer = useDensityName() === 'customer';
  const top = left === undefined && customer;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: top ? 'flex-end' : 'center',
        gap: space.s3,
        minHeight: d.rowMin,
        paddingTop: top ? space.s5 : 0,
        paddingBottom: top ? space.s3 : 0,
      }}
    >
      {left}
      <View style={{ flex: 1, gap: space.s1 }}>
        {/* No title (a back button over a page with its own heading): no empty heading for readers. */}
        {title === '' ? null : (
          <Text
            variant={top ? 'displaySm' : 'headline'}
            accessibilityRole="header"
            numberOfLines={1}
          >
            {title}
          </Text>
        )}
        {subtitle !== undefined ? (
          <Text variant="bodySm" tone="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
