import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { claim, claimCounts, sendClaimCode } from '@/features/customer/api/claimApi';
import { claimOutcome, type ActionOutcome } from '@/features/customer/domain/actionOutcome';
import { CustomerLoadError, customerKeys } from '@/features/customer/hooks/customerKeys';
import { useFocusRefetch } from '@/features/customer/hooks/useFocusRefetch';
import type { ClaimCounts } from '@/features/customer/schemas/actions';
import { api } from '@/shared/api/instance';

/** Spec E4: the counts are checked on Bookings focus, at most every 5 minutes. */
export const CLAIM_COUNTS_STALE_MS = 5 * 60_000;
/** Spec E4: a new code can be asked for after 60 s (or the server's `retry_after`). */
export const CLAIM_RESEND_SEC = 60;

/** Why the card stays hidden (or says to confirm the email), from the server's own answer. */
export type ClaimBlock = 'notCustomer' | 'emailUnverified';

type CountsAnswer = { counts: ClaimCounts } | { blocked: ClaimBlock };

type Failure = Exclude<ActionOutcome<unknown>, { kind: 'done' }>;

export type ClaimState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  /** `resendAt`: phone-clock ms from which "Send a new code" is offered. */
  | { kind: 'codeSent'; resendAt: number }
  | { kind: 'verifying' }
  /** `total`: null when an earlier verify landed unseen (the counts went to 0, security S2). */
  | { kind: 'done'; total: number | null }
  /**
   * `step`: which call failed. A failed verify keeps the code step (wrong code, rate limit);
   * `resendAt` is carried so its timer keeps running.
   */
  | { kind: 'error'; step: 'send' | 'verify'; outcome: Failure; resendAt: number | null };

// A GET: anything but the counts or a known block is a failed load (review 1–2, finding 2), kept
// apart from the claim's own states so the card can hide quietly.
async function loadCounts(): Promise<CountsAnswer> {
  const r = await claimCounts(api);
  if (r.ok) return { counts: r.value };
  const o = claimOutcome(r);
  if (o.kind === 'refused' && (o.reason === 'notCustomer' || o.reason === 'emailUnverified')) {
    return { blocked: o.reason };
  }
  throw new CustomerLoadError(r.error);
}

export function useClaim(userId: string): {
  /** null until known, and when the check failed or is blocked. */
  counts: ClaimCounts | null;
  blocked: ClaimBlock | null;
  /** The counts check failed (transient, signed out…): the card hides quietly (Task 4). */
  countsError: boolean;
  state: ClaimState;
  /**
   * Phone-clock ms from which a new code can be asked for, kept across closing the sheet (a
   * rate-limited send seeds the countdown when it is reopened). null: no wait.
   */
  resendAt: number | null;
  send: () => Promise<void>;
  verify: (code: string) => Promise<void>;
  /** Close the sheet: back to idle (ignored while a call runs). */
  reset: () => void;
} {
  const qc = useQueryClient();
  const isFocused = useIsFocused();
  const q = useQuery({
    queryKey: customerKeys.claimCounts(userId),
    queryFn: loadCounts,
    staleTime: CLAIM_COUNTS_STALE_MS,
    enabled: userId !== '',
  });
  useFocusRefetch(isFocused, q);

  const [state, setState] = useState<ClaimState>({ kind: 'idle' });
  const busy = useRef(false);
  const resendAt = useRef<number | null>(null);
  const [resendAtSeen, setResendAtSeen] = useState<number | null>(null);
  // A verify whose answer was lost may have claimed (security S2): a later "wrong code" is then
  // checked against the counts before it is shown.
  const verifyUnsure = useRef(false);

  // After a lost verify answer: the list and the counts reload; nothing left to claim means the
  // claim landed.
  const claimedUnseen = useCallback(async (): Promise<boolean> => {
    void qc.invalidateQueries({ queryKey: customerKeys.bookings(userId) });
    try {
      const a = await qc.query({
        queryKey: customerKeys.claimCounts(userId),
        queryFn: loadCounts,
        staleTime: 0,
      });
      return 'counts' in a && a.counts.total === 0;
    } catch {
      return false;
    }
  }, [qc, userId]);

  const send = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState({ kind: 'sending' });
    try {
      const o = claimOutcome(await sendClaimCode(api));
      if (o.kind === 'done') {
        resendAt.current = Date.now() + CLAIM_RESEND_SEC * 1000;
        setResendAtSeen(resendAt.current);
        setState({ kind: 'codeSent', resendAt: resendAt.current });
      } else {
        if (o.kind === 'rateLimited') {
          resendAt.current = Date.now() + (o.retryAfterSec ?? CLAIM_RESEND_SEC) * 1000;
          setResendAtSeen(resendAt.current);
        }
        setState({ kind: 'error', step: 'send', outcome: o, resendAt: resendAt.current });
      }
    } catch {
      setState({
        kind: 'error',
        step: 'send',
        outcome: { kind: 'uncertain' },
        resendAt: resendAt.current,
      });
    } finally {
      busy.current = false;
    }
  }, []);

  const verify = useCallback(
    async (code: string) => {
      if (busy.current) return;
      busy.current = true;
      setState({ kind: 'verifying' });
      try {
        const o = claimOutcome(await claim(api, code));
        if (o.kind === 'done') {
          resendAt.current = null;
          setResendAtSeen(null);
          verifyUnsure.current = false;
          setState({ kind: 'done', total: o.value.claimed.total });
          // The claimed bookings now read under RLS: the list (and so the wallet) reloads.
          void qc.invalidateQueries({ queryKey: customerKeys.bookings(userId) });
          void qc.invalidateQueries({ queryKey: customerKeys.claimCounts(userId) });
        } else {
          const unsure = o.kind === 'uncertain';
          const wrongAfterUnsure =
            verifyUnsure.current && o.kind === 'refused' && o.reason === 'invalidCode';
          if (unsure) verifyUnsure.current = true;
          if ((unsure || wrongAfterUnsure) && (await claimedUnseen())) {
            verifyUnsure.current = false;
            resendAt.current = null;
            setResendAtSeen(null);
            setState({ kind: 'done', total: null });
          } else {
            setState({ kind: 'error', step: 'verify', outcome: o, resendAt: resendAt.current });
          }
        }
      } catch {
        verifyUnsure.current = true;
        setState({
          kind: 'error',
          step: 'verify',
          outcome: { kind: 'uncertain' },
          resendAt: resendAt.current,
        });
      } finally {
        busy.current = false;
      }
    },
    [qc, userId, claimedUnseen],
  );

  const reset = useCallback(() => {
    if (busy.current) return;
    setState({ kind: 'idle' });
  }, []);

  const answer = q.data;
  return {
    counts: answer !== undefined && 'counts' in answer ? answer.counts : null,
    blocked: answer !== undefined && 'blocked' in answer ? answer.blocked : null,
    countsError: q.isError && answer === undefined,
    state,
    resendAt: resendAtSeen,
    send,
    verify,
    reset,
  };
}
