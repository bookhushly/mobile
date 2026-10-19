import type { ApiError } from '@/shared/lib/errors';
import { ok, type Result } from '@/shared/lib/result';

/** A route production doesn't have yet (404): the caller uses the Phase 4a path instead. */
export type Fallback = { fallback: true };
export const FALLBACK: Fallback = { fallback: true };

export function isFallback(v: object): v is Fallback {
  return 'fallback' in v;
}

// An older deploy answers an unknown route with Next's 404 page: no JSON, so no `code`. A 404
// that carries a `code` came from the route itself and is a real answer.
export async function withFallback<T>(
  p: Promise<Result<T, ApiError>>,
  anyNotFound: boolean,
): Promise<Result<T | Fallback, ApiError>> {
  const r = await p;
  if (r.ok || r.error.kind !== 'notFound') return r;
  return anyNotFound || r.error.code === undefined ? ok(FALLBACK) : r;
}
