import { View } from 'react-native';

import { borderWidth, color, radius, space } from '@/shared/theme';
import { formatNaira, SkeletonRows, Text } from '@/shared/ui';

type Props = {
  /** Undefined while it loads; null when it can't be known yet (no past job to read it from). */
  feeRate: number | null | undefined;
  /** The fee and what the vendor keeps, once the price is valid. */
  split: { fee: number; receive: number } | null;
};

/** Bookhushly's fee and what the vendor receives, under the price as they type it. */
export function FeeBreakdown({ feeRate, split }: Props) {
  return (
    <View
      style={{
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
        borderRadius: radius.r4,
        paddingHorizontal: space.s5,
      }}
    >
      {feeRate === undefined ? (
        <SkeletonRows count={2} />
      ) : feeRate === null ? (
        <Text variant="caption" tone="textSecondary" style={{ paddingVertical: space.s4 }}>
          Bookhushly’s fee comes off this price. You’ll see what you receive on the job once the
          customer chooses you.
        </Text>
      ) : (
        <>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: space.s4,
            }}
          >
            <Text variant="caption" tone="textSecondary">
              {`Bookhushly fee (${String(Math.round(feeRate * 100))}%)`}
            </Text>
            <Text variant="caption" tone="textSecondary" tabular>
              {split === null ? '–' : `−${formatNaira(split.fee)}`}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: space.s4,
              borderTopWidth: borderWidth.hairline,
              borderTopColor: color.border,
            }}
          >
            <Text variant="label">You’ll receive</Text>
            <Text variant="label" tabular testID="vendor-quote-receive">
              {split === null ? '–' : formatNaira(split.receive)}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}
