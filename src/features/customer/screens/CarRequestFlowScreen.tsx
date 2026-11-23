import { useEffect, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BackHandler, View } from 'react-native';

import {
  STEPS,
  contactFor,
  stepReady,
  submitBody,
  tripDays,
  type Step,
} from '@/features/customer/domain/carRental/carRequest';
import { useCarDraft } from '@/features/customer/hooks/useCarDraft';
import { useSubmitCarRequest, type CarWrite } from '@/features/customer/hooks/useCarActions';
import { useCarPriceGuide } from '@/features/customer/hooks/useCarRequests';
import { useProfile } from '@/features/customer/hooks/useProfile';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';
import { CAR_TRY_AGAIN, carRefusedWords } from '@/features/customer/ui/car/carActionWords';
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
import { parseNigerianPhone } from '@/shared/lib/phone';
import { space } from '@/shared/theme';
import { Banner, Button, Screen, Stack, Text } from '@/shared/ui';

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
  const { draft, step, patch, next, back, edit, sendAfterSignIn, setSendAfterSignIn, start } =
    useCarDraft(
      useShallow((st) => ({
        draft: st.draft,
        step: st.step,
        patch: st.patch,
        next: st.next,
        back: st.back,
        edit: st.edit,
        sendAfterSignIn: st.sendAfterSignIn,
        setSendAfterSignIn: st.setSendAfterSignIn,
        start: st.start,
      })),
    );
  const profile = useProfile(userId);
  const { send, sending } = useSubmitCarRequest(userId);
  const guide = useCarPriceGuide(draft.pickupState, draft.vehicleType, draft.pricingModel);
  const ask = useSignInPrompt((s) => s.ask);
  const [typedName, setTypedName] = useState('');
  const [typedPhone, setTypedPhone] = useState('');
  const [phoneTried, setPhoneTried] = useState(false);
  const [problem, setProblem] = useState<{ words: string; refused: boolean } | null>(null);

  const today = lagosToday(clock.serverNow());
  const index = STEPS.indexOf(step);
  const ready = stepReady(step, draft, today);
  const signedIn = userId !== '';
  const p = profile.profile;
  const parsedPhone = parseNigerianPhone(typedPhone);
  const who = contactFor(
    p === null ? null : { name: p.name, phone: p.phone },
    { name: typedName, phone: parsedPhone.ok ? parsedPhone.e164 : null },
    email,
  );
  const askName = signedIn && p !== null && p.name.trim() === '';
  // Signed in but the profile (name, phone) hasn't loaded: say so rather than a dead button.
  const detailsUnknown = signedIn && step === 'check' && p === null;
  const askPhone = signedIn && p !== null && (p.phone ?? '').trim() === '';

  const settle = (out: CarWrite<{ id: string }>) => {
    switch (out.kind) {
      case 'ok':
        start();
        onSent(out.value.id);
        return;
      case 'signIn':
        // Signed in but the session was refused: never loop sign-in sheets and re-sends.
        if (signedIn) {
          setProblem({ words: 'Your session has ended. Sign in again to send.', refused: true });
          return;
        }
        setSendAfterSignIn(true);
        ask('book');
        return;
      case 'tryAgain':
        setProblem({ words: `${CAR_TRY_AGAIN} Your answers are kept.`, refused: false });
        return;
      case 'refused':
        setProblem({ words: carRefusedWords(out.code), refused: true });
        return;
    }
  };

  const sendNow = async () => {
    setProblem(null);
    if (!signedIn) {
      setSendAfterSignIn(true);
      ask('book');
      return;
    }
    if (!who.ok) {
      setPhoneTried(true);
      return;
    }
    const body = submitBody(draft, who.contact, today);
    if (body === null) return;
    settle(await send(body));
  };

  // Android's back button goes back a step, like the round back button; on step 1 it leaves.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (useCarDraft.getState().step === 'where') return false;
      useCarDraft.getState().back();
      return true;
    });
    return () => {
      sub.remove();
    };
  }, []);

  // A send waiting on sign-in belongs to this visit only: one left from a closed flow (or a
  // "Not now") must never fire on its own later.
  useEffect(() => {
    setSendAfterSignIn(false);
    return () => {
      setSendAfterSignIn(false);
    };
  }, [setSendAfterSignIn]);

  // Signed in from the sheet: send what they asked for once the profile says who they are. A
  // missing name or phone leaves them on the check step with the field to fill (no auto-send).
  const autoBody =
    sendAfterSignIn && signedIn && p !== null && step === 'check' && who.ok
      ? submitBody(draft, who.contact, today)
      : null;
  useEffect(() => {
    // The live flag, not this render's: the mount effect above may just have cleared it.
    if (!useCarDraft.getState().sendAfterSignIn || !signedIn || p === null) return;
    setSendAfterSignIn(false);
    if (autoBody !== null) void send(autoBody).then(settle);
    // Runs on the sign-in edge only; `settle` and `send` are read from that render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendAfterSignIn, signedIn, p]);

  let body: ReactNode;
  switch (step) {
    case 'where':
      body = <WhereStep draft={draft} onChange={patch} />;
      break;
    case 'when':
      body = <WhenStep draft={draft} today={today} onChange={patch} />;
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
            askPhone={askPhone}
            phone={typedPhone}
            phoneError={
              phoneTried && askPhone && !parsedPhone.ok
                ? 'Enter a Nigerian mobile number'
                : undefined
            }
            onPhone={setTypedPhone}
            askName={askName}
            name={typedName}
            nameError={
              phoneTried && askName && typedName.trim() === '' ? 'Add your name' : undefined
            }
            onName={setTypedName}
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
  const { title, note } = TITLE[step];
  return (
    <Screen
      scroll={step !== 'when'}
      header={<StepHeader step={index + 1} of={STEPS.length} onBack={back} onClose={onClose} />}
      footer={
        <View style={{ gap: space.s4 }}>
          {step === 'when' ? <PickupTimeChips draft={draft} onChange={patch} /> : null}
          {detailsUnknown ? (
            <Banner
              tone="neutral"
              message={
                profile.loading
                  ? 'Getting your details…'
                  : 'Couldn’t load your details. Check your connection and try again.'
              }
              {...(profile.loading
                ? {}
                : { action: { label: 'Try again', onPress: () => void profile.refetch() } })}
              testID="car-details-unknown"
            />
          ) : null}
          {problem === null ? null : (
            <Banner tone={problem.refused ? 'danger' : 'neutral'} message={problem.words} />
          )}
          <Button
            label={label}
            disabled={!ready || sending || detailsUnknown}
            loading={sending}
            onPress={() => {
              if (step === 'check') void sendNow();
              else next();
            }}
            testID="car-next"
          />
        </View>
      }
    >
      <View style={{ flex: step === 'when' ? 1 : undefined, gap: space.s6, paddingTop: space.s5 }}>
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
        {body}
      </View>
    </Screen>
  );
}
