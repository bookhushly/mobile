import {
  ArrowLeft,
  Ban,
  CircleX,
  Clock,
  Hourglass,
  TimerOff,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { createFeedback } from '@/shared/platform/feedback';
import type { ColorRole } from '@/shared/theme';
import { space } from '@/shared/theme';
import { Button, Header, Icon, IconButton, Screen, Spinner, Text } from '@/shared/ui';

export type PayStateKind =
  | 'checking'
  | 'failed'
  | 'unconfirmed'
  | 'stillChecking'
  | 'holdEnded'
  | 'pendingElsewhere'
  | 'cancelled';

type Props = {
  state: PayStateKind;
  /** Failed: back to Review, where Pay needs a fresh tap (A1d). */
  onTryAgain: () => void;
  onCheckAgain: () => void;
  onBookings: () => void;
  onStartAgain: () => void;
  /** Not while checking: nothing leaves then (P6). */
  onBack: () => void;
};

type Look = { icon: LucideIcon; tone: ColorRole; title: string; message: string | null };

// Spec P14, P26, P8 words; Mobbin §4: plain words, one main action, no upsells. A failure never
// says "you weren't charged": a transfer or USSD can still land (A1c).
const LOOK: Record<Exclude<PayStateKind, 'checking'>, Look> = {
  failed: {
    icon: CircleX,
    tone: 'dangerFg',
    title: 'Payment didn’t go through.',
    message: 'If money left your account, it’ll be confirmed or refunded — check Bookings.',
  },
  // A1b: a failure for a payment started under 15 min ago is not final.
  unconfirmed: {
    icon: Clock,
    tone: 'neutralFg',
    title: 'We couldn’t confirm this payment yet.',
    message:
      'If you paid by bank transfer or USSD it can take a few minutes. Check Bookings before paying again.',
  },
  cancelled: {
    icon: Ban,
    tone: 'neutralFg',
    title: 'This booking was cancelled.',
    message: null,
  },
  stillChecking: {
    icon: Clock,
    tone: 'neutralFg',
    title: 'We’re still checking. If you paid, it’ll show in Bookings shortly.',
    message: null,
  },
  holdEnded: {
    icon: TimerOff,
    tone: 'warningFg',
    title: 'This hold has ended. Start again to book these dates.',
    message: null,
  },
  pendingElsewhere: {
    icon: Hourglass,
    tone: 'neutralFg',
    title: 'A payment for this booking is still open.',
    message: 'If you didn’t finish it, try again in a few minutes.',
  },
};

function Actions({ state, onTryAgain, onCheckAgain, onBookings, onStartAgain }: Props) {
  switch (state) {
    case 'checking':
      return null;
    case 'failed':
      return (
        <>
          <Button label="Try again" onPress={onTryAgain} />
          <Button label="Go to Bookings" variant="secondary" onPress={onBookings} />
        </>
      );
    case 'unconfirmed':
    case 'stillChecking':
      return (
        <>
          <Button label="Check again" onPress={onCheckAgain} />
          <Button label="Go to Bookings" variant="secondary" onPress={onBookings} />
        </>
      );
    case 'holdEnded':
      return <Button label="Start again" onPress={onStartAgain} />;
    case 'pendingElsewhere':
      return <Button label="Check again" onPress={onCheckAgain} />;
    case 'cancelled':
      return <Button label="Go to Bookings" onPress={onBookings} />;
  }
}

// Every step after Pay that isn't Review or Done. Checking has nothing to press (P6).
export function PayStates(props: Props) {
  const { state } = props;
  // Haptic only, never the gate's sounds (not loaded).
  const [feedback] = useState(createFeedback);
  // StrictMode (dev) runs mount effects twice; the ref keeps it to one buzz per failure.
  const buzzed = useRef<PayStateKind | null>(null);
  useEffect(() => {
    if (state !== 'failed' || buzzed.current === state) return;
    buzzed.current = state;
    feedback.cue('error');
  }, [state, feedback]);

  const footer =
    state === 'checking' ? undefined : (
      <View style={{ gap: space.s3 }} testID="pay-state-actions">
        <Actions {...props} />
      </View>
    );
  return (
    <Screen
      header={
        <Header
          title="Payment"
          left={
            state === 'checking' ? undefined : (
              <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={props.onBack} />
            )
          }
        />
      }
      footer={footer}
    >
      <View style={{ gap: space.s4, paddingTop: space.s9 }} testID={`pay-${state}`}>
        {state === 'checking' ? (
          <>
            <Spinner tone="textSecondary" />
            <Text variant="titleLg" accessibilityLiveRegion="polite">
              Checking your payment
            </Text>
            <Text variant="body" tone="textSecondary">
              This can take a few minutes
            </Text>
          </>
        ) : (
          <>
            <Icon as={LOOK[state].icon} size="lg" tone={LOOK[state].tone} />
            <Text variant="titleLg" accessibilityLiveRegion="polite">
              {LOOK[state].title}
            </Text>
            {LOOK[state].message !== null ? (
              <Text variant="body" tone="textSecondary">
                {LOOK[state].message}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}
