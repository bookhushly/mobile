import { useState } from 'react';
import { View } from 'react-native';

import type { CreateState } from '@/features/customer/hooks/useCreateBooking';
import { RateLimitWait } from '@/features/customer/ui/RateLimitWait';
import { space } from '@/shared/theme';
import { Banner, Button, Text } from '@/shared/ui';

type Props = {
  /** "3 nights · ₦90,000", "2 tickets · Free", or what is still missing. */
  estimate: string;
  /** Why Continue is off ("No rooms left for these dates"); read in place of the estimate. */
  blocked: string | null;
  /** A problem with no field of its own (tickets), shown after Continue. */
  problem: string | null;
  create: CreateState;
  /** The words beside a field already show this refusal. */
  refusalShownAtField: boolean;
  disabled: boolean;
  onContinue: () => void;
  onCheckAgain: () => void;
};

// Spec §5: the sticky footer reads the choice back and holds the one primary action. Create
// answers that belong to no field sit above it (P13; a lost answer is never a refusal, P14).
export function SelectFooter({
  estimate,
  blocked,
  problem,
  create,
  refusalShownAtField,
  disabled,
  onContinue,
  onCheckAgain,
}: Props) {
  const sending =
    create.phase === 'sending' || (create.phase === 'busy' && create.words === undefined);
  const unsure = create.phase === 'unsure';
  // A 429 keeps Continue off until its countdown ends; a new answer starts a new wait.
  const [waitedOut, setWaitedOut] = useState<CreateState | null>(null);
  const waiting = create.phase === 'busy' && create.words !== undefined && waitedOut !== create;
  return (
    <View style={{ gap: space.s3 }} testID="select-footer">
      {unsure ? (
        <Banner
          tone="neutral"
          message="Couldn’t confirm your booking"
          action={{ label: 'Check again', onPress: onCheckAgain }}
          testID="create-unsure"
        />
      ) : null}
      {create.phase === 'busy' && create.words !== undefined ? (
        <View style={{ gap: space.s2 }}>
          <Banner tone="neutral" message={create.words} testID="create-wait" />
          <RateLimitWait
            retryAfterSec={create.waitSeconds ?? null}
            onDone={() => {
              setWaitedOut(create);
            }}
          />
        </View>
      ) : null}
      {create.phase === 'failed' && create.words !== undefined ? (
        <Banner tone="danger" message={create.words} testID="create-failed" />
      ) : null}
      {create.phase === 'refused' && create.words !== undefined && !refusalShownAtField ? (
        <Banner tone="danger" message={create.words} testID="create-refused" />
      ) : null}
      {problem !== null ? (
        <Text
          variant="bodySm"
          tone="dangerFg"
          accessibilityLiveRegion="polite"
          testID="select-problem"
        >
          {problem}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}>
        <View style={{ flex: 1 }}>
          <Text
            variant={blocked !== null ? 'bodySm' : 'bodyStrong'}
            tone={blocked !== null ? 'dangerFg' : 'textPrimary'}
            tabular
            testID="select-estimate"
          >
            {blocked ?? estimate}
          </Text>
        </View>
        <View style={{ flexShrink: 0, maxWidth: '60%' }}>
          <Button
            label="Continue"
            loading={sending}
            disabled={disabled || unsure || waiting || blocked !== null}
            onPress={onContinue}
            testID="select-continue"
          />
        </View>
      </View>
    </View>
  );
}
