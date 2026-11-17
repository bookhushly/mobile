export type ApiError =
  | { kind: 'network' }
  | { kind: 'timeout' }
  | { kind: 'auth' }
  | { kind: 'forbidden'; code?: string; body?: unknown }
  | { kind: 'notFound'; code?: string }
  | { kind: 'conflict'; code: string; body?: unknown }
  | { kind: 'rateLimited'; retryAfterSec?: number }
  | { kind: 'unavailable'; status: number; code?: string; body?: unknown; retryAfterSec?: number }
  | { kind: 'validation' }
  | { kind: 'aborted' }
  | { kind: 'unknown'; status?: number; code?: string; body?: unknown };

type HeaderReader = { get(name: string): string | null };

function codeOf(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'code' in body) {
    const c = body.code;
    return typeof c === 'string' ? c : undefined;
  }
  return undefined;
}

/** `Retry-After` in seconds, when it is a non-negative number (dates are not read). */
function retryAfter(headers: HeaderReader): number | null {
  const raw = headers.get('retry-after');
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function errorFromResponse(status: number, body: unknown, headers: HeaderReader): ApiError {
  const code = codeOf(body);
  if (status === 401) return { kind: 'auth' };
  if (status === 403) return code ? { kind: 'forbidden', code, body } : { kind: 'forbidden', body };
  if (status === 404) return code ? { kind: 'notFound', code } : { kind: 'notFound' };
  if (status === 409) return { kind: 'conflict', code: code ?? 'conflict', body };
  if (status === 429) {
    const n = retryAfter(headers);
    return n !== null ? { kind: 'rateLimited', retryAfterSec: n } : { kind: 'rateLimited' };
  }
  if (status >= 500) {
    // e.g. the status poll's 503 `fetch_failed` with `Retry-After: 5` (web #223).
    const n = retryAfter(headers);
    return {
      kind: 'unavailable',
      status,
      ...(code ? { code } : {}),
      body,
      ...(n !== null ? { retryAfterSec: n } : {}),
    };
  }
  return code ? { kind: 'unknown', status, code, body } : { kind: 'unknown', status, body };
}

export function isRetryable(e: ApiError): boolean {
  switch (e.kind) {
    case 'network':
    case 'timeout':
    case 'rateLimited':
    case 'unavailable':
      return true;
    case 'auth':
    case 'forbidden':
    case 'notFound':
    case 'conflict':
    case 'validation':
    case 'aborted':
    case 'unknown':
      return false;
  }
}
