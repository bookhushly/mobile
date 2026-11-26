import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import type { StoreApi, UseBoundStore } from 'zustand';

import { contactFor, type Contact } from '@/features/customer/domain/carRental/carRequest';
import type { DraftStore } from '@/features/customer/hooks/draftStore';
import type { RfqKind, RfqRow } from '@/features/customer/hooks/rfqKinds';
import { useSubmitRfq, type CarWrite } from '@/features/customer/hooks/useCarActions';
import { useProfile } from '@/features/customer/hooks/useProfile';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';
import { clearTripLink, refreshTrips, tripServiceIdFor } from '@/features/customer/hooks/useTrips';
import { CAR_TRY_AGAIN, carRefusedWords } from '@/features/customer/ui/car/carActionWords';
import { parseNigerianPhone } from '@/shared/lib/phone';

type Args<D, S extends string, R extends RfqRow, B extends object> = {
  kind: RfqKind<R, B>;
  store: UseBoundStore<StoreApi<DraftStore<D, S>>>;
  /** '' when signed out: every step works; sending asks for sign-in first. */
  userId: string;
  email: string;
  firstStep: S;
  checkStep: S;
  /** The submit body for this draft and contact, or null while something required is missing. */
  bodyOf: (draft: D, contact: Contact) => B | null;
  onSent: (requestId: string) => void;
};

/**
 * Sending a request-for-quote (car rental, logistics) from its flow: who it's from (the profile,
 * or what was typed), sign-in first when signed out (then sent once, never left to fire later),
 * Android back stepping back, and the outcome in words (a lost answer is "try again", never a
 * refusal).
 */
export function useRequestSender<D, S extends string, R extends RfqRow, B extends object>({
  kind,
  store,
  userId,
  email,
  firstStep,
  checkStep,
  bodyOf: draftBody,
  onSent,
}: Args<D, S, R, B>) {
  const profile = useProfile(userId);
  const bodyOf = (d: D, c: Contact): B | null => {
    const b = draftBody(d, c);
    const trip = tripServiceIdFor(userId, kind.requestType);
    return b === null || trip === null ? b : { ...b, trip_service_id: trip };
  };
  const { send, sending } = useSubmitRfq(kind, userId);
  const ask = useSignInPrompt((s) => s.ask);
  const step = store((s) => s.step);
  const draft = store((s) => s.draft);
  const sendAfterSignIn = store((s) => s.sendAfterSignIn);
  const setSendAfterSignIn = store((s) => s.setSendAfterSignIn);
  const start = store((s) => s.start);
  const [typedName, setTypedName] = useState('');
  const [typedPhone, setTypedPhone] = useState('');
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<{ words: string; refused: boolean } | null>(null);

  const signedIn = userId !== '';
  const p = profile.profile;
  const parsedPhone = parseNigerianPhone(typedPhone);
  const who = contactFor(
    p === null ? null : { name: p.name, phone: p.phone },
    { name: typedName, phone: parsedPhone.ok ? parsedPhone.e164 : null },
    email,
  );
  const askName = signedIn && p !== null && p.name.trim() === '';
  const askPhone = signedIn && p !== null && (p.phone ?? '').trim() === '';
  // Signed in but the profile (name, phone) hasn't loaded: say so rather than a dead button.
  const detailsUnknown = signedIn && step === checkStep && p === null;

  const settle = (out: CarWrite<{ id: string }>) => {
    switch (out.kind) {
      case 'ok':
        start();
        clearTripLink(kind.requestType);
        refreshTrips(userId);
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
      setTried(true);
      return;
    }
    const body = bodyOf(draft, who.contact);
    if (body === null) return;
    settle(await send(body));
  };

  // Android's back button goes back a step, like the round back button; on step 1 it leaves.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (store.getState().step === firstStep) return false;
      store.getState().back();
      return true;
    });
    return () => {
      sub.remove();
    };
  }, [store, firstStep]);

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
    sendAfterSignIn && signedIn && p !== null && step === checkStep && who.ok
      ? bodyOf(draft, who.contact)
      : null;
  useEffect(() => {
    // The live flag, not this render's: the mount effect above may just have cleared it.
    if (!store.getState().sendAfterSignIn || !signedIn || p === null) return;
    setSendAfterSignIn(false);
    if (autoBody !== null) void send(autoBody).then(settle);
    // Runs on the sign-in edge only; `settle` and `send` are read from that render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendAfterSignIn, signedIn, p]);

  return {
    sendNow,
    sending,
    problem,
    detailsUnknown,
    profileLoading: profile.loading,
    retryProfile: () => void profile.refetch(),
    askName,
    askPhone,
    typedName,
    setTypedName,
    typedPhone,
    setTypedPhone,
    nameError: tried && askName && typedName.trim() === '' ? 'Add your name' : undefined,
    phoneError: tried && askPhone && !parsedPhone.ok ? 'Enter a Nigerian mobile number' : undefined,
  };
}
