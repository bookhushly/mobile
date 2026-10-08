export type ApiError =
  | { kind: 'network' }
  | { kind: 'timeout' }
  | { kind: 'auth' }
  | { kind: 'forbidden'; code?: string; body?: unknown }
  | { kind: 'notFound'; code?: string }
  | { kind: 'conflict'; code: string; body?: unknown }
  | { kind: 'rateLimited'; retryAfterSec?: number }
  | { kind: 'unavailable'; status: number; code?: string }
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

export function errorFromResponse(status: number, body: unknown, headers: HeaderReader): ApiError {
  const code = codeOf(body);
  if (status === 401) return { kind: 'auth' };
  if (status === 403) return code ? { kind: 'forbidden', code, body } : { kind: 'forbidden', body };
  if (status === 404) return code ? { kind: 'notFound', code } : { kind: 'notFound' };
  if (status === 409) return { kind: 'conflict', code: code ?? 'conflict', body };
  if (status === 429) {
    const raw = headers.get('retry-after');
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0
      ? { kind: 'rateLimited', retryAfterSec: n }
      : { kind: 'rateLimited' };
  }
  if (status >= 500) {
    return code ? { kind: 'unavailable', status, code } : { kind: 'unavailable', status };
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
