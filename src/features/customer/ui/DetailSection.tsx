import type { ReactNode } from 'react';
import { View } from 'react-native';

import { space } from '@/shared/theme';
import { SectionHeader } from '@/shared/ui';

/** A titled block on the listing page; nothing when it has nothing to show. */
export function DetailSection({
  label,
  children,
  testID,
}: {
  label: string;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID} style={{ gap: space.s2 }}>
      <SectionHeader label={label} />
      {children}
    </View>
  );
}
