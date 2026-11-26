import type { ReactNode } from 'react';
import { TripLinkField } from '@/features/customer/ui/trips/TripLinkField';
import { useShallow } from 'zustand/react/shallow';
import { View } from 'react-native';

import {
  STEPS,
  stepReady,
  submitBody,
  tripDays,
  type CarDraft,
  type Step,
} from '@/features/customer/domain/carRental/carRequest';
import { CAR_KIND } from '@/features/customer/hooks/rfqKinds';
import { useCarDraft } from '@/features/customer/hooks/useCarDraft';
import { useCarPriceGuide } from '@/features/customer/hooks/useCarRequests';
import { useRequestSender } from '@/features/customer/hooks/useRequestSender';
import { FlowFooter } from '@/features/customer/ui/car/FlowFooter';
import { CarStep } from '@/features/customer/ui/car/CarStep';
import { CheckStep } from '@/features/customer/ui/car/CheckStep';
import { DetailsStep } from '@/features/customer/ui/car/DetailsStep';
import { HowStep } from '@/features/customer/ui/car/HowStep';
import { StepHeader } from '@/features/customer/ui/car/StepHeader';
import { PickupTimeChips, WhenStep } from '@/features/customer/ui/car/WhenStep';
import { WhereStep } from '@/features/customer/ui/car/WhereStep';
import { daysWords } from '@/features/customer/ui/car/carWords';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Screen, Stack, Text } from '@/shared/ui';

type Props = {
  /** '' when signed out: every step works; sending asks for sign-in first. */
  userId: string;
  email: string;
  onClose: () => void;
  onSent: (requestId: string) => void;
};

const TITLE: Record<Step, { title: string; note?: string }> = {
  where: { title: 'Where should they meet you?' },
  when: { title: 'When do you need it?' },
  how: { title: 'How will you travel?' },
  car: {
    title: 'What kind of car?',
    note: 'Optional. Choose one, or let companies quote any car.',
  },
  details: { title: 'A little more about the trip', note: 'Optional.' },
  check: { title: 'Check your request' },
};

// Design 1A: six short steps, one question each, a round back button and one full-width Next.
export function CarRequestFlowScreen({ userId, email, onClose, onSent }: Props) {
  // Selected, not the whole store (standards §3.4); the actions are stable.
  const { draft, step, patch, next, back, edit } = useCarDraft(
    useShallow((st) => ({
      draft: st.draft,
      step: st.step,
      patch: st.patch,
      next: st.next,
      back: st.back,
      edit: st.edit,
    })),
  );
  const today = lagosToday(clock.serverNow());
  const sender = useRequestSender({
    kind: CAR_KIND,
    store: useCarDraft,
    userId,
    email,
    firstStep: 'where',
    checkStep: 'check',
    bodyOf: (d: CarDraft, c) => submitBody(d, c, today),
    onSent,
  });
  const guide = useCarPriceGuide(draft.pickupState, draft.vehicleType, draft.pricingModel);
  const index = STEPS.indexOf(step);
  const ready = stepReady(step, draft, today);

  const { title, note } = TITLE[step];
  const heading = (
    <View style={{ gap: space.s2 }}>
      <Text variant="titleLg" accessibilityRole="header">
        {title}
      </Text>
      {note === undefined ? null : (
        <Text variant="bodySm" tone="textSecondary">
          {note}
        </Text>
      )}
    </View>
  );

  let body: ReactNode;
  switch (step) {
    case 'where':
      body = <WhereStep draft={draft} onChange={patch} />;
      break;
    case 'when':
      body = <WhenStep draft={draft} today={today} title={heading} onChange={patch} />;
      break;
    case 'how':
      body = <HowStep draft={draft} onChange={patch} />;
      break;
    case 'car':
      body = <CarStep draft={draft} onChange={patch} />;
      break;
    case 'details':
      body = <DetailsStep draft={draft} onChange={patch} />;
      break;
    case 'check':
      body = (
        <Stack gap="s6">
          <CheckStep
            draft={draft}
            guide={guide}
            askPhone={sender.askPhone}
            phone={sender.typedPhone}
            phoneError={sender.phoneError}
            onPhone={sender.setTypedPhone}
            askName={sender.askName}
            name={sender.typedName}
            nameError={sender.nameError}
            onName={sender.setTypedName}
            onChange={patch}
            onEdit={edit}
          />
        </Stack>
      );
      break;
  }

  const days = tripDays(draft);
  const label =
    step === 'check'
      ? 'Ask for quotes'
      : step === 'when' && days > 0
        ? `Next · ${daysWords(days)}`
        : 'Next';

  return (
    <Screen
      scroll={step !== 'when'}
      header={<StepHeader step={index + 1} of={STEPS.length} onBack={back} onClose={onClose} />}
      footer={
        <FlowFooter
          above={
            step === 'when' ? (
              <PickupTimeChips
                value={draft.pickupTime}
                onChange={(t) => {
                  patch({ pickupTime: t });
                }}
              />
            ) : null
          }
          detailsUnknown={sender.detailsUnknown}
          profileLoading={sender.profileLoading}
          onRetryProfile={sender.retryProfile}
          problem={sender.problem}
          label={label}
          disabled={!ready || sender.sending}
          loading={sender.sending}
          onPress={() => {
            if (step === 'check') void sender.sendNow();
            else next();
          }}
          testID="car-next"
        />
      }
    >
      <View style={{ flex: step === 'when' ? 1 : undefined, gap: space.s6, paddingTop: space.s5 }}>
        {step === 'when' ? null : heading}
        {body}
        {step === 'check' && userId !== '' ? (
          <TripLinkField userId={userId} type="car_rental" />
        ) : null}
      </View>
    </Screen>
  );
}
