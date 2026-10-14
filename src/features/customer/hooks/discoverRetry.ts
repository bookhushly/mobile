import { useEffect, useState } from 'react';

import { CustomerLoadError } from '@/features/customer/hooks/customerKeys';
import type { ApiError } from '@/shared/lib/errors';

/** When a 429 carries no Retry-After, "Load more" comes back after this long. */
export const DEFAULT_RETRY_AFTER_SEC = 10;

// Final review F1: listings and reviews go through the API client, which already retries a GET
// (bounded, with jitter); a query-level retry on top multiplied every failure (3 × 3 requests
// against a 60/min per-IP budget). D16: a 429 is never retried on its own either; the screen
// offers "Load more" / "Try again" once Retry-After has passed.
export function discoverRetry(): boolean {
  return false;
}

export function apiErrorOf(error: unknown): ApiError | null {
  return error instanceof CustomerLoadError ? error.apiError : null;
}

/**
 * While the last error is a 429 still inside its Retry-After: the seconds asked for; else null.
 * `errorUpdatedAt` identifies the error, so a fresh 429 starts a fresh wait.
 */
export function useRetryAfter(error: ApiError | null, errorUpdatedAt: number): number | null {
  const sec =
    error?.kind === 'rateLimited' ? (error.retryAfterSec ?? DEFAULT_RETRY_AFTER_SEC) : null;
  const errAt = sec === null ? null : errorUpdatedAt;
  const [clearedFor, setClearedFor] = useState<number | null>(null);
  useEffect(() => {
    if (errAt === null || sec === null) return;
    const t = setTimeout(
      () => {
        setClearedFor(errAt);
      },
      Math.max(0, errAt + sec * 1000 - Date.now()),
    );
    return () => {
      clearTimeout(t);
    };
  }, [errAt, sec]);
  return errAt !== null && clearedFor !== errAt ? sec : null;
}
