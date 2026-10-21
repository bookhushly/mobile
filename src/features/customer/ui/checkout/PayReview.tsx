import { ArrowLeft } from 'lucide-react-native';
import { View } from 'react-native';

import {
  payableTotal,
  type PriceLine,
  type ReviewSummary,
} from '@/features/customer/domain/checkout/reviewText';
import { BookingSummary } from '@/features/customer/ui/BookingSummary';
import { DetailRows } from '@/features/customer/ui/DetailRows';
import { PriceDetails } from '@/features/customer/ui/checkout/PriceDetails';
import { space } from '@/shared/theme';
import { Banner, Button, formatNaira, Header, IconButton, Screen, Text } from '@/shared/ui';

type Props = {
  summary: ReviewSummary;
  /** The guest email the booking was made with (read-only, P16). */
  email: string;
  price: { lines: PriceLine[]; discountIncluded: number | null } | null;
  total: number;
  charge: PriceLine | null;
  /** Stays: "until 7:42 pm"; null for events. */
  holdUntil: string | null;
  starting: boolean;
  canPay: boolean;
  /** A start error's words, and what its button does (none for a refusal). */
  startError: { words: string; action: { label: string; onPress: () => void } | null } | null;
  onPay: () => void;
  onCancel: () => void;
  onBack: () => void;
};

// Spec §5, Mobbin §3: what you're booking → your details → Price details → terms → Pay ₦X.
export function PayReview({
  summary,
  email,
  price,
  total,
  charge,
  holdUntil,
  starting,
  canPay,
  startError,
  onPay,
  onCancel,
  onBack,
}: Props) {
  const payable = payableTotal(total, charge);
  const header = (
    <Header
      title="Review and pay"
      left={
        starting ? undefined : (
          <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />
        )
      }
    />
  );
  const footer = (
    <View style={{ gap: space.s3 }} testID="pay-footer">
      {startError !== null ? (
        <Banner
          tone="neutral"
          message={startError.words}
          {...(startError.action !== null ? { action: startError.action } : {})}
          testID="pay-start-error"
        />
      ) : null}
      <Text variant="bodySm" tone="textSecondary">
        You’ll pay on Paystack’s secure page. We confirm the payment with Paystack before booking
        it.
      </Text>
      <Button
        label={`Pay ${formatNaira(payable)}`}
        loading={starting}
        disabled={!canPay}
        onPress={onPay}
        testID="pay-button"
      />
      <Button
        label="Cancel booking"
        variant="ghost"
        disabled={starting}
        onPress={onCancel}
        testID="pay-cancel"
      />
    </View>
  );
  return (
    <Screen scroll header={header} footer={footer}>
      <BookingSummary title={summary.title} when={summary.when} extra={summary.extra} />
      <View style={{ gap: space.s2 }}>
        <Text variant="headline" accessibilityRole="header">
          Your details
        </Text>
        <DetailRows rows={[{ label: 'Email', value: email }]} testID="pay-details" />
      </View>
      <PriceDetails
        lines={price?.lines ?? null}
        discountIncluded={price?.discountIncluded ?? null}
        total={total}
        charge={charge}
        testID="price-details"
      />
      {holdUntil !== null ? (
        <Text variant="body" tone="textSecondary" testID="pay-hold">
          {`We’re holding this for you until ${holdUntil}`}
        </Text>
      ) : null}
    </Screen>
  );
}
