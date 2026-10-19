import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { fetchEventCodes } from '@/features/customer/api/eventCodesApi';
import { isFallback } from '@/features/customer/api/fallback';
import {
  codesFinal,
  codesFromResult,
  nextRefreshMs,
  REFRESH_AFTER_ERROR_MS,
  ticketCodeState,
  usableUntil,
  type BookingCodesState,
  type LiveBatch,
  type LiveCodeState,
} from '@/features/customer/domain/liveCode';
import type { EventCodes } from '@/features/customer/schemas/actions';
import { api, clock } from '@/shared/api/instance';
import type { ApiError } from '@/shared/lib/errors';
import { ok, type Result } from '@/shared/lib/result';

const DEFAULT_RETRY_AFTER_SEC = 15;
// Contract §3 polling rule: a Retry-After is floored at 3 s.
const MIN_RETRY_AFTER_SEC = 3;
const LOADING: BookingCodesState = { kind: 'loading' };

/** What the viewer had when it last closed: resumes rather than refetches. */
type Memo = { bookingId: string; state: BookingCodesState; dueAt: number | null };
type Held = { bookingId: string; state: BookingCodesState };
/** `perTicket`: this deploy has no `/codes` route (bare 404), so each card polls its own (4a). */
type Mode = { bookingId: string; perTicket: boolean };

function lastOf(s: BookingCodesState): LiveBatch | null {
  if (s.kind === 'live') return s.expiresAt === null ? null : s;
  if (s.kind === 'rateLimited') return s.last;
  return null;
}

function stopped(s: BookingCodesState): boolean {
  return codesFinal(s) || s.kind === 'signedOut';
}

export type LiveCodes = {
  /** The route is missing on this deploy: the cards use the per-ticket `useLiveCode`. */
  perTicket: boolean;
  /** One ticket's state, read out of the booking's last answer. */
  stateOf: (ticketId: string) => LiveCodeState;
  /** Fetch again now ("Try again"); a pending Retry-After is still respected. */
  retry: () => void;
};

/**
 * Spec E2: one `GET /api/bookings/event/{id}/codes` per booking while the viewer is open and the
 * app is in the foreground, refreshed at `expires_at − 2 s` on the server clock. A token stays on
 * screen through a 429 or a transient failure until the server would refuse it.
 */
export function useLiveCodes(bookingId: string | null, active: boolean): LiveCodes {
  const [held, setHeld] = useState<Held | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const memo = useRef<Memo | null>(null);
  const perTicketFor = useRef<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const forced = useRef(false);
  const retry = useCallback(() => {
    forced.current = true;
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    const force = forced.current;
    forced.current = false;
    if (!active || bookingId === null || perTicketFor.current === bookingId) return;
    const id = bookingId;
    let live = true;
    // Review 3, finding 5: a retry or a close aborts the request in flight, so a double tap on
    // "Try again" never spends a second request of the ticket-tier budget.
    const inFlight = new AbortController();
    let fetching = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;
    const m = memo.current?.bookingId === id ? memo.current : null;
    let current = m?.state ?? LOADING;
    let dueAt: number | null = null;

    const remember = () => {
      memo.current = { bookingId: id, state: current, dueAt };
    };
    const show = (s: BookingCodesState) => {
      current = s;
      remember();
      setHeld((prev) =>
        prev !== null && prev.bookingId === id && prev.state === s
          ? prev
          : { bookingId: id, state: s },
      );
    };
    const foreground = () => AppState.currentState === 'active';
    const clearTimers = () => {
      if (pollTimer !== null) clearTimeout(pollTimer);
      if (expiryTimer !== null) clearTimeout(expiryTimer);
      pollTimer = null;
      expiryTimer = null;
    };

    // The tokens on screen stay until the server would refuse them, then the fallback shows.
    const armExpiry = () => {
      if (expiryTimer !== null) clearTimeout(expiryTimer);
      expiryTimer = null;
      const last = lastOf(current);
      if (last?.expiresAt == null) return;
      const ms = usableUntil(last.expiresAt) - clock.serverNow();
      if (ms <= 0) show({ kind: 'fallback' });
      else expiryTimer = setTimeout(armExpiry, ms);
    };
    const arm = () => {
      if (pollTimer !== null) clearTimeout(pollTimer);
      pollTimer = null;
      if (dueAt === null || fetching || !foreground()) return;
      pollTimer = setTimeout(run, Math.max(0, dueAt - clock.serverNow()));
    };
    const scheduleAt = (at: number | null) => {
      dueAt = at;
      remember();
      arm();
    };
    const schedule = (ms: number) => {
      scheduleAt(clock.serverNow() + ms);
    };

    function run(): void {
      pollTimer = null;
      fetching = true;
      void fetchEventCodes(api, id, inFlight.signal).then((r) => {
        fetching = false;
        let answer: Result<EventCodes, ApiError>;
        if (!r.ok) answer = r;
        else if (isFallback(r.value)) {
          // An older deploy: per-ticket polling from now on, for this booking.
          perTicketFor.current = id;
          scheduleAt(null);
          if (live) setMode({ bookingId: id, perTicket: true });
          return;
        } else answer = ok(r.value);
        const now = clock.serverNow();
        if (!live) {
          // Closed meanwhile: keep a fresh answer for next time (it spent budget), no timers.
          if (answer.ok) {
            const s = codesFromResult(answer, null);
            const exp = s.kind === 'live' ? s.expiresAt : null;
            memo.current = {
              bookingId: id,
              state: s,
              dueAt: stopped(s)
                ? null
                : now + (exp === null ? REFRESH_AFTER_ERROR_MS : nextRefreshMs(exp, now)),
            };
          }
          return;
        }
        const last = lastOf(current);
        const usable = last?.expiresAt != null && now < usableUntil(last.expiresAt);
        const s = codesFromResult(answer, last);
        if (s.kind === 'rateLimited') {
          // A 429 never blanks a usable token; without one it is the fallback (C7).
          show(usable ? s : { kind: 'fallback' });
          schedule(
            Math.max(MIN_RETRY_AFTER_SEC, s.retryAfterSec ?? DEFAULT_RETRY_AFTER_SEC) * 1000,
          );
        } else if (s.kind === 'fallback') {
          // A transient failure keeps usable tokens on screen too.
          if (!usable) show(s);
          schedule(REFRESH_AFTER_ERROR_MS);
        } else {
          show(s);
          if (stopped(s)) scheduleAt(null);
          else if (s.kind === 'live' && s.expiresAt !== null)
            schedule(nextRefreshMs(s.expiresAt, now));
          // None issued yet: ask again shortly.
          else schedule(REFRESH_AFTER_ERROR_MS);
        }
        if (foreground()) armExpiry();
      });
    }

    const now = clock.serverNow();
    if (force) {
      dueAt = current.kind === 'rateLimited' && m?.dueAt != null ? Math.max(m.dueAt, now) : now;
    } else if (codesFinal(current)) {
      if (m !== null) show(current);
      return;
    } else {
      dueAt = m?.dueAt != null ? Math.max(m.dueAt, now) : now;
    }
    if (m !== null) show(current);
    arm();
    armExpiry();

    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        arm();
        armExpiry();
      } else clearTimers();
    });
    return () => {
      live = false;
      inFlight.abort();
      clearTimers();
      sub.remove();
    };
    // `attempt` is only here to restart the effect on retry().
  }, [bookingId, active, attempt]);

  const state = held !== null && held.bookingId === bookingId ? held.state : LOADING;
  const stateOf = useCallback((ticketId: string) => ticketCodeState(state, ticketId), [state]);
  return {
    perTicket: mode !== null && mode.bookingId === bookingId && mode.perTicket,
    stateOf,
    retry,
  };
}
