import type { TicketCodeBody } from '@/features/customer/schemas/ticketCode';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

type Token = { token: string; expiresAt: number };

export type LiveCodeState =
  | { kind: 'loading' }
  | { kind: 'live'; token: string; expiresAt: number }
  | { kind: 'admitted'; at: string | null }
  | { kind: 'notConfirmed' }
  | { kind: 'notYours' }
  /** Transient (network, timeout, 5xx, bad body, signed out): show the C8 fallback, never a refusal. */
  | { kind: 'fallback' }
  | { kind: 'rateLimited'; retryAfterSec: number | null; last: Token | null };

export const REFRESH_AFTER_ERROR_MS = 15_000;
const MIN_REFRESH_MS = 3_000;
const REFRESH_LEAD_MS = 2_000;
// The server accepts the previous step too (±1 × 30 s).
const GRACE_MS = 30_000;

// The route has no error codes: a 409 "already used" carries `checked_in_at`, "not confirmed" doesn't.
function admittedAt(body: unknown): { at: string | null } | null {
  if (typeof body !== 'object' || body === null || !('checked_in_at' in body)) return null;
  const at = body.checked_in_at;
  return { at: typeof at === 'string' ? at : null };
}

export function liveCodeFromResult(
  r: Result<TicketCodeBody, ApiError>,
  last: Token | null,
): LiveCodeState {
  if (r.ok) return { kind: 'live', token: r.value.token, expiresAt: r.value.expires_at };
  const e = r.error;
  switch (e.kind) {
    case 'conflict': {
      const used = admittedAt(e.body);
      return used === null ? { kind: 'notConfirmed' } : { kind: 'admitted', at: used.at };
    }
    case 'forbidden':
    case 'notFound':
      return { kind: 'notYours' };
    case 'rateLimited':
      return { kind: 'rateLimited', retryAfterSec: e.retryAfterSec ?? null, last };
    case 'auth':
    case 'network':
    case 'timeout':
    case 'unavailable':
    case 'validation':
    case 'aborted':
    case 'unknown':
      return { kind: 'fallback' };
  }
}

export function nextRefreshMs(expiresAt: number, serverNow: number): number {
  return Math.max(MIN_REFRESH_MS, expiresAt - serverNow - REFRESH_LEAD_MS);
}

export function stillUsable(expiresAt: number, serverNow: number): boolean {
  return serverNow < expiresAt + GRACE_MS;
}
