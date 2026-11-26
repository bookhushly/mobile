import type { ReactNode } from 'react';
import { TripLinkField } from '@/features/customer/ui/trips/TripLinkField';
import { View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import {
  LOGISTICS_STEPS,
  logisticsBody,
  logisticsStepReady,
  type LogisticsDraft,
  type LogisticsStep,
} from '@/features/customer/domain/logistics/logisticsRequest';
import { LOGISTICS_KIND } from '@/features/customer/hooks/rfqKinds';
import { useLogisticsPriceGuide } from '@/features/customer/hooks/useLogistics';
import { useLogisticsDraft } from '@/features/customer/hooks/useLogisticsDraft';
import { useRequestSender } from '@/features/customer/hooks/useRequestSender';
import { FlowFooter } from '@/features/customer/ui/car/FlowFooter';
import { StepHeader } from '@/features/customer/ui/car/StepHeader';
import { PickupTimeChips } from '@/features/customer/ui/car/WhenStep';
import { ItemStep } from '@/features/customer/ui/logistics/ItemStep';
import { LogisticsCheckStep } from '@/features/customer/ui/logistics/LogisticsCheckStep';
import { LogisticsWhenStep } from '@/features/customer/ui/logistics/LogisticsWhenStep';
import { PlaceStep } from '@/features/customer/ui/logistics/PlaceStep';
import { ServiceStep } from '@/features/customer/ui/logistics/ServiceStep';
import { VehicleStep } from '@/features/customer/ui/logistics/VehicleStep';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Screen, Text } from '@/shared/ui';

type Props = {
  /** '' when signed out: every step works; sending asks for sign-in first. */
  userId: string;
  email: string;
  onClose: () => void;
  onSent: (requestId: string) => void;
};

const TITLE: Record<LogisticsStep, { title: string; note?: string }> = {
  service: { title: 'What do you need moved?' },
  pickup: { title: 'Where do they pick it up?' },
  dropoff: { title: 'Where is it going?' },
  when: { title: 'When should they collect it?' },
  item: { title: 'What are you sending?' },
  vehicle: {
    title: 'What should carry it?',
    note: 'Optional. Choose one, or let the company choose.',
  },
  check: { title: 'Check your request' },
};

// Design L1 (owner's pick A, 2026-11-23): seven short steps, the car rental pattern.
export function LogisticsFlowScreen({ userId, email, onClose, onSent }: Props) {
  const { draft, step, patch, next, back, edit } = useLogisticsDraft(
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
    kind: LOGISTICS_KIND,
    store: useLogisticsDraft,
    userId,
    email,
    firstStep: 'service',
    checkStep: 'check',
    bodyOf: (d: LogisticsDraft, c) => logisticsBody(d, c, today),
    onSent,
  });
  const guide = useLogisticsPriceGuide(draft.pickup.state, draft.vehicleType);
  const index = LOGISTICS_STEPS.indexOf(step);
  const ready = logisticsStepReady(step, draft, today);

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
    case 'service':
      body = <ServiceStep draft={draft} onChange={patch} />;
      break;
    case 'pickup':
      body = <PlaceStep draft={draft} end="pickup" onChange={patch} />;
      break;
    case 'dropoff':
      body = <PlaceStep draft={draft} end="dropoff" onChange={patch} />;
      break;
    case 'when':
      body = <LogisticsWhenStep draft={draft} today={today} title={heading} onChange={patch} />;
      break;
    case 'item':
      body = <ItemStep draft={draft} onChange={patch} />;
      break;
    case 'vehicle':
      body = <VehicleStep draft={draft} onChange={patch} />;
      break;
    case 'check':
      body = (
        <LogisticsCheckStep
          draft={draft}
          guide={guide}
          askName={sender.askName}
          name={sender.typedName}
          nameError={sender.nameError}
          onName={sender.setTypedName}
          askPhone={sender.askPhone}
          phone={sender.typedPhone}
          phoneError={sender.phoneError}
          onPhone={sender.setTypedPhone}
          onEdit={edit}
        />
      );
      break;
  }

  return (
    <Screen
      scroll={step !== 'when'}
      header={
        <StepHeader step={index + 1} of={LOGISTICS_STEPS.length} onBack={back} onClose={onClose} />
      }
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
          label={step === 'check' ? 'Ask for quotes' : 'Next'}
          disabled={!ready || sender.sending}
          loading={sender.sending}
          onPress={() => {
            if (step === 'check') void sender.sendNow();
            else next();
          }}
          testID="logistics-next"
        />
      }
    >
      <View style={{ flex: step === 'when' ? 1 : undefined, gap: space.s6, paddingTop: space.s5 }}>
        {step === 'when' ? null : heading}
        {body}
        {step === 'check' && userId !== '' ? (
          <TripLinkField userId={userId} type="logistics" />
        ) : null}
      </View>
    </Screen>
  );
}
