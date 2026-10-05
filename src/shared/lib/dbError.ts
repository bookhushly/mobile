import type { ApiError } from './errors';

export type DbError = { code?: string; status?: number };
export type DbRes = { data: unknown; error: DbError | null };

export function dbErrorToApiError(e: DbError): ApiError {
  if (e.status === 401 || e.status === 403) return { kind: 'forbidden' };
  if (typeof e.status === 'number' && e.status >= 500) {
    return { kind: 'unavailable', status: e.status };
  }
  if (e.status === undefined || e.status === 0) return { kind: 'network' };
  return { kind: 'unknown', status: e.status };
}
