# UI-B — Entry flow, native accounts and customer tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Welcome, sign-in, native sign-up with a 6-digit email code, forgot/reset password, in-app account deletion and the customer intro tour, plus the pre-mode screens, all on the UI-A kit and the web PR #206 API.

**Architecture:** Pure domain helpers (password rules, masking, cooldown, error mapping, deletion plan) under `features/auth/domain` and `shared/lib`; one typed API module (`accountApi.ts`) over the existing `api` client; session helpers wrap supabase-js (`verifyOtp`, password check); the auth store gains a `recovery` flag that route resolution honours; screens are presentational with thin route files in `src/app`.

**Tech Stack:** Expo SDK 57, RN 0.86, React 19.2 + React Compiler, expo-router, supabase-js, zustand v5, zod v4, Jest (jest-expo) + RNTL v14 (async).

**Spec:** `docs/superpowers/specs/2026-10-08-ui-b-entry-accounts-design.md`. Contract source of truth: `../web/docs/mobile/NATIVE_AUTH_API.md` (code-verified summary in the spec §4–§5). References: `docs/design-references/2026-10-08-ui-b-entry-accounts-mobbin.md`.

## Global Constraints

- API base URL is the apex `https://bookhushly.com` (via `env.apiBaseUrl`); never `www`.
- Never call `supabase.auth.signUp` or `supabase.auth.updateUser({ password })`. Sign-up only via `POST /api/auth/signup`; password change only via `POST /api/auth/reset-password`.
- Never send `password` to `/api/account/delete`; the app checks it with `signInWithPassword` first.
- Transient failures (429, 503 without `code`, timeout, network) are never shown in red and never as a refusal; copy: "We couldn't reach Bookhushly — try again in a minute" (with seconds when known).
- `resendConfirmation` and `forgotPassword` always continue to the code screen (no account-existence leak).
- Password rules (must equal the server): ≥ 8 characters, an upper-case letter `[A-Z]`, a lower-case letter `[a-z]`, a digit `\d`, one of `@$!%*?&`, and ≤ 72 UTF-8 bytes.
- Leaving the new-password screen (or a cold start mid-reset) signs out locally.
- Customer tour behind `CUSTOMER_TOUR_ENABLED = false`.
- No tests call production; no real network or storage in unit tests.
- Kit rules from UI-A hold: semantic tokens only, `src/shared/ui` imports no feature, serif only for display ≥ 32 px, targets ≥ 44 pt, sentence case, `.get()/.set()` for shared values, RNTL v14 matchers (`toBeDisabled()` etc., no `toHaveAccessibilityState`), React Compiler lint (no `Date.now()` in render).
- Hooks reject `any`, `@ts-ignore`, `console.log`, raw hex, `fontWeight`, cross-feature imports (routes may import across features), `git add -A`, commits on `main`, Claude trailers.
- Every task ends green: `npx tsc --noEmit`, `npx expo lint`, `npx jest <touched>`; full `npx jest` before each commit. Commit on `feat/ui-b-entry-accounts`, specific paths.

## Review Focus

1. **A sign-up retried after a timeout gets 409** — the user must land on the code screen option, not a dead end. Pinned by: Task 6 test "409 offers Verify this email which resends and opens the code screen".
2. **App killed while on New password** — next launch must not open the app signed in. Pinned by: Task 3 test "a cold start with the recovery marker signs out locally".
3. **Multibyte passwords** (e.g. emoji) near the 72-byte limit — the checklist must flag `tooLong` exactly as the server does. Pinned by: Task 1 test with a 19-emoji password.
4. **Delete pressed twice / response lost** — no double request; a 401 after an uncertain delete resolves via `refreshSession` → `user_banned` = deleted. Pinned by: Task 9 tests.
5. **Code pasted with spaces or from autofill with a trailing newline** — digits only, verifies once. Pinned by: Task 4 `CodeField` test and Task 7 auto-verify-once test.

---

### Task 1: Pure helpers — password rules, field messages, email mask, cooldown

**Files:**
- Create: `src/features/auth/domain/passwordRules.ts`, `src/features/auth/domain/signUpErrors.ts`, `src/shared/lib/maskEmail.ts`, `src/shared/lib/cooldown.ts`
- Test: `src/features/auth/domain/__tests__/passwordRules.test.ts`, `src/features/auth/domain/__tests__/signUpErrors.test.ts`, `src/shared/lib/__tests__/maskEmail.test.ts`, `src/shared/lib/__tests__/cooldown.test.ts`

**Interfaces:**
- Produces:
  - `type RuleId = 'length' | 'uppercase' | 'lowercase' | 'number' | 'special'`; `RULES: readonly { id: RuleId; label: string }[]`; `passwordRules(pw: string): { met: Record<RuleId, boolean>; tooLong: boolean; ok: boolean }`.
  - `type FieldErrors = { name?: string; email?: string; password?: string }`; `fieldMessages(fields: Record<string, string> | undefined): FieldErrors`.
  - `maskEmail(email: string): string`.
  - `cooldownLeft(startedAtMs: number, nowMs: number, seconds: number): number` (whole seconds left, ≥ 0).

- [ ] **Step 1: Write the failing tests**

`passwordRules.test.ts`:

```ts
import { passwordRules, RULES } from '@/features/auth/domain/passwordRules';

it('lists the five server rules in order', () => {
  expect(RULES.map((r) => r.id)).toEqual(['length', 'uppercase', 'lowercase', 'number', 'special']);
});

it('marks each rule', () => {
  expect(passwordRules('').met).toEqual({ length: false, uppercase: false, lowercase: false, number: false, special: false });
  expect(passwordRules('Abcdefg1!').met).toEqual({ length: true, uppercase: true, lowercase: true, number: true, special: true });
  expect(passwordRules('Abcdefg1!').ok).toBe(true);
});

it('only @$!%*?& count as special', () => {
  expect(passwordRules('Abcdefg1#').met.special).toBe(false);
  expect(passwordRules('Abcdefg1&').met.special).toBe(true);
});

it('length counts characters, the cap counts UTF-8 bytes (72)', () => {
  expect(passwordRules('Ab1!' + 'a'.repeat(68)).tooLong).toBe(false); // 72 bytes
  expect(passwordRules('Ab1!' + 'a'.repeat(69)).tooLong).toBe(true); // 73 bytes
  const emoji = 'Ab1!' + '😀'.repeat(17); // 4 + 68 = 72 bytes
  expect(passwordRules(emoji).tooLong).toBe(false);
  expect(passwordRules(emoji + '😀').tooLong).toBe(true); // 76 bytes
  expect(passwordRules(emoji + '😀').ok).toBe(false);
});
```

`signUpErrors.test.ts`:

```ts
import { fieldMessages } from '@/features/auth/domain/signUpErrors';

it('maps server field reasons to messages', () => {
  expect(fieldMessages({ name: 'required', email: 'invalid', password: 'length,special' })).toEqual({
    name: 'Enter your name',
    email: 'Enter a valid email address',
    password: 'Use at least 8 characters and one of @$!%*?&',
  });
  expect(fieldMessages({ name: 'too_long' }).name).toBe('Use 100 characters or fewer');
  expect(fieldMessages({ email: 'required' }).email).toBe('Enter your email');
  expect(fieldMessages({ password: 'too_long' }).password).toBe('That password is too long');
  expect(fieldMessages({ password: 'policy' }).password).toBe('Choose a stronger password');
  expect(fieldMessages(undefined)).toEqual({});
});
```

`maskEmail.test.ts`:

```ts
import { maskEmail } from '@/shared/lib/maskEmail';

it('keeps the first and last letter of the local part', () => {
  expect(maskEmail('adaeze@gmail.com')).toBe('a•••e@gmail.com');
  expect(maskEmail('ab@x.co')).toBe('a•@x.co');
  expect(maskEmail('a@x.co')).toBe('a@x.co');
  expect(maskEmail('not-an-email')).toBe('not-an-email');
});
```

`cooldown.test.ts`:

```ts
import { cooldownLeft } from '@/shared/lib/cooldown';

it('counts down whole seconds and stops at zero', () => {
  expect(cooldownLeft(1_000, 1_000, 60)).toBe(60);
  expect(cooldownLeft(1_000, 1_500, 60)).toBe(60);
  expect(cooldownLeft(1_000, 31_000, 60)).toBe(30);
  expect(cooldownLeft(1_000, 61_000, 60)).toBe(0);
  expect(cooldownLeft(1_000, 999_000, 60)).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/auth/domain src/shared/lib/__tests__/maskEmail.test.ts src/shared/lib/__tests__/cooldown.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`passwordRules.ts`:

```ts
export type RuleId = 'length' | 'uppercase' | 'lowercase' | 'number' | 'special';

// Must equal the server (web lib/auth/password.js): 5 rules + a 72-byte bcrypt cap.
export const RULES: readonly { id: RuleId; label: string }[] = [
  { id: 'length', label: 'At least 8 characters' },
  { id: 'uppercase', label: 'An upper-case letter' },
  { id: 'lowercase', label: 'A lower-case letter' },
  { id: 'number', label: 'A number' },
  { id: 'special', label: 'One of @$!%*?&' },
];

const MAX_BYTES = 72;

function utf8Bytes(s: string): number {
  return new TextEncoder().encode(s).length;
}

export function passwordRules(pw: string) {
  const met: Record<RuleId, boolean> = {
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    number: /\d/.test(pw),
    special: /[@$!%*?&]/.test(pw),
  };
  const tooLong = utf8Bytes(pw) > MAX_BYTES;
  return { met, tooLong, ok: !tooLong && Object.values(met).every(Boolean) };
}
```

(If `TextEncoder` is missing under Hermes/Jest, use `unescape(encodeURIComponent(s)).length` instead and note it in the report; check by running the test.)

`signUpErrors.ts`:

```ts
import { RULES, type RuleId } from './passwordRules';

export type FieldErrors = { name?: string; email?: string; password?: string };

const RULE_HINT: Record<RuleId, string> = {
  length: 'at least 8 characters',
  uppercase: 'an upper-case letter',
  lowercase: 'a lower-case letter',
  number: 'a number',
  special: 'one of @$!%*?&',
};

function passwordMessage(reason: string): string {
  if (reason === 'too_long') return 'That password is too long';
  if (reason === 'policy') return 'Choose a stronger password';
  const ids = reason.split(',').filter((r): r is RuleId => RULES.some((x) => x.id === r));
  if (ids.length === 0) return 'Choose a stronger password';
  const parts = ids.map((id) => RULE_HINT[id]);
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1) ?? ''}`;
  return `Use ${list ?? ''}`;
}

export function fieldMessages(fields: Record<string, string> | undefined): FieldErrors {
  if (fields === undefined) return {};
  const out: FieldErrors = {};
  if (fields.name !== undefined) out.name = fields.name === 'too_long' ? 'Use 100 characters or fewer' : 'Enter your name';
  if (fields.email !== undefined) out.email = fields.email === 'required' ? 'Enter your email' : 'Enter a valid email address';
  if (fields.password !== undefined) out.password = passwordMessage(fields.password);
  return out;
}
```

`maskEmail.ts`:

```ts
// a•••e@gmail.com — enough to recognise the address on a shared screen.
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length === 1) return email;
  if (local.length === 2) return `${local[0] ?? ''}•${domain}`;
  return `${local[0] ?? ''}•••${local.at(-1) ?? ''}${domain}`;
}
```

`cooldown.ts`:

```ts
export function cooldownLeft(startedAtMs: number, nowMs: number, seconds: number): number {
  const left = seconds - Math.floor((nowMs - startedAtMs) / 1000);
  return Math.max(0, Math.min(seconds, left));
}
```

- [ ] **Step 4: Run tests to verify they pass** — same command; Expected: PASS. Then `npx tsc --noEmit && npx expo lint`.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/domain/passwordRules.ts src/features/auth/domain/signUpErrors.ts src/shared/lib/maskEmail.ts src/shared/lib/cooldown.ts src/features/auth/domain/__tests__/passwordRules.test.ts src/features/auth/domain/__tests__/signUpErrors.test.ts src/shared/lib/__tests__/maskEmail.test.ts src/shared/lib/__tests__/cooldown.test.ts
git commit -m "feat(auth): password rules matching the server, sign-up field messages, email mask and resend cooldown"
```

---

### Task 2: Account API module

**Files:**
- Modify: `src/shared/lib/errors.ts` (keep the body on 4xx `unknown` errors)
- Create: `src/features/auth/api/accountApi.ts`, `src/features/auth/schemas/account.ts`
- Test: `src/features/auth/api/__tests__/accountApi.test.ts`, `src/shared/lib/__tests__/errors.test.ts` (extend if it exists)

**Interfaces:**
- Consumes: `createApiClient` / `ApiClient` (`src/shared/api/client.ts`), `errorFromResponse` (`src/shared/lib/errors.ts`), `fieldMessages` (Task 1).
- Produces (all take `client: Pick<ApiClient, 'request'>` first):

```ts
export type AccountFailure =
  | { kind: 'invalid'; fields: FieldErrors }          // 400 invalid_input (fields may be {})
  | { kind: 'weakPassword'; fields: FieldErrors }     // 422 weak_password
  | { kind: 'emailTaken' }                            // 409 email_taken
  | { kind: 'unauthorized' }                          // 401
  | { kind: 'notCustomer'; message: string }          // 403 not_customer
  | { kind: 'blocked'; reasons: { code: string; detail: string }[] } // 409 blockers
  | { kind: 'transient'; retryAfterSec?: number }     // 429, 503 w/o code, timeout, network, 503 unavailable
  | { kind: 'failed' };                               // 500 and anything else
export function signUp(client, input: { name: string; email: string; password: string }): Promise<Result<{ email: string }, AccountFailure>>;
export function resendConfirmation(client, email: string): Promise<Result<true, AccountFailure>>;
export function forgotPassword(client, email: string): Promise<Result<true, AccountFailure>>;
export function resetPassword(client, password: string): Promise<Result<true, AccountFailure>>;
export function deleteAccount(client): Promise<Result<true, AccountFailure>>;
```

(The shared `api` client attaches the current session's Bearer token itself; `resetPassword` and `deleteAccount` rely on that. Signup's `503 {code:"unavailable"}` is also `transient`: it means Supabase's own email/sign-up limit.)

- [ ] **Step 1: Write the failing tests**

`accountApi.test.ts` (uses a real `createApiClient` with a fake `fetchFn`, so the error taxonomy is exercised end to end):

```ts
import { deleteAccount, forgotPassword, resendConfirmation, resetPassword, signUp } from '@/features/auth/api/accountApi';
import { createApiClient } from '@/shared/api/client';

function client(status: number, body: unknown, headers: Record<string, string> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const c = createApiClient({
    baseUrl: 'https://bookhushly.com',
    fetchFn: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
    }) as unknown as typeof fetch,
    getAccessToken: async () => 'tok',
    refreshSession: async () => ({ failure: 'invalid' as const }),
    clock: { recordServerDate: () => undefined },
    appVersion: '1.0.0 (1)',
    platform: 'ios',
    sleep: async () => undefined,
  });
  return { c, calls };
}

describe('signUp', () => {
  it('201 returns the normalised email and posts name/email/password only', async () => {
    const { c, calls } = client(201, { ok: true, user: { id: 'u', email: 'a@b.co' }, verification: 'otp' });
    const r = await signUp(c, { name: 'Ada', email: 'A@b.co', password: 'Abcdefg1!' });
    expect(r).toEqual({ ok: true, value: { email: 'a@b.co' } });
    expect(calls[0]?.url).toBe('https://bookhushly.com/api/auth/signup');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ name: 'Ada', email: 'A@b.co', password: 'Abcdefg1!' });
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
    expect(await signUp(c, { name: 'A', email: 'a@b.co', password: 'p' })).toEqual({ ok: false, error: { kind: 'invalid', fields: {} } });
  });
  it('409 email_taken', async () => {
    const { c } = client(409, { error: 'x', code: 'email_taken' });
    expect(await signUp(c, { name: 'A', email: 'a@b.co', password: 'Abcdefg1!' })).toEqual({ ok: false, error: { kind: 'emailTaken' } });
  });
  it('422 weak_password with and without fields', async () => {
    const a = client(422, { error: 'x', code: 'weak_password', fields: { password: 'special' } });
    expect(await signUp(a.c, { name: 'A', email: 'a@b.co', password: 'Abcdefg1' })).toEqual({
      ok: false,
      error: { kind: 'weakPassword', fields: { password: 'Use one of @$!%*?&' } },
    });
    const b = client(422, { error: 'x', code: 'weak_password' });
    expect(await signUp(b.c, { name: 'A', email: 'a@b.co', password: 'Abcdefg1!' })).toEqual({
      ok: false,
      error: { kind: 'weakPassword', fields: { password: 'Choose a stronger password' } },
    });
  });
  it('429 is transient with retry-after; 503 with and without code are transient; 500 failed', async () => {
    const r429 = client(429, { code: 'rate_limited', retry_after: 12 }, { 'retry-after': '12' });
    expect(await signUp(r429.c, { name: 'A', email: 'a@b.co', password: 'Abcdefg1!' })).toEqual({ ok: false, error: { kind: 'transient', retryAfterSec: 12 } });
    const r503 = client(503, { error: 'x' }, { 'retry-after': '30' });
    expect((await signUp(r503.c, { name: 'A', email: 'a@b.co', password: 'Abcdefg1!' })).ok).toBe(false);
    expect(await signUp(client(503, { error: 'x' }).c, { name: 'A', email: 'a@b.co', password: 'Abcdefg1!' })).toEqual({ ok: false, error: { kind: 'transient' } });
    expect(await signUp(client(503, { error: 'x', code: 'unavailable' }).c, { name: 'A', email: 'a@b.co', password: 'Abcdefg1!' })).toEqual({ ok: false, error: { kind: 'transient' } });
    expect(await signUp(client(500, { error: 'x', code: 'signup_failed' }).c, { name: 'A', email: 'a@b.co', password: 'Abcdefg1!' })).toEqual({ ok: false, error: { kind: 'failed' } });
  });
});

describe('resendConfirmation and forgotPassword', () => {
  it('202 is ok, 400 is invalid', async () => {
    expect(await resendConfirmation(client(202, { ok: true }).c, 'a@b.co')).toEqual({ ok: true, value: true });
    expect(await forgotPassword(client(202, { ok: true }).c, 'a@b.co')).toEqual({ ok: true, value: true });
    expect(await forgotPassword(client(400, { error: 'x', code: 'invalid_input' }).c, 'x')).toEqual({
      ok: false,
      error: { kind: 'invalid', fields: {} },
    });
  });
});

describe('resetPassword', () => {
  it('posts the password with the bearer token', async () => {
    const { c, calls } = client(200, { ok: true });
    expect(await resetPassword(c, 'Abcdefg1!')).toEqual({ ok: true, value: true });
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });
  it('401 unauthorized, 422 policy', async () => {
    expect(await resetPassword(client(401, { code: 'unauthorized' }).c, 'Abcdefg1!')).toEqual({ ok: false, error: { kind: 'unauthorized' } });
    expect(await resetPassword(client(422, { code: 'weak_password', fields: { password: 'policy' } }).c, 'Abcdefg1!')).toEqual({
      ok: false,
      error: { kind: 'weakPassword', fields: { password: 'Choose a stronger password' } },
    });
  });
});

describe('deleteAccount', () => {
  it('sends confirm DELETE and never a password', async () => {
    const { c, calls } = client(200, { ok: true, status: 'deleted' });
    expect(await deleteAccount(c)).toEqual({ ok: true, value: true });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ confirm: 'DELETE' });
  });
  it('409 lists every blocker; 403 not_customer carries the message', async () => {
    const blockers = [
      { code: 'has_active_bookings', detail: 'You have a booking that has not ended yet.' },
      { code: 'has_wallet_balance', detail: 'Your wallet still has ₦2,000.' },
    ];
    expect(await deleteAccount(client(409, { code: 'has_active_bookings', detail: 'x', blockers }).c)).toEqual({
      ok: false,
      error: { kind: 'blocked', reasons: blockers },
    });
    expect(await deleteAccount(client(403, { error: 'Business and staff accounts are closed through support.', code: 'not_customer' }).c)).toEqual({
      ok: false,
      error: { kind: 'notCustomer', message: 'Business and staff accounts are closed through support.' },
    });
  });
  it('401 is unauthorized (the client already tried one refresh)', async () => {
    expect(await deleteAccount(client(401, { code: 'unauthorized' }).c)).toEqual({ ok: false, error: { kind: 'unauthorized' } });
  });
});
```

(For the 403 case the client maps 403 to `{kind:'forbidden', code}` with no message; Step 3 adds the body to `forbidden` too so the message survives.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/auth/api`
Expected: FAIL.

- [ ] **Step 3: Implement**

`errors.ts`: add `body?: unknown` to the `forbidden` and `unknown` variants and pass it from `errorFromResponse`:

```ts
  | { kind: 'forbidden'; code?: string; body?: unknown }
  // …
  | { kind: 'unknown'; status?: number; code?: string; body?: unknown };
```

```ts
  if (status === 403) return code ? { kind: 'forbidden', code, body } : { kind: 'forbidden', body };
  // …
  return code ? { kind: 'unknown', status, code, body } : { kind: 'unknown', status, body };
```

Update any existing `errors.test.ts` expectations that use `toEqual` on these variants (add `body`). Run `npx jest src/shared` to find them.

`schemas/account.ts`:

```ts
import { z } from 'zod';

export const signUpOk = z.object({ ok: z.literal(true), user: z.object({ id: z.string(), email: z.string() }) });
export const acceptedOk = z.object({ ok: z.literal(true) });
export const fieldsBody = z.object({ fields: z.record(z.string(), z.string()).optional() }).passthrough();
export const blockersBody = z.object({
  blockers: z.array(z.object({ code: z.string(), detail: z.string() })).optional(),
  detail: z.string().optional(),
  code: z.string().optional(),
}).passthrough();
export const messageBody = z.object({ error: z.string().optional() }).passthrough();
```

`accountApi.ts`:

```ts
import { fieldMessages, type FieldErrors } from '@/features/auth/domain/signUpErrors';
import { acceptedOk, blockersBody, fieldsBody, messageBody, signUpOk } from '@/features/auth/schemas/account';
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

const fieldsOf = (body: unknown) => {
  const p = fieldsBody.safeParse(body);
  return p.success ? p.data.fields : undefined;
};

function toFailure(e: ApiError): AccountFailure {
  switch (e.kind) {
    case 'network':
    case 'timeout':
    case 'aborted':
      return { kind: 'transient' };
    case 'rateLimited':
      return e.retryAfterSec === undefined ? { kind: 'transient' } : { kind: 'transient', retryAfterSec: e.retryAfterSec };
    case 'unavailable':
      // 503 without a code (proxy, Redis down) and signup's 503 unavailable are both temporary.
      return e.status === 503 ? { kind: 'transient' } : { kind: 'failed' };
    case 'auth':
      return { kind: 'unauthorized' };
    case 'forbidden': {
      if (e.code !== 'not_customer') return { kind: 'failed' };
      const m = messageBody.safeParse(e.body);
      return { kind: 'notCustomer', message: m.success && m.data.error ? m.data.error : 'This account is closed through support.' };
    }
    case 'conflict': {
      if (e.code === 'email_taken') return { kind: 'emailTaken' };
      const b = blockersBody.safeParse(e.body);
      const reasons = b.success ? (b.data.blockers ?? (b.data.code && b.data.detail ? [{ code: b.data.code, detail: b.data.detail }] : [])) : [];
      return reasons.length > 0 ? { kind: 'blocked', reasons } : { kind: 'failed' };
    }
    case 'unknown':
      if (e.status === 400 && (e.code === 'invalid_input' || e.code === 'confirmation_required'))
        return { kind: 'invalid', fields: fieldMessages(fieldsOf(e.body)) };
      if (e.status === 422 && e.code === 'weak_password') {
        const f = fieldMessages(fieldsOf(e.body));
        return { kind: 'weakPassword', fields: f.password ? f : { ...f, password: 'Choose a stronger password' } };
      }
      return { kind: 'failed' };
    case 'notFound':
    case 'validation':
      return { kind: 'failed' };
  }
}

async function call<T, R>(client: Client, path: string, body: unknown, schema: Parameters<Client['request']>[1]['schema'], map: (v: T) => R): Promise<Result<R, AccountFailure>> {
  const r = await client.request<T>(path, { method: 'POST', body, schema: schema as never, timeoutMs: 20_000 });
  return r.ok ? ok(map(r.value)) : err(toFailure(r.error));
}

export function signUp(client: Client, input: { name: string; email: string; password: string }) {
  return call(client, '/api/auth/signup', input, signUpOk, (v: { user: { email: string } }) => ({ email: v.user.email }));
}
export function resendConfirmation(client: Client, email: string) {
  return call(client, '/api/auth/resend-confirmation', { email }, acceptedOk, () => true as const);
}
export function forgotPassword(client: Client, email: string) {
  return call(client, '/api/auth/forgot-password', { email }, acceptedOk, () => true as const);
}
export function resetPassword(client: Client, password: string) {
  return call(client, '/api/auth/reset-password', { password }, acceptedOk, () => true as const);
}
// Never sends `password`: the app checks it itself (spec decision 3).
export function deleteAccount(client: Client) {
  return call(client, '/api/account/delete', { confirm: 'DELETE' }, acceptedOk, () => true as const);
}
```

The `call` helper's generic schema typing may need adjusting to satisfy `tsc` without `any` (e.g. give each export its own `client.request(path, { method: 'POST', body, schema: X })` and map the result inline). Keep `toFailure` as written. No casts to `any`; `as never` is acceptable only if tsc requires it — prefer the inline form.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/auth src/shared && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/errors.ts src/shared/lib/__tests__ src/features/auth/api/accountApi.ts src/features/auth/schemas/account.ts src/features/auth/api/__tests__/accountApi.test.ts
git commit -m "feat(auth): typed client for sign-up, resend, forgot, reset and account deletion"
```

---

### Task 3: Session helpers, sign-in errors, recovery state and route resolution

**Files:**
- Modify: `src/features/auth/domain/signInErrors.ts`, `src/features/auth/hooks/useAuth.ts`, `src/features/auth/api/session.ts`, `src/features/mode/domain/route.ts`, `src/features/mode/hooks/useRouteStore.ts`, `src/app/_layout.tsx`
- Create: `src/features/auth/domain/verifyErrors.ts`, `src/features/auth/domain/recovery.ts`, `src/features/auth/hooks/useAuthNotice.ts`
- Test: `src/features/auth/domain/__tests__/signInErrors.test.ts`, `src/features/auth/domain/__tests__/verifyErrors.test.ts`, `src/features/auth/domain/__tests__/recovery.test.ts`, `src/features/mode/domain/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `secureKv` (`src/shared/platform/secureStore.ts`), `supabase`, `wipeOnSignOut`, `performSignOut`.
- Produces:
  - `SignInError` gains `'accountClosed'` (`user_banned`); `emailNotConfirmed` matched by code **or** message `Email not confirmed`; copy: `emailNotConfirmed` → "Confirm your email first. We'll send you a code." and `accountClosed` → "This account was closed. Contact support@bookhushly.com if this is a mistake."
  - `type VerifyError = 'badCode' | 'transient' | 'unknown'`; `mapVerifyError(e: { status?: number; code?: string; name?: string; message?: string }): VerifyError` — `otp_expired`, `invalid_otp`, 400/403, or message containing "expired" / "invalid" → `badCode`; 429, 5xx, `AuthRetryableFetchError`, status 0 → `transient`; else `unknown`.
  - `RECOVERY_KEY = 'bh.auth.recovery'`; `createRecovery(kv: KeyValue)` → `{ begin(): Promise<void>; finish(): Promise<void>; pending(): Promise<boolean> }`.
  - `useAuth` adds: `recovery: boolean`; `verifyCode(email, code, type: 'signup' | 'recovery'): Promise<VerifyError | null>` (for `recovery` it calls `beginRecovery` first and keeps `recovery = true` on success; on failure it clears it); `finishRecovery(): Promise<void>`; `abandonRecovery(): Promise<void>` (local sign-out with `keepOfflineData: true`, clears recovery); `checkPassword(password): Promise<'ok' | 'wrong' | 'transient'>` (uses the signed-in email); `signOutAfterDeletion(): Promise<void>` (wipe via `wipeOnSignOut`, then local sign-out, then sets the notice).
  - `useAuthNotice`: zustand `{ notice: 'accountDeleted' | null; set(n); clear() }`.
  - `resolveRoute` input gains `recovery: boolean`; `recovery === true` → `'auth'` (before mode resolution, after `update`).
  - `ROUTE_HREF.auth = '/welcome'` (Task 5 creates the route; until then keep `'/sign-in'` — this task changes it only if Task 5 is done; see Step 3 note).

- [ ] **Step 1: Write the failing tests**

`signInErrors.test.ts` add:

```ts
it('unconfirmed email by code or by message', () => {
  expect(mapSignInError({ status: 400, code: 'email_not_confirmed' })).toBe('emailNotConfirmed');
  expect(mapSignInError({ status: 400, message: 'Email not confirmed' })).toBe('emailNotConfirmed');
});
it('a banned (deleted) account is closed', () => {
  expect(mapSignInError({ status: 400, code: 'user_banned' })).toBe('accountClosed');
});
```

(`Raw` gains `message?: string`.)

`verifyErrors.test.ts`:

```ts
import { mapVerifyError } from '@/features/auth/domain/verifyErrors';

it.each([
  [{ status: 403, code: 'otp_expired' }, 'badCode'],
  [{ status: 400, message: 'Token has expired or is invalid' }, 'badCode'],
  [{ status: 429 }, 'transient'],
  [{ status: 503 }, 'transient'],
  [{ name: 'AuthRetryableFetchError', status: 0 }, 'transient'],
  [{ status: 418 }, 'unknown'],
] as const)('%j → %s', (e, out) => {
  expect(mapVerifyError(e)).toBe(out);
});
```

`recovery.test.ts`:

```ts
import { createRecovery, RECOVERY_KEY } from '@/features/auth/domain/recovery';

function memKv() {
  const m = new Map<string, string>();
  return {
    get: async (k: string) => m.get(k) ?? null,
    set: async (k: string, v: string) => { m.set(k, v); },
    delete: async (k: string) => { m.delete(k); },
    m,
  };
}

it('begin marks, finish clears, pending reads', async () => {
  const kv = memKv();
  const r = createRecovery(kv);
  expect(await r.pending()).toBe(false);
  await r.begin();
  expect(kv.m.has(RECOVERY_KEY)).toBe(true);
  expect(await r.pending()).toBe(true);
  await r.finish();
  expect(await r.pending()).toBe(false);
});

it('an unreadable marker counts as pending (fail safe: sign out)', async () => {
  const r = createRecovery({ get: async () => { throw new Error('x'); }, set: async () => undefined, delete: async () => undefined });
  expect(await r.pending()).toBe(true);
});
```

`route.test.ts` add (read the file's existing fixtures first):

```ts
it('a password reset in progress keeps the sign-in screens in front even when signed in', () => {
  expect(resolveRoute({ versionOk: true, auth: 'signedIn', mode: readyCustomer, chosenMode: null, recovery: true })).toBe('auth');
});
it('an unsupported version still wins over recovery', () => {
  expect(resolveRoute({ versionOk: false, auth: 'signedIn', mode: readyCustomer, chosenMode: null, recovery: true })).toBe('update');
});
```

(Add `recovery: false` to every existing `resolveRoute` call in the test file; `readyCustomer` is whatever ready-customer fixture the file already has.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/auth/domain src/features/mode/domain`
Expected: FAIL.

- [ ] **Step 3: Implement**

`signInErrors.ts`:

```ts
export type SignInError =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'accountClosed'
  | 'rateLimited'
  | 'network'
  | 'unavailable'
  | 'unknown';

type Raw = { status?: number; code?: string; name?: string; message?: string };

export function mapSignInError(e: Raw): SignInError {
  if (e.code === 'invalid_credentials') return 'invalidCredentials';
  if (e.code === 'email_not_confirmed' || e.message === 'Email not confirmed') return 'emailNotConfirmed';
  if (e.code === 'user_banned') return 'accountClosed';
  if (e.status === 429 || e.code === 'over_request_rate_limit') return 'rateLimited';
  if (e.name === 'AuthRetryableFetchError' || e.status === 0) return 'network';
  if (typeof e.status === 'number' && e.status >= 500) return 'unavailable';
  return 'unknown';
}
```

Update `signInCopy`: `emailNotConfirmed: 'Confirm your email first. We'll send you a code.'`, add `accountClosed: 'This account was closed. Contact support@bookhushly.com if this is a mistake.'`. In `SignInScreen.tsx` add `'accountClosed'` to nothing (it is not transient → danger tone).

`verifyErrors.ts`:

```ts
export type VerifyError = 'badCode' | 'transient' | 'unknown';
type Raw = { status?: number; code?: string; name?: string; message?: string };

export function mapVerifyError(e: Raw): VerifyError {
  if (e.status === 429 || e.name === 'AuthRetryableFetchError' || e.status === 0) return 'transient';
  if (typeof e.status === 'number' && e.status >= 500) return 'transient';
  const m = (e.message ?? '').toLowerCase();
  if (e.code === 'otp_expired' || e.code === 'invalid_otp' || m.includes('expired') || m.includes('invalid')) return 'badCode';
  if (e.status === 400 || e.status === 403) return 'badCode';
  return 'unknown';
}
```

`recovery.ts`:

```ts
import type { KeyValue } from '@/shared/lib/kv';

export const RECOVERY_KEY = 'bh.auth.recovery';

// A reset code signs the user in. Until the new password is saved the session must not survive
// a restart (spec decision 4), so a marker records "reset in progress".
export function createRecovery(kv: KeyValue) {
  return {
    begin: () => kv.set(RECOVERY_KEY, '1'),
    finish: () => kv.delete(RECOVERY_KEY),
    async pending(): Promise<boolean> {
      try {
        return (await kv.get(RECOVERY_KEY)) !== null;
      } catch {
        return true;
      }
    },
  };
}
```

`useAuthNotice.ts`:

```ts
import { create } from 'zustand';

export type AuthNotice = 'accountDeleted' | null;

// One-shot message for the Welcome screen after the account is deleted.
export const useAuthNotice = create<{ notice: AuthNotice; set: (n: AuthNotice) => void; clear: () => void }>((set) => ({
  notice: null,
  set: (notice) => { set({ notice }); },
  clear: () => { set({ notice: null }); },
}));
```

`useAuth.ts` — add to the store type and implementation (keep everything existing):

```ts
import { mapVerifyError, type VerifyError } from '@/features/auth/domain/verifyErrors';
import { createRecovery } from '@/features/auth/domain/recovery';
import { useAuthNotice } from '@/features/auth/hooks/useAuthNotice';
import { secureKv } from '@/shared/platform/secureStore';

const recoveryMarker = createRecovery(secureKv);

// in Store:
  recovery: boolean;
  verifyCode: (email: string, code: string, type: 'signup' | 'recovery') => Promise<VerifyError | null>;
  finishRecovery: () => Promise<void>;
  abandonRecovery: () => Promise<void>;
  checkPassword: (password: string) => Promise<'ok' | 'wrong' | 'transient'>;
  signOutAfterDeletion: () => Promise<void>;

// in create(...):
  recovery: false,
  async verifyCode(email, code, type) {
    if (type === 'recovery') {
      set({ recovery: true });
      await recoveryMarker.begin();
    }
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type });
    if (error) {
      if (type === 'recovery') {
        await recoveryMarker.finish();
        set({ recovery: false });
      }
      return mapVerifyError(error);
    }
    return null;
  },
  async finishRecovery() {
    await recoveryMarker.finish();
    set({ recovery: false });
  },
  async abandonRecovery() {
    await recoveryMarker.finish();
    set({ recovery: false });
    await get().signOut({ keepOfflineData: true });
  },
  async checkPassword(password) {
    const s = get().state;
    if (s.status !== 'signedIn') return 'wrong';
    const { error } = await supabase.auth.signInWithPassword({ email: s.email, password });
    if (!error) return 'ok';
    const kind = mapSignInError(error);
    return kind === 'invalidCredentials' ? 'wrong' : 'transient';
  },
  async signOutAfterDeletion() {
    const s = get().state;
    if (s.status === 'signedIn') {
      try {
        await wipeOnSignOut(s.userId);
      } catch {
        // The account is gone server-side; local data is wiped best effort and sign-out still runs.
      }
    }
    await performSignOut({
      remote: () => supabase.auth.signOut({ scope: 'local' }),
      removeLocal: () => sessionStore.removeItem(STORAGE_KEY),
      onSignedOut: () => {
        queryClient.clear();
        get().dispatch({ type: 'SIGNED_OUT' });
      },
    });
    useAuthNotice.getState().set('accountDeleted');
  },
```

Also export `export const recoveryPending = (): Promise<boolean> => recoveryMarker.pending();` from `useAuth.ts` for the session listener. (At `INITIAL_SESSION` the store state is still `loading`, so `abandonRecovery()` → `signOut` skips the gate guard and just signs out locally — intended.)

`session.ts`: in the `INITIAL_SESSION` branch, before dispatching a non-null session, check the marker; if pending, sign out locally and dispatch `SIGNED_OUT`:

```ts
      case 'INITIAL_SESSION':
        void resolveInitialSession(s, () => sessionStore.getItem(STORAGE_KEY)).then(async (resolved) => {
          if (resolved !== null && (await recoveryPending())) {
            // Killed mid-reset: a reset code alone must never leave the user signed in.
            await useAuth.getState().abandonRecovery();
            return;
          }
          dispatch({ type: 'INITIAL_SESSION', session: resolved });
        });
        break;
```

and add a unit test for this path if `session.ts` has a test file; otherwise test `abandonRecovery` via the store with `supabase` mocked (follow the pattern existing auth hook tests use; if none exist, cover it in Task 8's screen test).

`route.ts`: input type gains `recovery: boolean`; after the `versionOk` check add `if (i.recovery) return 'auth';`. `_layout.tsx`: pass `recovery: useAuth((s) => s.recovery)`.

`useRouteStore.ts`: leave `auth: '/sign-in'` here; Task 5 switches it to `'/welcome'` together with the new route.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/auth src/features/mode src/app && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth src/features/mode/domain src/app/_layout.tsx
git commit -m "feat(auth): code verification, password check, reset-in-progress state that never survives a restart, closed-account sign-in"
```

---

### Task 4: Kit additions — PasswordField, CodeField, RuleList, illustration scenes

**Files:**
- Create: `src/shared/ui/PasswordField.tsx`, `src/shared/ui/CodeField.tsx`, `src/shared/ui/RuleList.tsx`
- Modify: `src/shared/ui/Illustration.tsx`, `src/shared/ui/index.ts`
- Test: `src/shared/ui/__tests__/authKit.test.tsx`

**Interfaces:**
- Consumes: `Input`, `Icon`, `Text`, `useDensity`, theme tokens.
- Produces:
  - `PasswordField(props: Omit<InputProps, 'secureTextEntry' | 'right'> & { label: string })` — `Input` with a right-side eye `Pressable` (`accessibilityRole="button"`, label "Show password" / "Hide password"), `autoCapitalize="none"`, `autoCorrect={false}`.
  - `CodeField({ label, value, onChangeText, length = 6, error?, autoFocus?, testID? })` — like `PinField` but digits are **visible** and the hidden input has `textContentType="oneTimeCode"`, `autoComplete="one-time-code"`, `keyboardType="number-pad"`, not secure; `onChangeText` receives digits only, capped at `length` (paste "123 456\n" → "123456").
  - `RuleList({ rules: { id: string; label: string; met: boolean }[]; touched: boolean })` — each row: icon (`CircleCheck` success tone when met; `Circle` muted when unmet), label; before `touched` every row is muted (never red); container `accessibilityLiveRegion="polite"`; each row `accessibilityLabel` "`<label>`, done" / "`<label>`, not yet".
  - `IllustrationName` gains `'welcome' | 'find' | 'pay' | 'showUp'`.

- [ ] **Step 1: Write the failing tests**

`authKit.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { CodeField } from '@/shared/ui/CodeField';
import { Illustration } from '@/shared/ui/Illustration';
import { PasswordField } from '@/shared/ui/PasswordField';
import { RuleList } from '@/shared/ui/RuleList';

it('password field toggles visibility', async () => {
  await render(<PasswordField label="Password" value="x" onChangeText={jest.fn()} />);
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
  expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy();
});

it('code field shows digits, autofills one-time codes and strips paste noise', async () => {
  const onChangeText = jest.fn();
  await render(<CodeField label="Code" value="12" onChangeText={onChangeText} />);
  const input = screen.getByLabelText('Code');
  expect(input.props.textContentType).toBe('oneTimeCode');
  expect(input.props.autoComplete).toBe('one-time-code');
  expect(input.props.secureTextEntry).not.toBe(true);
  expect(screen.getAllByText('1', { includeHiddenElements: true })).toHaveLength(1);
  await fireEvent.changeText(input, '123 456\n');
  expect(onChangeText).toHaveBeenCalledWith('123456');
  await fireEvent.changeText(input, '12345678');
  expect(onChangeText).toHaveBeenLastCalledWith('123456');
});

it('rule list is neutral before typing and reports each rule', async () => {
  const rules = [
    { id: 'length', label: 'At least 8 characters', met: false },
    { id: 'number', label: 'A number', met: true },
  ];
  const { rerender } = await render(<RuleList rules={rules} touched={false} />);
  expect(screen.getByLabelText('At least 8 characters, not yet')).toBeTruthy();
  await rerender(<RuleList rules={rules} touched />);
  expect(screen.getByLabelText('A number, done')).toBeTruthy();
});

it.each(['welcome', 'find', 'pay', 'showUp'] as const)('renders the %s scene', async (name) => {
  await render(<Illustration name={name} />);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/shared/ui/__tests__/authKit.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`PasswordField.tsx`:

```tsx
import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Icon } from './Icon';
import { Input } from './Input';

type Props = Omit<Parameters<typeof Input>[0], 'secureTextEntry' | 'right'>;

export function PasswordField(props: Props) {
  const [shown, setShown] = useState(false);
  return (
    <Input
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      secureTextEntry={!shown}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          hitSlop={12}
          onPress={() => {
            setShown((s) => !s);
          }}
        >
          <Icon as={shown ? EyeOff : Eye} size="sm" tone="textSecondary" />
        </Pressable>
      }
    />
  );
}
```

`CodeField.tsx`: copy `PinField.tsx`'s structure (one hidden `TextInput`, visible boxes hidden from accessibility, tap focuses) with these differences: render the digit itself (`value[i]`) with `variant="title"` instead of `•`; hidden input props `textContentType="oneTimeCode"`, `autoComplete="one-time-code"`, `keyboardType="number-pad"`, no `secureTextEntry`; `onChangeText={(t) => onChangeText(t.replace(/\D/g, '').slice(0, length))}`; accept `autoFocus`.

`RuleList.tsx`:

```tsx
import { Circle, CircleCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { space } from '@/shared/theme';

import { Icon } from './Icon';
import { Text } from './Text';

type Rule = { id: string; label: string; met: boolean };

// Never red: an unmet rule is a to-do, not an error (spec §5).
export function RuleList({ rules, touched }: { rules: Rule[]; touched: boolean }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: space.s2 }}>
      {rules.map((r) => {
        const done = touched && r.met;
        return (
          <View
            key={r.id}
            accessible
            accessibilityLabel={`${r.label}, ${done ? 'done' : 'not yet'}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}
          >
            <Icon as={done ? CircleCheck : Circle} size="xs" tone={done ? 'successFg' : 'textMuted'} />
            <Text variant="bodySm" tone={done ? 'successFg' : 'textSecondary'}>
              {r.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
```

`Illustration.tsx`: extend `IllustrationName` and add four scenes in the same 160 viewBox style (wash circle background; ink strokes; one violet accent), drawn with `Path`/`Circle` (not `Rect` — react-native-svg `Rect` x/y props are deprecated, use the existing `roundedRect()` path helper in the file):
- `welcome`: a building (rounded rect + windows) and a ticket shape overlapping, violet ticket notch.
- `find`: a magnifier over three small location pins.
- `pay`: a card shape with a ₦ glyph drawn as paths (two vertical strokes + diagonal + two horizontal bars) and a check badge.
- `showUp`: a phone outline with a QR-like 3×3 square grid and a violet check.

`index.ts`: export `PasswordField`, `CodeField`, `RuleList`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/shared/ui && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui
git commit -m "feat(ui): password field with show/hide, one-time code field, password rule list, entry and tour illustrations"
```

---

### Task 5: Welcome and sign-in

**Files:**
- Create: `src/features/auth/screens/WelcomeScreen.tsx`, `src/app/(auth)/welcome.tsx`
- Modify: `src/features/auth/screens/SignInScreen.tsx`, `src/app/(auth)/sign-in.tsx`, `src/features/mode/hooks/useRouteStore.ts` (`auth: '/welcome'`), `src/shared/config/store.ts` (`WEB_URL = 'https://bookhushly.com'`, add `TERMS_URL = 'https://bookhushly.com/terms'`, `PRIVACY_URL = 'https://bookhushly.com/privacy'` — confirm both paths exist in `../web/app` (read-only `ls`) and use the real ones)
- Test: `src/features/auth/screens/__tests__/WelcomeScreen.test.tsx`, `src/features/auth/screens/__tests__/SignInScreen.test.tsx`

**Interfaces:**
- Consumes: `Illustration name="welcome"`, `PasswordField`, `Banner`, `Button`, `TextLink`, `Screen`, `useAuthNotice`, `resendConfirmation` (Task 2), `api` (`src/shared/api/instance`).
- Produces:
  - `WelcomeScreen({ notice: 'accountDeleted' | null, onDismissNotice, onCreateAccount, onSignIn, onOpenLink: (url: string) => void })`.
  - `SignInScreen({ onSubmit, onForgot: (email: string) => void, onCreateAccount, onConfirmEmail: (email: string) => Promise<void> })` — `onSubmit` unchanged; when it resolves `'emailNotConfirmed'` the screen calls `onConfirmEmail(email)` (the route resends and navigates to `/code?purpose=confirm&email=…`).
  - Routes navigate with `router.push('/sign-up')`, `router.push('/sign-in')`, `router.push({ pathname: '/forgot-password', params: { email } })`, `router.push({ pathname: '/code', params: { purpose, email } })` (Tasks 6–8 create those routes; until they exist the pushes compile because expo-router typed routes are strings — if typed routes are on, add the files as empty placeholders returning `null` in this task and fill them later).

Welcome layout (spec §3): `Screen` with `footer` = `Button "Create account"` (primary) + `Button "Sign in"` (secondary) + a `Text variant="caption"` line "By continuing you agree to our Terms and Privacy policy" where Terms and Privacy are `TextLink`s; body: wordmark `Text variant="titleLg"` "Bookhushly" top-left, `Illustration name="welcome" size={200}`, `Text variant="display"` "Book stays and events across Nigeria", `Text variant="body" tone="textSecondary"` "Hotels, apartments and event tickets, paid in naira, in one app."; when `notice === 'accountDeleted'`, a `Banner tone="info"` "Your account was deleted." with action "OK" → `onDismissNotice`.

Sign-in redesign: header back button (to Welcome via `router.back()` in the route), `Text variant="displaySm"` "Welcome back", email `Input`, `PasswordField`, error `Banner` (unchanged tone logic, `accountClosed` danger), `Button "Sign in"`, `TextLink "Forgot password?"` → `onForgot(email)`, footer `TextLink "New here? Create account"` → `onCreateAccount`. Remove the old "Create your account on bookhushly.com" link.

- [ ] **Step 1: Write the failing tests**

`WelcomeScreen.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { WelcomeScreen } from '@/features/auth/screens/WelcomeScreen';

const base = { notice: null, onDismissNotice: jest.fn(), onCreateAccount: jest.fn(), onSignIn: jest.fn(), onOpenLink: jest.fn() };

it('offers create account first and sign in second', async () => {
  await render(<WelcomeScreen {...base} />);
  const buttons = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
  expect(buttons.indexOf('Create account')).toBeLessThan(buttons.indexOf('Sign in'));
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(base.onCreateAccount).toHaveBeenCalled();
});

it('shows the deleted-account notice once', async () => {
  const onDismissNotice = jest.fn();
  await render(<WelcomeScreen {...base} notice="accountDeleted" onDismissNotice={onDismissNotice} />);
  expect(screen.getByText('Your account was deleted.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
  expect(onDismissNotice).toHaveBeenCalled();
});

it('terms and privacy open the web pages', async () => {
  const onOpenLink = jest.fn();
  await render(<WelcomeScreen {...base} onOpenLink={onOpenLink} />);
  await fireEvent.press(screen.getByRole('link', { name: 'Terms' }));
  expect(onOpenLink).toHaveBeenCalledWith(expect.stringContaining('bookhushly.com'));
});
```

`SignInScreen.test.tsx` — update the render calls to pass the new props (`onForgot`, `onCreateAccount`, `onConfirmEmail` as `jest.fn()`), keep existing tests, and add:

```tsx
it('an unconfirmed email starts the confirm flow with the typed email', async () => {
  const onConfirmEmail = jest.fn().mockResolvedValue(undefined);
  await render(<SignInScreen onSubmit={jest.fn().mockResolvedValue('emailNotConfirmed')} onForgot={jest.fn()} onCreateAccount={jest.fn()} onConfirmEmail={onConfirmEmail} />);
  await fill('Ada@B.co', 'Abcdefg1!');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => { expect(onConfirmEmail).toHaveBeenCalledWith('ada@b.co'); });
});

it('forgot password carries the typed email', async () => {
  const onForgot = jest.fn();
  await render(<SignInScreen onSubmit={jest.fn()} onForgot={onForgot} onCreateAccount={jest.fn()} onConfirmEmail={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('Email'), 'ada@b.co');
  await fireEvent.press(screen.getByRole('link', { name: 'Forgot password?' }));
  expect(onForgot).toHaveBeenCalledWith('ada@b.co');
});

it('a closed account is shown as a refusal (danger), not a network problem', async () => {
  await render(<SignInScreen onSubmit={jest.fn().mockResolvedValue('accountClosed')} onForgot={jest.fn()} onCreateAccount={jest.fn()} onConfirmEmail={jest.fn()} />);
  await fill('a@b.co', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText(/This account was closed/)).toBeTruthy();
  expect(screen.getByTestId('banner')).toHaveStyle({ backgroundColor: color.status.danger.bg });
});
```

Delete the old test that asserts the "Create your account on bookhushly.com" link, if present.

- [ ] **Step 2–4:** run (`npx jest src/features/auth/screens`) → FAIL, implement the screens and routes as above, run → PASS; `npx tsc --noEmit && npx expo lint`.

Route `src/app/(auth)/welcome.tsx`:

```tsx
import { router } from 'expo-router';
import { Linking } from 'react-native';

import { WelcomeScreen } from '@/features/auth/screens/WelcomeScreen';
import { useAuthNotice } from '@/features/auth/hooks/useAuthNotice';

export default function WelcomeRoute() {
  const notice = useAuthNotice((s) => s.notice);
  const clear = useAuthNotice((s) => s.clear);
  return (
    <WelcomeScreen
      notice={notice}
      onDismissNotice={clear}
      onCreateAccount={() => { router.push('/sign-up'); }}
      onSignIn={() => { router.push('/sign-in'); }}
      onOpenLink={(url) => { void Linking.openURL(url); }}
    />
  );
}
```

Route `src/app/(auth)/sign-in.tsx`: pass `onConfirmEmail = async (email) => { await resendConfirmation(api, email); router.push({ pathname: '/code', params: { purpose: 'confirm', email } }); }` (always navigate, whatever the resend result — the code screen offers resend), `onForgot`, `onCreateAccount`.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/screens src/app/(auth) src/features/mode/hooks/useRouteStore.ts src/shared/config/store.ts
git commit -m "feat(auth): welcome screen and sign-in with forgot password, create account and unconfirmed-email handoff"
```

---

### Task 6: Create account

**Files:**
- Create: `src/features/auth/screens/SignUpScreen.tsx`, `src/app/(auth)/sign-up.tsx`, `src/features/auth/schemas/signUp.ts`
- Test: `src/features/auth/screens/__tests__/SignUpScreen.test.tsx`

**Interfaces:**
- Consumes: `passwordRules`, `RULES`, `RuleList`, `PasswordField`, `Input`, `Banner`, `signUp`/`resendConfirmation` (via props), `AccountFailure`.
- Produces: `SignUpScreen({ onSubmit: (input) => Promise<Result<{ email: string }, AccountFailure>>, onVerified: (email: string) => void /* navigate to code */, onVerifyExisting: (email: string) => Promise<void>, onSignIn: () => void, onOpenLink })`.

Behaviour:
- Fields Name (`autoComplete="name"`), Email (`keyboardType="email-address"`, lowercase+trim on submit via `signUpSchema`), Password (`PasswordField`, `autoComplete="new-password"`, `textContentType="newPassword"`) with `RuleList` (`touched` once the password is non-empty).
- `Create account` disabled until name non-empty, email shape valid (zod `z.email()`), and `passwordRules(pw).ok`. `loading` while submitting; one request at a time.
- Results: ok → `onVerified(value.email)`; `invalid`/`weakPassword` → field errors under fields; `emailTaken` → `Banner tone="info"` "This email already has an account." with two buttons **Sign in instead** (`onSignIn`) and **Verify this email** (`onVerifyExisting(email)`); `transient` → neutral banner (seconds if known); `failed` → neutral banner "We couldn't create your account. Try again."
- Footer: `TextLink "Already have an account? Sign in"`; terms line as on Welcome.

`schemas/signUp.ts`:

```ts
import { z } from 'zod';

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100, 'Use 100 characters or fewer'),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string(),
});
```

- [ ] **Step 1: Write the failing tests** (`SignUpScreen.test.tsx`):

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SignUpScreen } from '@/features/auth/screens/SignUpScreen';

const ok = (email: string) => Promise.resolve({ ok: true as const, value: { email } });
const props = () => ({ onSubmit: jest.fn(() => ok('ada@b.co')), onVerified: jest.fn(), onVerifyExisting: jest.fn().mockResolvedValue(undefined), onSignIn: jest.fn(), onOpenLink: jest.fn() });

async function fillValid() {
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Ada Obi');
  await fireEvent.changeText(screen.getByLabelText('Email'), ' Ada@B.co ');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'Abcdefg1!');
}

it('create account stays disabled until every rule is met', async () => {
  await render(<SignUpScreen {...props()} />);
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  await fillValid();
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
  await fireEvent.changeText(screen.getByLabelText('Password'), 'abcdefg1!');
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  expect(screen.getByLabelText('An upper-case letter, not yet')).toBeTruthy();
});

it('submits trimmed lower-case email and goes to the code screen', async () => {
  const p = props();
  await render(<SignUpScreen {...p} />);
  await fillValid();
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  await waitFor(() => { expect(p.onVerified).toHaveBeenCalledWith('ada@b.co'); });
  expect(p.onSubmit).toHaveBeenCalledWith({ name: 'Ada Obi', email: 'ada@b.co', password: 'Abcdefg1!' });
});

it('409 offers Verify this email which resends and opens the code screen', async () => {
  const p = { ...props(), onSubmit: jest.fn(() => Promise.resolve({ ok: false as const, error: { kind: 'emailTaken' as const } })) };
  await render(<SignUpScreen {...p} />);
  await fillValid();
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Verify this email' }));
  expect(p.onVerifyExisting).toHaveBeenCalledWith('ada@b.co');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in instead' }));
  expect(p.onSignIn).toHaveBeenCalled();
});

it('server field errors appear under the fields; transient is neutral', async () => {
  const p = { ...props(), onSubmit: jest.fn().mockResolvedValueOnce({ ok: false, error: { kind: 'invalid', fields: { email: 'Enter a valid email address' } } }).mockResolvedValueOnce({ ok: false, error: { kind: 'transient', retryAfterSec: 20 } }) };
  await render(<SignUpScreen {...p} />);
  await fillValid();
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText(/try again in 20 seconds/i)).toBeTruthy();
});

it('a double tap sends one request', async () => {
  let resolve: (v: { ok: true; value: { email: string } }) => void = () => undefined;
  const p = { ...props(), onSubmit: jest.fn(() => new Promise<{ ok: true; value: { email: string } }>((r) => { resolve = r; })) };
  await render(<SignUpScreen {...p} />);
  await fillValid();
  const b = screen.getByRole('button', { name: 'Create account' });
  await fireEvent.press(b);
  await fireEvent.press(b);
  expect(p.onSubmit).toHaveBeenCalledTimes(1);
  resolve({ ok: true, value: { email: 'ada@b.co' } });
});
```

Transient copy: retryAfterSec known → "We couldn't reach Bookhushly — try again in N seconds"; unknown → "… try again in a minute".

- [ ] **Step 2–4:** FAIL → implement → PASS; `tsc`, lint.

Route `src/app/(auth)/sign-up.tsx`:

```tsx
import { router } from 'expo-router';
import { Linking } from 'react-native';

import { resendConfirmation, signUp } from '@/features/auth/api/accountApi';
import { SignUpScreen } from '@/features/auth/screens/SignUpScreen';
import { api } from '@/shared/api/instance';

export default function SignUpRoute() {
  const toCode = (email: string) => { router.push({ pathname: '/code', params: { purpose: 'signup', email } }); };
  return (
    <SignUpScreen
      onSubmit={(input) => signUp(api, input)}
      onVerified={toCode}
      onVerifyExisting={async (email) => { await resendConfirmation(api, email); toCode(email); }}
      onSignIn={() => { router.replace('/sign-in'); }}
      onOpenLink={(url) => { void Linking.openURL(url); }}
    />
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/screens/SignUpScreen.tsx src/features/auth/screens/__tests__/SignUpScreen.test.tsx src/features/auth/schemas/signUp.ts "src/app/(auth)/sign-up.tsx"
git commit -m "feat(auth): create account with a live password checklist and an already-registered path"
```

---

### Task 7: Enter code

**Files:**
- Create: `src/features/auth/screens/CodeScreen.tsx`, `src/app/(auth)/code.tsx`
- Test: `src/features/auth/screens/__tests__/CodeScreen.test.tsx`

**Interfaces:**
- Consumes: `CodeField`, `maskEmail`, `cooldownLeft`, `useAuth.verifyCode`, `resendConfirmation`, `forgotPassword`.
- Produces: `CodeScreen({ purpose: 'signup' | 'confirm' | 'recovery', email, now: () => number, onVerify: (code) => Promise<VerifyError | null>, onResend: () => Promise<Result<true, AccountFailure>>, onChangeEmail: () => void, onVerified: () => void, canOpenMail: boolean, onOpenMail: () => void })`.

Behaviour:
- Title: signup → "Enter the 6-digit code"; confirm → "Confirm your email first"; recovery → "Enter your reset code". Line "Sent to `maskEmail(email)`" + `TextLink "Change"` → `onChangeEmail`.
- Typing the 6th digit verifies automatically, once (guard ref; show `Spinner` + "Verifying…"); `badCode` → danger-free neutral-text error under the field "That code is wrong or has expired" and the field clears; `transient` → neutral banner; success → `onVerified()` (for signup/confirm the root layout routes on its own; the route's `onVerified` does nothing extra; for recovery it navigates to `/new-password`).
- "Send a new code": disabled with "Send a new code in 0:42" during cooldown (60 s from mount and from each resend; ticks every second with a `setInterval` storing `nowMs` in state — no `Date.now()` in render); pressing calls `onResend`, restarts the cooldown on ok, shows "We sent a new code." (polite); transient → neutral banner (cooldown = `retryAfterSec` if larger).
- After 5 `badCode` results in a row: hint "Too many tries. Send a new code." and verification stays possible.
- "Check spam or junk if it hasn't arrived." caption; `TextLink "Open email app"` only when `canOpenMail`.

- [ ] **Step 1: Write the failing tests** (`CodeScreen.test.tsx`, fake timers for the cooldown):

```tsx
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { CodeScreen } from '@/features/auth/screens/CodeScreen';

let now = 0;
const base = () => ({
  purpose: 'signup' as const,
  email: 'adaeze@gmail.com',
  now: () => now,
  onVerify: jest.fn().mockResolvedValue(null),
  onResend: jest.fn().mockResolvedValue({ ok: true, value: true }),
  onChangeEmail: jest.fn(),
  onVerified: jest.fn(),
  canOpenMail: false,
  onOpenMail: jest.fn(),
});

beforeEach(() => { jest.useFakeTimers(); now = 0; });
afterEach(() => { jest.useRealTimers(); });

it('shows the masked address and verifies once on the sixth digit', async () => {
  const p = base();
  await render(<CodeScreen {...p} />);
  expect(screen.getByText(/a•••e@gmail.com/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Code'), '12345');
  expect(p.onVerify).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Code'), '123456');
  await fireEvent.changeText(screen.getByLabelText('Code'), '123456');
  await waitFor(() => { expect(p.onVerified).toHaveBeenCalled(); });
  expect(p.onVerify).toHaveBeenCalledTimes(1);
  expect(p.onVerify).toHaveBeenCalledWith('123456');
});

it('a wrong code clears the field and says so', async () => {
  const p = { ...base(), onVerify: jest.fn().mockResolvedValue('badCode') };
  await render(<CodeScreen {...p} />);
  await fireEvent.changeText(screen.getByLabelText('Code'), '000000');
  expect(await screen.findByText('That code is wrong or has expired')).toBeTruthy();
  expect(screen.getByLabelText('Code').props.value).toBe('');
});

it('resend waits 60 seconds, then sends and restarts the wait', async () => {
  const p = base();
  await render(<CodeScreen {...p} />);
  expect(screen.getByRole('button', { name: /Send a new code in 1:00/ })).toBeDisabled();
  now = 60_000;
  await act(() => { jest.advanceTimersByTime(1_000); });
  await fireEvent.press(screen.getByRole('button', { name: 'Send a new code' }));
  expect(p.onResend).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('We sent a new code.')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Send a new code in/ })).toBeDisabled();
});

it('a transient verify failure is neutral and keeps the code', async () => {
  const p = { ...base(), onVerify: jest.fn().mockResolvedValue('transient') };
  await render(<CodeScreen {...p} />);
  await fireEvent.changeText(screen.getByLabelText('Code'), '123456');
  expect(await screen.findByTestId('banner')).toBeTruthy();
  expect(screen.getByLabelText('Code').props.value).toBe('123456');
});
```

- [ ] **Step 2–4:** FAIL → implement → PASS; `tsc`, lint.

Route `src/app/(auth)/code.tsx`: read `purpose` and `email` with `useLocalSearchParams`; validate (`purpose ∈ signup|confirm|recovery`, email non-empty) else `router.replace('/welcome')`; `onVerify = (code) => verifyCode(email, code, purpose === 'recovery' ? 'recovery' : 'signup')`; `onResend = () => purpose === 'recovery' ? forgotPassword(api, email) : resendConfirmation(api, email)`; `onChangeEmail = router.back`; `onVerified = purpose === 'recovery' ? () => router.replace('/new-password') : () => undefined`; `canOpenMail`: on iOS `Linking.canOpenURL('message://')` resolved in an effect, Android `false`; `onOpenMail = () => Linking.openURL('message://')`; `now = () => Date.now()` (a function, not called in render).

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/screens/CodeScreen.tsx src/features/auth/screens/__tests__/CodeScreen.test.tsx "src/app/(auth)/code.tsx"
git commit -m "feat(auth): six-digit code screen with auto-verify, resend countdown and change-email"
```

---

### Task 8: Forgot password and new password

**Files:**
- Create: `src/features/auth/screens/ForgotPasswordScreen.tsx`, `src/features/auth/screens/NewPasswordScreen.tsx`, `src/app/(auth)/forgot-password.tsx`, `src/app/(auth)/new-password.tsx`
- Test: `src/features/auth/screens/__tests__/ForgotPasswordScreen.test.tsx`, `src/features/auth/screens/__tests__/NewPasswordScreen.test.tsx`

**Interfaces:**
- Consumes: `forgotPassword`, `resetPassword`, `useAuth.finishRecovery`, `useAuth.abandonRecovery`, `PasswordField`, `RuleList`, `passwordRules`.
- Produces:
  - `ForgotPasswordScreen({ initialEmail, onSubmit: (email) => Promise<Result<true, AccountFailure>>, onSent: (email) => void })` — email field + **Send code**; any result except `invalid` and `transient` continues to `onSent(email)`; `invalid` → field error; `transient` → neutral banner. Copy under the field: "If an account uses this email, we'll send a 6-digit code."
  - `NewPasswordScreen({ onSave: (pw) => Promise<Result<true, AccountFailure>>, onSaved: () => void, onLeave: () => void })` — `PasswordField "New password"` + `RuleList` + **Save password** (enabled when `passwordRules(pw).ok`); header Close button "Cancel" → `onLeave`; Android back also → `onLeave` (use `BackHandler` in the route); results: ok → `onSaved`; `weakPassword` → field error; `unauthorized` → banner "Your reset expired. Start again." + button "Start again" → `onLeave`; `transient` → neutral banner; `failed` → neutral banner.

Routes: `forgot-password.tsx` reads optional `email` param; `onSent = (email) => router.push({ pathname: '/code', params: { purpose: 'recovery', email } })`. `new-password.tsx`: `onSave = (pw) => resetPassword(api, pw)`; `onSaved = () => void finishRecovery()` (route resolution then leaves the auth screens); `onLeave = () => { void abandonRecovery(); }`; also call `abandonRecovery` if the screen unmounts while `useAuth.getState().recovery` is still true (effect cleanup).

- [ ] **Step 1: Write the failing tests**

`ForgotPasswordScreen.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';

it('always continues to the code screen after a 202, with the lower-cased email', async () => {
  const onSent = jest.fn();
  await render(<ForgotPasswordScreen initialEmail="" onSubmit={jest.fn().mockResolvedValue({ ok: true, value: true })} onSent={onSent} />);
  await fireEvent.changeText(screen.getByLabelText('Email'), ' Ada@B.co ');
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  await waitFor(() => { expect(onSent).toHaveBeenCalledWith('ada@b.co'); });
});

it('a transient failure stays on the screen, neutral', async () => {
  const onSent = jest.fn();
  await render(<ForgotPasswordScreen initialEmail="ada@b.co" onSubmit={jest.fn().mockResolvedValue({ ok: false, error: { kind: 'transient' } })} onSent={onSent} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  expect(await screen.findByTestId('banner')).toBeTruthy();
  expect(onSent).not.toHaveBeenCalled();
});
```

`NewPasswordScreen.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { NewPasswordScreen } from '@/features/auth/screens/NewPasswordScreen';

it('saves a valid password', async () => {
  const onSaved = jest.fn();
  await render(<NewPasswordScreen onSave={jest.fn().mockResolvedValue({ ok: true, value: true })} onSaved={onSaved} onLeave={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Save password' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('New password'), 'Abcdefg1!');
  await fireEvent.press(screen.getByRole('button', { name: 'Save password' }));
  await waitFor(() => { expect(onSaved).toHaveBeenCalled(); });
});

it('cancel leaves (signs out)', async () => {
  const onLeave = jest.fn();
  await render(<NewPasswordScreen onSave={jest.fn()} onSaved={jest.fn()} onLeave={onLeave} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(onLeave).toHaveBeenCalled();
});

it('an expired reset offers to start again', async () => {
  const onLeave = jest.fn();
  await render(<NewPasswordScreen onSave={jest.fn().mockResolvedValue({ ok: false, error: { kind: 'unauthorized' } })} onSaved={jest.fn()} onLeave={onLeave} />);
  await fireEvent.changeText(screen.getByLabelText('New password'), 'Abcdefg1!');
  await fireEvent.press(screen.getByRole('button', { name: 'Save password' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Start again' }));
  expect(onLeave).toHaveBeenCalled();
});
```

Also add `src/features/auth/hooks/__tests__/recoveryFlow.test.ts` covering the store: mock `@/shared/supabase/client` (`supabase.auth.verifyOtp` resolves `{ error: null }`, `signOut` resolves `{ error: null }`), mock `@/shared/platform/secureStore` with an in-memory kv; assert `verifyCode(e, c, 'recovery')` sets `recovery` true and the marker; `abandonRecovery()` clears both and calls `signOut`; `finishRecovery()` clears both without signing out; a `badCode` result clears recovery.

- [ ] **Step 2–4:** FAIL → implement → PASS; `tsc`, lint.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/screens/ForgotPasswordScreen.tsx src/features/auth/screens/NewPasswordScreen.tsx src/features/auth/screens/__tests__/ForgotPasswordScreen.test.tsx src/features/auth/screens/__tests__/NewPasswordScreen.test.tsx src/features/auth/hooks/__tests__/recoveryFlow.test.ts "src/app/(auth)/forgot-password.tsx" "src/app/(auth)/new-password.tsx"
git commit -m "feat(auth): forgot password and new password; leaving the reset signs out"
```

---

### Task 9: Delete account

**Files:**
- Create: `src/features/auth/domain/deletionPlan.ts`, `src/features/auth/screens/DeleteAccountScreen.tsx`, `src/app/delete-account.tsx`
- Modify: `src/features/gate/ui/AccountSheet.tsx` (add a `TextLink "Delete account"` via a new `onDeleteAccount` prop), `src/app/(gate)/gate/index.tsx` (pass it: close the sheet, `router.push('/delete-account')`), `src/app/(customer)/home.tsx` + `src/features/customer/screens/CustomerShell.tsx` (an "Account" section with **Delete account** secondary button), `src/app/_layout.tsx` (register `delete-account` as an unguarded `Stack.Screen` presented as a modal)
- Test: `src/features/auth/domain/__tests__/deletionPlan.test.ts`, `src/features/auth/screens/__tests__/DeleteAccountScreen.test.tsx`, `src/features/gate/ui/__tests__/AccountSheet.test.tsx` (extend)

**Interfaces:**
- Consumes: `deleteAccount`, `useAuth.checkPassword`, `useAuth.signOutAfterDeletion`, `checkSignOut` (`src/shared/lib/signOutGuard`), `supabase.auth.refreshSession`.
- Produces:
  - `deletionGate(unsynced: number): 'warn' | 'proceed'` (pure; `unsynced > 0` → warn).
  - `afterUncertain(refreshError: { code?: string; message?: string } | null): 'deleted' | 'unknown'` (pure; `user_banned` code or message containing "banned" → deleted).
  - `DeleteAccountScreen({ email: string, unsynced: number, onCheckPassword: (pw) => Promise<'ok'|'wrong'|'transient'>, onDelete: () => Promise<Result<true, AccountFailure>>, onConfirmDeletedAfterUncertain: () => Promise<boolean>, onDeleted: () => void, onCancel: () => void })`.

Behaviour (spec §3 flow 5, §5):
- Account card ("Signed in as" + email); copy: "Deleting removes your name, email, phone and saved items. Booking and payment records are kept, anonymised, because the law requires them. This can't be undone."; if `unsynced > 0`: `Banner tone="warning"` "N admissions haven't synced. Deleting your account removes them from this phone." (shown before the form).
- `PasswordField "Password"`, `Input "Type DELETE to confirm"` (`autoCapitalize="characters"`); footer: destructive `Button "Delete account"` enabled when password non-empty and confirm === `DELETE`; `Button variant="secondary" "Cancel"`.
- Press: single-flight; `onCheckPassword` → `wrong` → field error "That password isn't right"; `transient` → neutral banner; `ok` → `onDelete()`:
  - ok → `onDeleted()` (route: `signOutAfterDeletion()`; the root layout then shows Welcome with the notice).
  - `blocked` → `Banner tone="warning"` title "You can't delete your account yet" with each `detail` as a line.
  - `notCustomer` → `Banner tone="info"` with the server message.
  - `unauthorized` → `onConfirmDeletedAfterUncertain()`; true → `onDeleted()`; false → neutral banner "We couldn't confirm the deletion. Sign in again to check."
  - `transient`/`failed` → neutral banner "We couldn't delete your account. Try again." (safe to retry).

Route `src/app/delete-account.tsx`: signed-in only (else `router.replace('/')`); loads `unsynced` via `checkSignOut(userId)` in an effect (failure → 0 and the warning is not shown… rule: failure → treat as unknown and show "Some admissions may not have synced." — use `-1` to mean unknown and render that copy); `onConfirmDeletedAfterUncertain = async () => afterUncertain((await supabase.auth.refreshSession()).error) === 'deleted'`; `onDeleted = () => { void signOutAfterDeletion(); }`; `onCancel = router.back`. Hidden for receptionists: the receptionist route never links to it.

- [ ] **Step 1: Write the failing tests**

`deletionPlan.test.ts`:

```ts
import { afterUncertain, deletionGate } from '@/features/auth/domain/deletionPlan';

it('warns when admissions are waiting to sync', () => {
  expect(deletionGate(0)).toBe('proceed');
  expect(deletionGate(3)).toBe('warn');
});
it('a banned refresh after an uncertain delete means it went through', () => {
  expect(afterUncertain({ code: 'user_banned' })).toBe('deleted');
  expect(afterUncertain({ message: 'User is banned' })).toBe('deleted');
  expect(afterUncertain({ code: 'refresh_token_not_found' })).toBe('unknown');
  expect(afterUncertain(null)).toBe('unknown');
});
```

`DeleteAccountScreen.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DeleteAccountScreen } from '@/features/auth/screens/DeleteAccountScreen';

const base = () => ({
  email: 'ada@b.co',
  unsynced: 0,
  onCheckPassword: jest.fn().mockResolvedValue('ok'),
  onDelete: jest.fn().mockResolvedValue({ ok: true, value: true }),
  onConfirmDeletedAfterUncertain: jest.fn().mockResolvedValue(false),
  onDeleted: jest.fn(),
  onCancel: jest.fn(),
});

async function confirm(pw = 'Abcdefg1!') {
  await fireEvent.changeText(screen.getByLabelText('Password'), pw);
  await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
}

it('needs the password and DELETE before the button works', async () => {
  await render(<DeleteAccountScreen {...base()} />);
  expect(screen.getByRole('button', { name: 'Delete account' })).toBeDisabled();
  await confirm();
  expect(screen.getByRole('button', { name: 'Delete account' })).toBeEnabled();
});

it('checks the password in the app, then deletes once', async () => {
  const p = base();
  await render(<DeleteAccountScreen {...p} />);
  await confirm();
  const b = screen.getByRole('button', { name: 'Delete account' });
  await fireEvent.press(b);
  await fireEvent.press(b);
  await waitFor(() => { expect(p.onDeleted).toHaveBeenCalled(); });
  expect(p.onCheckPassword).toHaveBeenCalledWith('Abcdefg1!');
  expect(p.onDelete).toHaveBeenCalledTimes(1);
});

it('a wrong password never reaches the server', async () => {
  const p = { ...base(), onCheckPassword: jest.fn().mockResolvedValue('wrong') };
  await render(<DeleteAccountScreen {...p} />);
  await confirm();
  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  expect(await screen.findByText("That password isn't right")).toBeTruthy();
  expect(p.onDelete).not.toHaveBeenCalled();
});

it('an outage during the password check is neutral, not "wrong password"', async () => {
  const p = { ...base(), onCheckPassword: jest.fn().mockResolvedValue('transient') };
  await render(<DeleteAccountScreen {...p} />);
  await confirm();
  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  expect(await screen.findByTestId('banner')).toBeTruthy();
  expect(screen.queryByText("That password isn't right")).toBeNull();
});

it('lists every blocker', async () => {
  const p = { ...base(), onDelete: jest.fn().mockResolvedValue({ ok: false, error: { kind: 'blocked', reasons: [{ code: 'has_active_bookings', detail: 'You have a booking that has not ended yet.' }, { code: 'has_wallet_balance', detail: 'Your wallet still has money in it.' }] } }) };
  await render(<DeleteAccountScreen {...p} />);
  await confirm();
  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  expect(await screen.findByText("You can't delete your account yet")).toBeTruthy();
  expect(screen.getByText('You have a booking that has not ended yet.')).toBeTruthy();
  expect(screen.getByText('Your wallet still has money in it.')).toBeTruthy();
  expect(p.onDeleted).not.toHaveBeenCalled();
});

it('a lost response resolves through the banned-session check', async () => {
  const p = { ...base(), onDelete: jest.fn().mockResolvedValue({ ok: false, error: { kind: 'unauthorized' } }), onConfirmDeletedAfterUncertain: jest.fn().mockResolvedValue(true) };
  await render(<DeleteAccountScreen {...p} />);
  await confirm();
  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  await waitFor(() => { expect(p.onDeleted).toHaveBeenCalled(); });
});

it('warns about unsynced admissions first', async () => {
  await render(<DeleteAccountScreen {...base()} unsynced={3} />);
  expect(screen.getByText(/3 admissions haven't synced/)).toBeTruthy();
});
```

`AccountSheet.test.tsx` add: renders `TextLink "Delete account"` that calls `onDeleteAccount`.

Also add a store test in `recoveryFlow.test.ts` (or a new `deletion.test.ts`) that `signOutAfterDeletion()` calls `wipeOnSignOut(userId)`, signs out locally, and sets the notice to `accountDeleted` (mock `@/shared/lib/signOutGuard`).

- [ ] **Step 2–4:** FAIL → implement → PASS; `tsc`, lint.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/domain/deletionPlan.ts src/features/auth/domain/__tests__/deletionPlan.test.ts src/features/auth/screens/DeleteAccountScreen.tsx src/features/auth/screens/__tests__/DeleteAccountScreen.test.tsx src/app/delete-account.tsx src/app/_layout.tsx src/features/gate/ui/AccountSheet.tsx src/features/gate/ui/__tests__/AccountSheet.test.tsx "src/app/(gate)/gate/index.tsx" "src/app/(customer)/home.tsx" src/features/customer/screens/CustomerShell.tsx src/features/auth/hooks
git commit -m "feat(auth): in-app account deletion with an in-app password check, blockers, unsynced warning and full local wipe"
```

---

### Task 10: Customer intro tour (behind a switch)

**Files:**
- Create: `src/features/customer/screens/TourScreen.tsx`, `src/features/customer/hooks/useTourSeen.ts`, `src/shared/config/features.ts`
- Modify: `src/app/(customer)/home.tsx`
- Test: `src/features/customer/screens/__tests__/TourScreen.test.tsx`, `src/features/customer/hooks/__tests__/useTourSeen.test.tsx`

**Interfaces:**
- Produces:
  - `export const CUSTOMER_TOUR_ENABLED = false;` in `features.ts`.
  - `useTourSeen(userId: string | null): { seen: boolean | null; markSeen: () => void }` — SecureStore key `bh.tour.<userId>`; `null` while loading; read failure → `true` (never block the app on a tour).
  - `TourScreen({ onDone: () => void })` — 3 pages: (`find`, "Find your place", "Hotels, apartments and events across Nigeria, in one app."), (`pay`, "Pay in naira", "Card, bank transfer or crypto. You see the full price before you pay."), (`showUp`, "Show up", "Your tickets and bookings stay on your phone, even offline."). Horizontal paged `FlatList` (`pagingEnabled`, `onMomentumScrollEnd` sets the page), dots (`accessibilityLabel` "Page N of 3"), **Next** (last page: **Get started**) and **Back** buttons, **Skip** top-right; `Text variant="displaySm"` headlines. Under Reduce Motion the pager scrolls without animation (`scrollToIndex({ animated: tier !== 'none' })`).

Home route: `if (CUSTOMER_TOUR_ENABLED && seen === false) return <TourScreen onDone={markSeen} />;` before the shell.

- [ ] **Step 1: Write the failing tests**

`TourScreen.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { TourScreen } from '@/features/customer/screens/TourScreen';

it('walks three pages to Get started', async () => {
  const onDone = jest.fn();
  await render(<TourScreen onDone={onDone} />);
  expect(screen.getByText('Find your place')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByLabelText('Page 2 of 3')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('skip ends the tour', async () => {
  const onDone = jest.fn();
  await render(<TourScreen onDone={onDone} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  expect(onDone).toHaveBeenCalled();
});
```

`useTourSeen.test.tsx`: mock `@/shared/platform/secureStore` with an in-memory kv; `seen` goes `null` → `false` for a new user; `markSeen()` stores and flips to `true`; a throwing `get` yields `true`. Also a test asserting `CUSTOMER_TOUR_ENABLED === false` (so a merge never ships it on by accident).

- [ ] **Step 2–4:** FAIL → implement → PASS; `tsc`, lint.

- [ ] **Step 5: Commit**

```bash
git add src/features/customer src/shared/config/features.ts "src/app/(customer)/home.tsx"
git commit -m "feat(customer): find, pay, show up intro tour, once per account, switched off until Phase 4"
```

---

### Task 11: Pre-mode screens — loading, update required, mode error, web-only

**Files:**
- Create: `src/features/mode/screens/LoadingScreen.tsx`, `src/features/mode/screens/StatusScreens.tsx` (`UpdateRequiredScreen`, `ModeErrorScreen`, `WebOnlyScreen`)
- Modify: `src/app/index.tsx`, `src/app/_layout.tsx` (hide the splash after 2 s even while loading), `src/app/update-required.tsx`, `src/app/mode-error.tsx`, `src/app/web-only.tsx`
- Test: `src/features/mode/screens/__tests__/StatusScreens.test.tsx`

**Interfaces:**
- Produces:
  - `LoadingScreen()` — wordmark, `Spinner`, "Loading your account…".
  - `UpdateRequiredScreen({ storeUrl: string, platform: 'ios' | 'android', onOpen: (url) => void })` — lucide `Download` icon (size `lg`, tone `textSecondary`); title "Update Bookhushly"; body "This version is no longer supported."; when `storeUrl` is non-empty → **Update** button calling `onOpen(storeUrl)`; otherwise the text "Update Bookhushly from the App Store" (ios) / "Update Bookhushly from the Play Store" (android).
  - `ModeErrorScreen({ onRetry, onSignOut })` — `ErrorState` title "We couldn't load your account", message "Check your connection and try again.", retry; secondary **Sign out** (the route's `signOut` already runs the unsynced guard).
  - `WebOnlyScreen({ email, onOpenWeb, onSignOut })` — "Signed in as `email`", title "Use the web dashboard", body, **Open bookhushly.com**, secondary **Sign out**.

Splash: in `_layout.tsx` add `useEffect(() => { const t = setTimeout(() => { void SplashScreen.hideAsync(); }, 2000); return () => clearTimeout(t); }, []);`. `index.tsx`: `if (route === 'loading') return <LoadingScreen />;`.

- [ ] **Step 1: Write the failing tests** (`StatusScreens.test.tsx`):

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ModeErrorScreen, UpdateRequiredScreen, WebOnlyScreen } from '@/features/mode/screens/StatusScreens';

it('update required is never a dead end', async () => {
  const { rerender } = await render(<UpdateRequiredScreen storeUrl="" platform="android" onOpen={jest.fn()} />);
  expect(screen.getByText(/Play Store/)).toBeTruthy();
  const onOpen = jest.fn();
  await rerender(<UpdateRequiredScreen storeUrl="https://play.google.com/x" platform="android" onOpen={onOpen} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Update' }));
  expect(onOpen).toHaveBeenCalledWith('https://play.google.com/x');
});

it('mode error retries', async () => {
  const onRetry = jest.fn();
  await render(<ModeErrorScreen onRetry={onRetry} onSignOut={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(onRetry).toHaveBeenCalled();
});

it('web-only shows who is signed in', async () => {
  await render(<WebOnlyScreen email="vendor@b.co" onOpenWeb={jest.fn()} onSignOut={jest.fn()} />);
  expect(screen.getByText('vendor@b.co')).toBeTruthy();
});
```

- [ ] **Step 2–4:** FAIL → implement → PASS; `tsc`, lint.

- [ ] **Step 5: Commit**

```bash
git add src/features/mode/screens src/app/index.tsx src/app/_layout.tsx src/app/update-required.tsx src/app/mode-error.tsx src/app/web-only.tsx
git commit -m "feat(mode): loading, update required, mode error and web-only screens on the kit"
```

---

### Task 12: Docs and full verification

**Files:**
- Modify: `docs/BACKEND_STATUS.md` (§6, new §6a, §9), `docs/device-tests/2026-10-08-gate-phone-checklist.md` (new section 9 "Accounts (UI-B)"), `docs/DESIGN_SYSTEM.md` §8 kit list (add `PasswordField · CodeField · RuleList`)

- [ ] **Step 1: BACKEND_STATUS**

Replace §6 bullets with the verified contract summary (from the spec §4/§5 and `../web/docs/mobile/NATIVE_AUTH_API.md`, web `origin/main` @ `30c7da90`):
- Sign-up `POST /api/auth/signup` (customer only; 201 no session; 400/409/422/429/503/500 as in the spec); `verifyOtp({email, token, type:'signup'})` signs in; `users` row, wallet and admin notice exist at sign-up.
- Resend / forgot always 202; reset `POST /api/auth/reset-password` (Bearer) after `verifyOtp(type:'recovery')`.
- Shared IP-keyed `auth` bucket 5/60 s across signup/resend/forgot/reset and web auth POSTs; fail-closed 503 without `code` = transient.
- `X-App-Version` / `X-Platform` are not read by web.
- Never `supabase.auth.signUp` (no users row/wallet) and never `updateUser({password})`.

New §6a "Account deletion": `POST /api/account/delete {confirm:"DELETE"}`; app checks the password itself; blockers `has_active_bookings | has_wallet_balance | open_dispute` with `detail`; anonymise + ban; `not_customer` 403 for receptionists/vendors; lost-200 → retry 401 → `refreshSession` `user_banned`; public page `https://bookhushly.com/account/delete`.

§9: remove "Signup route/trigger" and "account deletion" from the to-request list; add: delete route returns `invalid_password` for any `signInWithPassword` error (ask for a separate transient code); `X-App-Version` unread (min-version endpoint still open); per-IP auth bucket may be tight on shared mobile IPs; plain `signUp` still possible with the anon key; recovery for unconfirmed accounts and whether recovery verification confirms the email are unverified; confirm PR #206 is deployed to production.

- [ ] **Step 2: Checklist section 9 "Accounts (UI-B)"**, plain language for the owner, `- [ ]` items with bold lead-ins:
  - **Welcome:** signed out you see Create account and Sign in; terms/privacy links open.
  - **Create account:** with a throwaway email you own, the password checklist ticks as you type; Create account sends a 6-digit code; entering it signs you in to the customer screen.
  - **Code autofill (iPhone):** the code is offered above the keyboard.
  - **Resend:** waits 60 s, then sends a new code; the old code stops working.
  - **Existing email:** creating an account with the QA customer's email offers Sign in instead / Verify this email.
  - **Forgot password:** with the throwaway account, Forgot password → code → new password → you're signed in; signing in later with the new password works.
  - **Leave the reset:** after entering a reset code, press Cancel on New password (and once, close the app there) → you are signed out.
  - **Delete account:** from Account, wrong password says so; correct password + DELETE deletes the throwaway account and returns to Welcome with "Your account was deleted"; signing in with it again says the account was closed.
  - **Blocked delete (if you have one):** an account with an upcoming confirmed booking shows why it can't be deleted.
  - **Airplane mode:** every account screen says it couldn't reach Bookhushly in grey, never red.
  - **Gate staff:** the account sheet shows Delete account; with an unsynced admission it warns first. Receptionist accounts don't show it.
  - **Slow start:** on a slow connection the app shows "Loading your account…" instead of a frozen splash.

- [ ] **Step 3: Full verification**

Run: `npx tsc --noEmit && npx expo lint && npx jest && npx prettier --check src docs/superpowers docs/BACKEND_STATUS.md docs/device-tests`
Expected: all green (format any file you touched that fails).
Run: `grep -rn "auth.signUp\|updateUser(" src --include=*.ts --include=*.tsx | grep -v __tests__`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add docs/BACKEND_STATUS.md docs/device-tests/2026-10-08-gate-phone-checklist.md docs/DESIGN_SYSTEM.md
git commit -m "docs(ui-b): verified native auth contract in backend status, accounts section in the phone checklist"
```
