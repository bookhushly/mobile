import { View } from 'react-native';

import type { Fact } from '@/features/customer/domain/listingDetail';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Text } from '@/shared/ui';

type Props = { facts: readonly Fact[]; testID?: string };

// Spec §3 apartment key facts: label over value, two to a row. Unknown facts are already left out.
export function FactsGrid({ facts, testID }: Props) {
  if (facts.length === 0) return null;
  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 }}>
      {facts.map((f) => (
        <View
          key={f.label}
          accessible
          accessibilityLabel={`${f.label}, ${f.value}`}
          style={{
            flexGrow: 1,
            flexBasis: '45%',
            gap: space.s1,
            padding: space.s4,
            borderRadius: radius.r3,
            borderWidth: borderWidth.hairline,
            borderColor: color.border,
            backgroundColor: color.surface,
          }}
        >
          <Text variant="labelSm" tone="textSecondary">
            {f.label}
          </Text>
          <Text variant="bodyStrong">{f.value}</Text>
        </View>
      ))}
    </View>
  );
}
