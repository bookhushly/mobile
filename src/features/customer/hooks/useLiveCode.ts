import { useCallback, useEffect, useRef, useState } from 'react';
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
/** What the card had when it last went off screen: its state and when the next fetch is due. */
type Memo = Held & { dueAt: number | null };

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

export type LiveCode = {
  state: LiveCodeState;
  /** Fetch again now (e.g. "Try again"); a pending Retry-After is still respected. */
  retry: () => void;
};

/**
 * C7: polls the live code of the one ticket on screen, only while `active` and the app is in the
 * foreground. Timing runs on the server clock. Re-renders only when the state changes.
 */
export function useLiveCode(ticketId: string | null, active: boolean): LiveCode {
  const [held, setHeld] = useState<Held | null>(null);
  // Survives deactivation, so coming back on screen resumes rather than refetches.
  const memo = useRef<Memo | null>(null);
  const [attempt, setAttempt] = useState(0);
  const forced = useRef(false);
  const retry = useCallback(() => {
    forced.current = true;
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    // Read and cleared on every run, so a retry() while off screen can't force a later fetch.
    const force = forced.current;
    forced.current = false;
    if (!active || ticketId === null) return;
    const id = ticketId;
    let live = true;
    let fetching = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;
    const m = memo.current?.ticketId === id ? memo.current : null;
    let current = m?.state ?? LOADING;
    // Server time the next fetch is due; null = stopped for good.
    let dueAt: number | null = null;

    const remember = () => {
      memo.current = { ticketId: id, state: current, dueAt };
    };
    const show = (s: LiveCodeState) => {
      current = s;
      remember();
      const next = { ticketId: id, state: s };
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

    // A token on screen stays until the server would refuse it (C7), then the fallback shows.
    const armExpiry = () => {
      if (expiryTimer !== null) clearTimeout(expiryTimer);
      expiryTimer = null;
      const last = lastOf(current);
      if (last === null) return;
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
      void fetchTicketCode(api, id).then((r) => {
        fetching = false;
        const now = clock.serverNow();
        if (!live) {
          // Gone off screen meanwhile: keep a fresh code for next time (it spent budget), no timers.
          const k = memo.current;
          if (r.ok && (k === null || k.ticketId === id) && !(k !== null && terminal(k.state))) {
            const s = liveCodeFromResult(r, null);
            if (
              s.kind === 'live' &&
              !(k?.state.kind === 'live' && k.state.expiresAt >= s.expiresAt)
            )
              memo.current = {
                ticketId: id,
                state: s,
                dueAt: now + nextRefreshMs(s.expiresAt, now),
              };
          }
          return;
        }
        const s = liveCodeFromResult(r, lastOf(current));
        const last = lastOf(current);
        const usable = last !== null && stillUsable(last.expiresAt, now);
        if (s.kind === 'rateLimited') {
          // A 429 never blanks a usable token; without one it is the fallback (C7).
          show(usable ? { ...s, last } : { kind: 'fallback' });
          schedule((s.retryAfterSec ?? DEFAULT_RETRY_AFTER_SEC) * 1000);
        } else if (s.kind === 'fallback') {
          // A transient failure keeps the token on screen while it is still usable, too.
          if (!usable) show(s);
          schedule(REFRESH_AFTER_ERROR_MS);
        } else {
          show(s);
          if (s.kind === 'live') schedule(nextRefreshMs(s.expiresAt, now));
          // Admitted, not confirmed, not yours, signed out: stop. Signed out isn't final:
          // coming back on screen or Try again asks again.
          else scheduleAt(null);
        }
        if (foreground()) armExpiry();
      });
    }

    const now = clock.serverNow();
    if (force) {
      // Retry: now, unless the server asked us to wait.
      dueAt = current.kind === 'rateLimited' && m?.dueAt != null ? Math.max(m.dueAt, now) : now;
    } else if (terminal(current)) {
      return;
    } else {
      // Resume where it left off: a code still good keeps until its refresh time, and a pending
      // Retry-After or error back-off is kept, so swiping back and forth doesn't spend the
      // 20/min budget. Anything overdue fetches now.
      dueAt = m?.dueAt != null ? Math.max(m.dueAt, now) : now;
    }
    if (m !== null) show(current);
    arm();
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
    // `attempt` is only here to restart the effect on retry().
  }, [ticketId, active, attempt]);

  const state = held !== null && held.ticketId === ticketId ? held.state : LOADING;
  return { state, retry };
}
