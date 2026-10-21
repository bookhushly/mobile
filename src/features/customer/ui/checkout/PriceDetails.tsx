import { View } from 'react-native';

import { payableTotal, type PriceLine } from '@/features/customer/domain/checkout/reviewText';
import { spokenNaira } from '@/features/customer/ui/PriceTag';
import { borderWidth, color, space } from '@/shared/theme';
import { Card, formatNaira, Text } from '@/shared/ui';

type Props = {
  /** The cached breakdown (P28); null shows the total-only layout. */
  lines: readonly PriceLine[] | null;
  /** Hotels: a discount already inside the room line. */
  discountIncluded: number | null;
  total: number;
  /** The service charge estimate, when there is one. */
  charge: PriceLine | null;
  /** The charge couldn't be read: the total is shown without it, with a line saying so. */
  chargeUnknown?: boolean;
  /** The charge is still being read (offline or retrying). */
  chargeChecking?: boolean;
  testID?: string;
};

function Row({ line, strong }: { line: PriceLine; strong?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={`${line.label}, ${spokenNaira(line.amount)}`}
      style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.s4 }}
    >
      <Text
        variant={strong ? 'bodyStrong' : 'body'}
        tone={strong ? 'textPrimary' : 'textSecondary'}
      >
        {line.label}
      </Text>
      <Text variant={strong ? 'bodyStrong' : 'body'} tabular>
        {formatNaira(line.amount)}
      </Text>
    </View>
  );
}

// Mobbin §3 (Airbnb, Tripadvisor): Price details, server numbers only, a bold Total last.
export function PriceDetails({
  lines,
  discountIncluded,
  total,
  charge,
  chargeUnknown = false,
  chargeChecking = false,
  testID,
}: Props) {
  const payable = payableTotal(total, charge);
  return (
    <Card>
      <View style={{ gap: space.s3 }} testID={testID}>
        <Text variant="headline" accessibilityRole="header">
          Price details
        </Text>
        {lines === null ? (
          <Row line={{ label: 'Booking total', amount: total }} />
        ) : (
          lines.map((l) => <Row key={l.label} line={l} />)
        )}
        {discountIncluded !== null ? (
          <Text variant="bodySm" tone="textSecondary">
            {`Includes a ${formatNaira(discountIncluded)} discount`}
          </Text>
        ) : null}
        {charge !== null ? (
          <Row line={{ label: `${charge.label} (estimate)`, amount: charge.amount }} />
        ) : null}
        <View
          style={{
            borderTopWidth: borderWidth.hairline,
            borderTopColor: color.border,
            paddingTop: space.s3,
          }}
        >
          <Row line={{ label: 'Total', amount: payable }} strong />
        </View>
        {chargeChecking ? (
          <Text variant="bodySm" tone="textSecondary" testID="charge-checking">
            Checking the service charge…
          </Text>
        ) : null}
        {chargeUnknown ? (
          <Text variant="bodySm" tone="textSecondary" testID="charge-unknown">
            plus any service charge shown on Paystack
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
