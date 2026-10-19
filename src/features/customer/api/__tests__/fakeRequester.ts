import type { z } from 'zod';

import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

export type Call = { path: string; opts: Record<string, unknown> };

/**
 * A stand-in for the API client: records each call and answers with `reply` — an error, or a raw
 * body run through the call's own schema (as the real client does).
 */
export function fakeRequester(reply: { error: ApiError } | { body: unknown }) {
  const calls: Call[] = [];
  const client = {
    request: <T>(path: string, opts: { schema: z.ZodType<T> }): Promise<Result<T, ApiError>> => {
      calls.push({ path, opts: { ...opts } });
      if ('error' in reply) return Promise.resolve(err(reply.error));
      const p = opts.schema.safeParse(reply.body);
      return Promise.resolve(p.success ? ok(p.data) : err<ApiError>({ kind: 'validation' }));
    },
  };
  return { client, calls };
}
