import type { ReactNode } from 'react';
import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import {
  suggestName,
  TRIP_STEPS,
  tripStepReady,
  type TripStep,
} from '@/features/customer/domain/trips/trips';
import { CustomerLoadError } from '@/features/customer/hooks/customerKeys';
import { useTripDraft } from '@/features/customer/hooks/useTripDraft';
import { useCreateTrip } from '@/features/customer/hooks/useTrips';
import { StepHeader } from '@/features/customer/ui/car/StepHeader';
import {
  TripNameStep,
  TripServicesStep,
  TripWhenStep,
  TripWhereStep,
} from '@/features/customer/ui/trips/TripSteps';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Banner, Button, Screen, Text } from '@/shared/ui';

type Props = {
  userId: string;
  onClose: () => void;
  onCreated: (tripId: string) => void;
};

const TITLE: Record<TripStep, { title: string; note?: string }> = {
  where: { title: 'Where are you going?', note: 'Optional. You can decide later.' },
  when: { title: 'When is the trip?' },
  services: { title: 'What will you need?', note: 'Pick at least one. You can add more later.' },
  name: { title: 'Name your trip' },
};

// The web's four steps (plan-trip), the request-flow pattern: round back arrow, one primary.
export function TripFlowScreen({ userId, onClose, onCreated }: Props) {
  const { draft, step, patch, next, back, start } = useTripDraft(
    useShallow((s) => ({
      draft: s.draft,
      step: s.step,
      patch: s.patch,
      next: s.next,
      back: s.back,
      start: s.start,
    })),
  );
  const create = useCreateTrip(userId);
  // One id per trip being planned: a retry after a lost answer can't make a second trip.
  const [tripId] = useState(() => Crypto.randomUUID());
  const today = lagosToday(clock.serverNow());
  const index = TRIP_STEPS.indexOf(step);
  const ready = tripStepReady(step, draft);

  // Android back steps back, like the round button; on the first step it leaves.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (useTripDraft.getState().step === 'where') return false;
      useTripDraft.getState().back();
      return true;
    });
    return () => {
      sub.remove();
    };
  }, []);

  const goNext = () => {
    // The web: arriving at the name with none, offer one built from the answers.
    if (step === 'services' && draft.name.trim() === '')
      patch({ name: suggestName(draft.destination, draft.startDate) });
    next();
  };
  const skippable =
    (step === 'where' && draft.destination === null) ||
    (step === 'when' && draft.startDate === null);

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
      body = <TripWhereStep draft={draft} onChange={patch} />;
      break;
    case 'when':
      body = <TripWhenStep draft={draft} today={today} title={heading} onChange={patch} />;
      break;
    case 'services':
      body = <TripServicesStep draft={draft} onChange={patch} />;
      break;
    case 'name':
      body = <TripNameStep draft={draft} onChange={patch} />;
      break;
  }

  return (
    <Screen
      scroll={step !== 'when'}
      header={
        <StepHeader step={index + 1} of={TRIP_STEPS.length} onBack={back} onClose={onClose} />
      }
      footer={
        <View style={{ gap: space.s3 }}>
          {create.isError ? (
            <Banner
              tone="neutral"
              title="We couldn’t save your trip"
              message={
                create.error instanceof CustomerLoadError && create.error.kind === 'auth'
                  ? 'Your session has ended. Sign in again; your answers are kept.'
                  : 'Your answers are kept. Check your connection and try again.'
              }
            />
          ) : null}
          <Button
            label={step === 'name' ? 'Create trip' : skippable ? 'Skip' : 'Next'}
            variant={skippable ? 'secondary' : 'primary'}
            disabled={!ready || create.isPending}
            loading={create.isPending}
            onPress={() => {
              if (step !== 'name') {
                goNext();
                return;
              }
              create.mutate(
                { tripId, draft },
                {
                  onSuccess: (id) => {
                    start();
                    onCreated(id);
                  },
                },
              );
            }}
            testID="trip-next"
          />
        </View>
      }
    >
      <View style={{ flex: step === 'when' ? 1 : undefined, gap: space.s6, paddingTop: space.s5 }}>
        {step === 'when' ? null : heading}
        {body}
      </View>
    </Screen>
  );
}
