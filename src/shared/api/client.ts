import type { z } from 'zod';

import type { Clock } from '@/shared/lib/clock';
import { errorFromResponse, isRetryable, type ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type RequestOptions<T> = {
  method?: Method;
  body?: unknown;
  schema: z.ZodType<T>;
  idempotent?: boolean;
  signal?: AbortSignal;
};

type Deps = {
  baseUrl: string;
  fetchFn: typeof fetch;
  getAccessToken: () => Promise<string | null>;
  refreshSession: () => Promise<string | null>;
  clock: Pick<Clock, 'recordServerDate'>;
  appVersion: string;
  platform: string;
  timeoutMs?: number;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

export function createApiClient(deps: Deps) {
  const timeoutMs = deps.timeoutMs ?? 15_000;
  const maxRetries = deps.maxRetries ?? 2;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = deps.random ?? Math.random;

  async function once(
    path: string,
    method: Method,
    body: unknown,
    token: string | null,
    outerSignal?: AbortSignal,
  ): Promise<Result<Response, ApiError>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    outerSignal?.addEventListener('abort', () => controller.abort());
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-App-Version': deps.appVersion,
        'X-Platform': deps.platform,
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const init: RequestInit = { method, headers, signal: controller.signal };
      if (body !== undefined) init.body = JSON.stringify(body);
      const res = await deps.fetchFn(`${deps.baseUrl}${path}`, init);
      await deps.clock.recordServerDate(res.headers.get('date'));
      return ok(res);
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      return err(aborted ? { kind: 'timeout' } : { kind: 'network' });
    } finally {
      clearTimeout(timer);
    }
  }

  async function readBody(res: Response): Promise<unknown> {
    try {
      return (await res.json()) as unknown;
    } catch {
      return null;
    }
  }

  async function request<T>(path: string, opts: RequestOptions<T>): Promise<Result<T, ApiError>> {
    const method = opts.method ?? 'GET';
    const canRetry = method === 'GET' || opts.idempotent === true;
    let token = await deps.getAccessToken();
    let refreshed = false;
    let attempt = 0;

    for (;;) {
      const sent = await once(path, method, opts.body, token, opts.signal);
      let failure: ApiError;
      if (!sent.ok) {
        failure = sent.error;
      } else {
        const res = sent.value;
        if (res.ok) {
          const parsed = opts.schema.safeParse(await readBody(res));
          return parsed.success ? ok(parsed.data) : err({ kind: 'validation' });
        }
        if (res.status === 401 && !refreshed) {
          refreshed = true;
          const next = await deps.refreshSession();
          if (next === null) return err({ kind: 'auth' });
          token = next;
          continue;
        }
        failure = errorFromResponse(res.status, await readBody(res), res.headers);
      }
      const autoRetry =
        isRetryable(failure) && failure.kind !== 'rateLimited' && canRetry && attempt < maxRetries;
      if (!autoRetry) return err(failure);
      attempt += 1;
      await sleep(400 * attempt + Math.floor(random() * 200));
    }
  }

  return { request };
}

export type ApiClient = ReturnType<typeof createApiClient>;
