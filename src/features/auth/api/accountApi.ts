import type { z } from 'zod';

import { fieldMessages, type FieldErrors } from '@/features/auth/domain/signUpErrors';
import {
  acceptedOk,
  blockersBody,
  fieldsBody,
  messageBody,
  signUpOk,
} from '@/features/auth/schemas/account';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

export type AccountFailure =
  | { kind: 'invalid'; fields: FieldErrors }
  | { kind: 'weakPassword'; fields: FieldErrors }
  | { kind: 'emailTaken' }
  | { kind: 'unauthorized' }
  | { kind: 'notCustomer'; message: string }
  | { kind: 'blocked'; reasons: { code: string; detail: string }[] }
  | { kind: 'transient'; retryAfterSec?: number }
  | { kind: 'failed' };

type Client = Pick<ApiClient, 'request'>;

const NOT_CUSTOMER_MESSAGE = 'This account is closed through support.';
const WEAK_PASSWORD_MESSAGE = 'Choose a stronger password';

// These routes do real work (Supabase admin calls, email sends): give them longer than the default.
const TIMEOUT_MS = 20_000;

function fieldsOf(body: unknown): Record<string, string> | undefined {
  const p = fieldsBody.safeParse(body);
  return p.success ? p.data.fields : undefined;
}

export function toFailure(e: ApiError): AccountFailure {
  switch (e.kind) {
    case 'network':
    case 'timeout':
    case 'aborted':
      return { kind: 'transient' };
    case 'rateLimited':
      return e.retryAfterSec === undefined
        ? { kind: 'transient' }
        : { kind: 'transient', retryAfterSec: e.retryAfterSec };
    case 'unavailable':
      // 503 without a code (proxy, Redis down) and signup's 503 `unavailable` are both temporary.
      return e.status === 503 ? { kind: 'transient' } : { kind: 'failed' };
    case 'auth':
      return { kind: 'unauthorized' };
    case 'forbidden': {
      if (e.code !== 'not_customer') return { kind: 'failed' };
      const m = messageBody.safeParse(e.body);
      return {
        kind: 'notCustomer',
        message: m.success && m.data.error ? m.data.error : NOT_CUSTOMER_MESSAGE,
      };
    }
    case 'conflict': {
      if (e.code === 'email_taken') return { kind: 'emailTaken' };
      const b = blockersBody.safeParse(e.body);
      const reasons = b.success
        ? (b.data.blockers ??
          (b.data.code && b.data.detail ? [{ code: b.data.code, detail: b.data.detail }] : []))
        : [];
      return reasons.length > 0 ? { kind: 'blocked', reasons } : { kind: 'failed' };
    }
    case 'unknown':
      if (
        e.status === 400 &&
        (e.code === 'invalid_input' || e.code === 'confirmation_required')
      ) {
        return { kind: 'invalid', fields: fieldMessages(fieldsOf(e.body)) };
      }
      if (e.status === 422 && e.code === 'weak_password') {
        const f = fieldMessages(fieldsOf(e.body));
        return {
          kind: 'weakPassword',
          fields: f.password ? f : { ...f, password: WEAK_PASSWORD_MESSAGE },
        };
      }
      return { kind: 'failed' };
    case 'notFound':
    case 'validation':
      return { kind: 'failed' };
  }
}

async function post<T>(
  client: Client,
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<Result<T, AccountFailure>> {
  const r = await client.request(path, { method: 'POST', body, schema, timeoutMs: TIMEOUT_MS });
  return r.ok ? ok(r.value) : err(toFailure(r.error));
}

export async function signUp(
  client: Client,
  input: { name: string; email: string; password: string },
): Promise<Result<{ email: string }, AccountFailure>> {
  const r = await post(client, '/api/auth/signup', input, signUpOk);
  // The server returns the normalised (trimmed, lowercased) address; verifyOtp must use it.
  return r.ok ? ok({ email: r.value.user.email }) : r;
}

export async function resendConfirmation(
  client: Client,
  email: string,
): Promise<Result<true, AccountFailure>> {
  const r = await post(client, '/api/auth/resend-confirmation', { email }, acceptedOk);
  return r.ok ? ok(true) : r;
}

export async function forgotPassword(
  client: Client,
  email: string,
): Promise<Result<true, AccountFailure>> {
  const r = await post(client, '/api/auth/forgot-password', { email }, acceptedOk);
  return r.ok ? ok(true) : r;
}

// Bearer only: the shared client attaches the current session's token.
export async function resetPassword(
  client: Client,
  password: string,
): Promise<Result<true, AccountFailure>> {
  const r = await post(client, '/api/auth/reset-password', { password }, acceptedOk);
  return r.ok ? ok(true) : r;
}

// Never sends `password`: the app re-checks it with signInWithPassword first (spec decision 3).
export async function deleteAccount(client: Client): Promise<Result<true, AccountFailure>> {
  const r = await post(client, '/api/account/delete', { confirm: 'DELETE' }, acceptedOk);
  return r.ok ? ok(true) : r;
}
