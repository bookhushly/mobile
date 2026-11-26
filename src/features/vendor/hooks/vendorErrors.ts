import type { ApiError } from '@/shared/lib/errors';

/**
 * A 4xx the screens have no words of their own for (a 400 `bad_request`: a photo too large, a
 * vehicle that isn't yours): a refusal, never "try again". The contract says the server's `error`
 * sentence may be shown, so it is, when there is one.
 */
export function otherRefusal(
  a: ApiError | null,
): { title: string; message: string; transient: false } | null {
  if (
    a === null ||
    a.kind !== 'unknown' ||
    a.status === undefined ||
    a.status < 400 ||
    a.status >= 500
  )
    return null;
  const body = a.body;
  const sentence =
    typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
      ? body.error
      : null;
  return {
    title: 'Bookhushly didn’t accept this',
    message: sentence ?? 'Check the details and try again, or contact support.',
    transient: false,
  };
}

/**
 * Vendor reads retry a dropped connection or a 503 twice, but never a 429: the routes allow 30
 * calls a minute per user, and retrying inside the window only spends more of it.
 */
export function vendorRetry(failureCount: number, e: unknown): boolean {
  if (failureCount >= 2 || typeof e !== 'object' || e === null || !('kind' in e)) return false;
  return e.kind === 'network' || e.kind === 'timeout' || e.kind === 'unavailable';
}
