import { ArrowLeft } from 'lucide-react-native';
import { View } from 'react-native';

import {
  payableTotal,
  type PriceLine,
  type ReviewSummary,
} from '@/features/customer/domain/checkout/reviewText';
import { BookingSummary } from '@/features/customer/ui/BookingSummary';
import { DetailRows } from '@/features/customer/ui/DetailRows';
import { openWeb, WEB_DASHBOARD } from '@/features/customer/ui/links';
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
  /** The service charge couldn't be read: the total is shown without it. */
  chargeUnknown: boolean;
  /** CHECKOUT_PAYMENTS_ENABLED: off keeps the 4a web hand-off in place of Pay. */
  payInApp: boolean;
  /** A start error's words, and what its button does (none for a refusal). */
  startError: { words: string; action: { label: string; onPress: () => void } | null } | null;
  onPay: () => void;
  /** Cancel booking, when leaving would cancel it (P7); null offers Not now (back). */
  onCancel: (() => void) | null;
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
  chargeUnknown,
  payInApp,
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
      {payInApp ? (
        <>
          {startError !== null ? (
            <Banner
              tone="neutral"
              message={startError.words}
              {...(startError.action !== null ? { action: startError.action } : {})}
              testID="pay-start-error"
            />
          ) : null}
          <Text variant="bodySm" tone="textSecondary">
            You’ll pay on Paystack’s secure page. We confirm the payment with Paystack before
            booking it.
          </Text>
          <Button
            label={`Pay ${formatNaira(payable)}`}
            loading={starting}
            disabled={!canPay}
            onPress={onPay}
            testID="pay-button"
          />
        </>
      ) : (
        // P2: payments switched off: the 4a hand-off, as on the booking details screen.
        <Banner
          tone="info"
          message="Finish paying on bookhushly.com"
          action={{
            label: 'Pay on bookhushly.com',
            onPress: () => {
              openWeb(WEB_DASHBOARD);
            },
          }}
          testID="pay-on-web"
        />
      )}
      {onCancel !== null ? (
        <Button
          label="Cancel booking"
          variant="ghost"
          disabled={starting}
          onPress={onCancel}
          testID="pay-cancel"
        />
      ) : (
        <Button
          label="Not now"
          variant="secondary"
          disabled={starting}
          onPress={onBack}
          testID="pay-not-now"
        />
      )}
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
        chargeUnknown={chargeUnknown}
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
