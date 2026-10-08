import {
  deleteAccount,
  forgotPassword,
  resendConfirmation,
  resetPassword,
  signUp,
} from '@/features/auth/api/accountApi';
import { createApiClient, type RefreshOutcome } from '@/shared/api/client';

type Call = { url: string; init: RequestInit };

function make(fetchFn: typeof fetch, calls: Call[]) {
  const c = createApiClient({
    baseUrl: 'https://bookhushly.com',
    fetchFn,
    getAccessToken: () => Promise.resolve('tok'),
    refreshSession: (): Promise<RefreshOutcome> => Promise.resolve({ failure: 'invalid' }),
    clock: { recordServerDate: () => undefined },
    appVersion: '1.0.0 (1)',
    platform: 'ios',
    sleep: () => Promise.resolve(),
  });
  return { c, calls };
}

function client(status: number, body: unknown, headers: Record<string, string> = {}) {
  const calls: Call[] = [];
  const fetchFn = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), { status, headers }),
    );
  }) as unknown as typeof fetch;
  return make(fetchFn, calls);
}

const sentBody = (c: Call | undefined): unknown => JSON.parse(c?.init.body as string);
const headersOf = (c: Call | undefined) => c?.init.headers as Record<string, string>;

const input = { name: 'A', email: 'a@b.co', password: 'Abcdefg1!' };

describe('signUp', () => {
  it('201 returns the normalised email and posts name/email/password only', async () => {
    const { c, calls } = client(201, {
      ok: true,
      user: { id: 'u', email: 'a@b.co' },
      verification: 'otp',
    });
    const r = await signUp(c, { name: 'Ada', email: 'A@b.co', password: 'Abcdefg1!' });
    expect(r).toEqual({ ok: true, value: { email: 'a@b.co' } });
    expect(calls[0]?.url).toBe('https://bookhushly.com/api/auth/signup');
    expect(calls[0]?.init.method).toBe('POST');
    expect(sentBody(calls[0])).toEqual({
      name: 'Ada',
      email: 'A@b.co',
      password: 'Abcdefg1!',
    });
  });
  it('400 invalid_input maps fields', async () => {
    const { c } = client(400, { error: 'x', code: 'invalid_input', fields: { email: 'invalid' } });
    expect(await signUp(c, { name: 'A', email: 'x', password: 'p' })).toEqual({
      ok: false,
      error: { kind: 'invalid', fields: { email: 'Enter a valid email address' } },
    });
  });
  it('400 without fields is invalid with no field messages', async () => {
    const { c } = client(400, { error: 'x', code: 'invalid_input' });
    expect(await signUp(c, { name: 'A', email: 'a@b.co', password: 'p' })).toEqual({
      ok: false,
      error: { kind: 'invalid', fields: {} },
    });
  });
  it('409 email_taken', async () => {
    const { c } = client(409, { error: 'x', code: 'email_taken' });
    expect(await signUp(c, input)).toEqual({ ok: false, error: { kind: 'emailTaken' } });
  });
  it('422 weak_password with and without fields', async () => {
    const a = client(422, { error: 'x', code: 'weak_password', fields: { password: 'special' } });
    expect(await signUp(a.c, { ...input, password: 'Abcdefg1' })).toEqual({
      ok: false,
      error: { kind: 'weakPassword', fields: { password: 'Use one of @$!%*?&' } },
    });
    const b = client(422, { error: 'x', code: 'weak_password' });
    expect(await signUp(b.c, input)).toEqual({
      ok: false,
      error: { kind: 'weakPassword', fields: { password: 'Choose a stronger password' } },
    });
  });
  it('429 is transient with retry-after; 503 with and without code are transient; 500 failed', async () => {
    const r429 = client(429, { code: 'rate_limited', retry_after: 12 }, { 'retry-after': '12' });
    expect(await signUp(r429.c, input)).toEqual({
      ok: false,
      error: { kind: 'transient', retryAfterSec: 12 },
    });
    const r503 = client(503, { error: 'x' }, { 'retry-after': '30' });
    expect((await signUp(r503.c, input)).ok).toBe(false);
    expect(await signUp(client(503, { error: 'x' }).c, input)).toEqual({
      ok: false,
      error: { kind: 'transient' },
    });
    expect(await signUp(client(503, { error: 'x', code: 'unavailable' }).c, input)).toEqual({
      ok: false,
      error: { kind: 'transient' },
    });
    expect(await signUp(client(500, { error: 'x', code: 'signup_failed' }).c, input)).toEqual({
      ok: false,
      error: { kind: 'failed' },
    });
  });
  it('network and timeout are transient', async () => {
    const network = make(() => Promise.reject(new TypeError('Network request failed')), []).c;
    expect(await signUp(network, input)).toEqual({ ok: false, error: { kind: 'transient' } });
  });
});

describe('resendConfirmation and forgotPassword', () => {
  it('202 is ok, 400 is invalid', async () => {
    const resend = client(202, { ok: true });
    expect(await resendConfirmation(resend.c, 'a@b.co')).toEqual({ ok: true, value: true });
    expect(resend.calls[0]?.url).toBe('https://bookhushly.com/api/auth/resend-confirmation');
    expect(sentBody(resend.calls[0])).toEqual({ email: 'a@b.co' });
    const forgot = client(202, { ok: true });
    expect(await forgotPassword(forgot.c, 'a@b.co')).toEqual({ ok: true, value: true });
    expect(forgot.calls[0]?.url).toBe('https://bookhushly.com/api/auth/forgot-password');
    expect(await forgotPassword(client(400, { error: 'x', code: 'invalid_input' }).c, 'x')).toEqual(
      {
        ok: false,
        error: { kind: 'invalid', fields: {} },
      },
    );
  });
});

describe('resetPassword', () => {
  it('posts the password with the bearer token', async () => {
    const { c, calls } = client(200, { ok: true });
    expect(await resetPassword(c, 'Abcdefg1!')).toEqual({ ok: true, value: true });
    expect(calls[0]?.url).toBe('https://bookhushly.com/api/auth/reset-password');
    expect(sentBody(calls[0])).toEqual({ password: 'Abcdefg1!' });
    expect(headersOf(calls[0]).Authorization).toBe('Bearer tok');
  });
  it('401 unauthorized, 422 policy', async () => {
    expect(await resetPassword(client(401, { code: 'unauthorized' }).c, 'Abcdefg1!')).toEqual({
      ok: false,
      error: { kind: 'unauthorized' },
    });
    expect(
      await resetPassword(
        client(422, { code: 'weak_password', fields: { password: 'policy' } }).c,
        'Abcdefg1!',
      ),
    ).toEqual({
      ok: false,
      error: { kind: 'weakPassword', fields: { password: 'Choose a stronger password' } },
    });
  });
});

describe('deleteAccount', () => {
  it('sends confirm DELETE and never a password', async () => {
    const { c, calls } = client(200, { ok: true, status: 'deleted' });
    expect(await deleteAccount(c)).toEqual({ ok: true, value: true });
    expect(calls[0]?.url).toBe('https://bookhushly.com/api/account/delete');
    expect(sentBody(calls[0])).toEqual({ confirm: 'DELETE' });
  });
  it('409 lists every blocker; 403 not_customer carries the message', async () => {
    const blockers = [
      { code: 'has_active_bookings', detail: 'You have a booking that has not ended yet.' },
      { code: 'has_wallet_balance', detail: 'Your wallet still has ₦2,000.' },
    ];
    expect(
      await deleteAccount(client(409, { code: 'has_active_bookings', detail: 'x', blockers }).c),
    ).toEqual({
      ok: false,
      error: { kind: 'blocked', reasons: blockers },
    });
    expect(
      await deleteAccount(
        client(403, {
          error: 'Business and staff accounts are closed through support.',
          code: 'not_customer',
        }).c,
      ),
    ).toEqual({
      ok: false,
      error: {
        kind: 'notCustomer',
        message: 'Business and staff accounts are closed through support.',
      },
    });
  });
  it('409 with only code and detail still blocks; 403 without a message uses a default', async () => {
    expect(
      await deleteAccount(client(409, { code: 'open_dispute', detail: 'Open dispute.' }).c),
    ).toEqual({
      ok: false,
      error: { kind: 'blocked', reasons: [{ code: 'open_dispute', detail: 'Open dispute.' }] },
    });
    expect(await deleteAccount(client(403, { code: 'not_customer' }).c)).toEqual({
      ok: false,
      error: { kind: 'notCustomer', message: 'This account is closed through support.' },
    });
  });
  it('401 is unauthorized (the client already tried one refresh); 400 confirmation_required is invalid', async () => {
    expect(await deleteAccount(client(401, { code: 'unauthorized' }).c)).toEqual({
      ok: false,
      error: { kind: 'unauthorized' },
    });
    expect(await deleteAccount(client(400, { code: 'confirmation_required' }).c)).toEqual({
      ok: false,
      error: { kind: 'invalid', fields: {} },
    });
    expect(await deleteAccount(client(500, { code: 'delete_failed' }).c)).toEqual({
      ok: false,
      error: { kind: 'failed' },
    });
  });
});
