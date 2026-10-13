import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { fetchTicketCode } from '@/features/customer/api/ticketCodeApi';
import {
  liveCodeFromResult,
  nextRefreshMs,
  REFRESH_AFTER_ERROR_MS,
  stillUsable,
  usableUntil,
  type LiveCodeState,
} from '@/features/customer/domain/liveCode';
import { api, clock } from '@/shared/api/instance';

type Token = { token: string; expiresAt: number };
type Held = { ticketId: string; state: LiveCodeState };

const DEFAULT_RETRY_AFTER_SEC = 15;
const LOADING: LiveCodeState = { kind: 'loading' };

function lastOf(s: LiveCodeState): Token | null {
  if (s.kind === 'live') return { token: s.token, expiresAt: s.expiresAt };
  if (s.kind === 'rateLimited') return s.last;
  return null;
}

function same(a: LiveCodeState, b: LiveCodeState): boolean {
  if (a.kind === 'live' && b.kind === 'live')
    return a.token === b.token && a.expiresAt === b.expiresAt;
  if (a.kind === 'admitted' && b.kind === 'admitted') return a.at === b.at;
  if (a.kind === 'rateLimited' && b.kind === 'rateLimited')
    return a.retryAfterSec === b.retryAfterSec && a.last?.token === b.last?.token;
  return a.kind === b.kind;
}

function terminal(s: LiveCodeState): boolean {
  return s.kind === 'admitted' || s.kind === 'notConfirmed' || s.kind === 'notYours';
}

/**
 * C7: polls the live code of the one ticket on screen, only while `active` and the app is in the
 * foreground. Timing runs on the server clock. Re-renders only when the state changes.
 */
export function useLiveCode(ticketId: string | null, active: boolean): LiveCodeState {
  const [held, setHeld] = useState<Held | null>(null);
  // What is on screen, for the next activation; written only from the effect.
  const lastHeld = useRef<Held | null>(null);

  useEffect(() => {
    if (!active || ticketId === null) return;
    const id = ticketId;
    let live = true;
    let fetching = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;
    // Server time the next fetch is due; null = stopped for good.
    let dueAt: number | null = null;
    let current = lastHeld.current?.ticketId === id ? lastHeld.current.state : LOADING;

    const show = (s: LiveCodeState) => {
      current = s;
      const next = { ticketId: id, state: s };
      lastHeld.current = next;
      setHeld((prev) =>
        prev !== null && prev.ticketId === id && same(prev.state, s) ? prev : next,
      );
    };
    const foreground = () => AppState.currentState === 'active';
    const clearTimers = () => {
      if (pollTimer !== null) clearTimeout(pollTimer);
      if (expiryTimer !== null) clearTimeout(expiryTimer);
      pollTimer = null;
      expiryTimer = null;
    };

    // A rate-limited ticket keeps its last token until the server would refuse it, then falls back.
    const armExpiry = () => {
      if (expiryTimer !== null) clearTimeout(expiryTimer);
      expiryTimer = null;
      if (current.kind !== 'rateLimited' || current.last === null) return;
      const ms = usableUntil(current.last.expiresAt) - clock.serverNow();
      if (ms <= 0) show({ kind: 'fallback' });
      else expiryTimer = setTimeout(armExpiry, ms);
    };

    const arm = () => {
      if (pollTimer !== null) clearTimeout(pollTimer);
      pollTimer = null;
      if (dueAt === null || fetching || !foreground()) return;
      pollTimer = setTimeout(run, Math.max(0, dueAt - clock.serverNow()));
    };
    const schedule = (ms: number) => {
      dueAt = clock.serverNow() + ms;
      arm();
    };

    function run(): void {
      pollTimer = null;
      fetching = true;
      void fetchTicketCode(api, id).then((r) => {
        fetching = false;
        if (!live) return;
        const s = liveCodeFromResult(r, lastOf(current));
        const now = clock.serverNow();
        if (s.kind === 'rateLimited') {
          // A 429 never blanks a usable token; without one it is the fallback (C7).
          const usable = s.last !== null && stillUsable(s.last.expiresAt, now);
          show(usable ? s : { kind: 'fallback' });
          if (foreground()) armExpiry();
          schedule((s.retryAfterSec ?? DEFAULT_RETRY_AFTER_SEC) * 1000);
          return;
        }
        show(s);
        if (s.kind === 'live') schedule(nextRefreshMs(s.expiresAt, now));
        else if (s.kind === 'fallback') schedule(REFRESH_AFTER_ERROR_MS);
        else dueAt = null; // admitted, not confirmed, not yours: stop.
      });
    }

    // A final answer stays put. A code still good past its refresh time is kept until then, so
    // swiping back and forth doesn't spend the 20/min budget; anything else fetches now.
    if (terminal(current)) return;
    const now = clock.serverNow();
    if (current.kind === 'live' && nextRefreshMs(current.expiresAt, now) < current.expiresAt - now)
      schedule(nextRefreshMs(current.expiresAt, now));
    else schedule(0);
    armExpiry();

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        arm();
        armExpiry();
      } else clearTimers();
    });
    return () => {
      live = false;
      clearTimers();
      sub.remove();
    };
  }, [ticketId, active]);

  return held !== null && held.ticketId === ticketId ? held.state : LOADING;
}
