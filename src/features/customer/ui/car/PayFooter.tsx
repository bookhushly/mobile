import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { CarPayState } from '@/features/customer/hooks/useCarPayment';
import { formatNaira } from '@/shared/lib/formatNaira';
import { space } from '@/shared/theme';
import { Banner, Button, Text } from '@/shared/ui';

const PAY_WORDS: Partial<Record<CarPayState['kind'], string>> = {
  checking: 'Checking your payment…',
  notYet:
    'Your payment isn’t confirmed yet. Don’t pay again: this page updates when it is. Check again in a minute.',
  failed: 'The payment didn’t go through and you weren’t charged. You can try again.',
};

type Props = {
  state: CarPayState;
  /** The quote plus any service charge. */
  amount: number | null;
  /** How the amount is made up, or that the payment page will say. */
  note: string | null;
  onPay: () => void;
  onCheckAgain: () => void;
  /** Cancel, when it's allowed (never while a payment may be under way). */
  cancel: ReactNode;
};

/** A chosen quote's footer: where the payment stands, the total above (owner's rule: never in
 * the button), then Pay (or Check again). */
export function PayFooter({ state, amount, note, onPay, onCheckAgain, cancel }: Props) {
  const words = state.kind === 'error' ? state.words : PAY_WORDS[state.kind];
  return (
    <View style={{ gap: space.s3 }}>
      {words === undefined ? null : <Banner tone="neutral" message={words} />}
      {amount === null || state.kind === 'notYet' ? null : (
        <View style={{ gap: space.s1 }}>
          <Text variant="title" tabular testID="car-pay-total">
            {formatNaira(amount)}
          </Text>
          {note === null ? null : (
            <Text variant="bodySm" tone="textSecondary">
              {note}
            </Text>
          )}
        </View>
      )}
      {state.kind === 'notYet' ? (
        <Button
          label="Check again"
          variant="secondary"
          onPress={onCheckAgain}
          testID="car-check-again"
        />
      ) : (
        <Button
          label="Pay"
          accessibilityLabel={amount === null ? 'Pay' : `Pay ${formatNaira(amount)}`}
          loading={
            state.kind === 'starting' || state.kind === 'inBrowser' || state.kind === 'checking'
          }
          disabled={state.kind === 'paid'}
          onPress={onPay}
          testID="car-pay"
        />
      )}
      {cancel}
    </View>
  );
}
