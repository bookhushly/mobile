# Phase 1 — Gate online scanning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A gate-staff member signs in, picks an assigned event and scans tickets online. Every scan ends in exactly one of Admitted · Already used · Refused (reason) · Couldn't check — try again.

**Architecture:** Pure TypeScript engine in `src/features/gate/domain/`: parse → scan queue (retries, de-dupe, settled memory) → classify → overlay queue → session. It is wired to the API client by a thin `useScanSession` hook. Scannable-event eligibility lives in `src/shared/api/` because both the `mode` and `gate` features need it and features may not import each other. Screens are presentational components with props; route files only wire hooks.

**Tech Stack:** Expo SDK 57, expo-router 57, TanStack Query 5, Zustand 5, zod 4, expo-camera / expo-audio / expo-haptics / expo-keep-awake (new), Jest + RNTL v14 (async API).

**Spec:** `docs/superpowers/specs/2026-10-05-phase-1-gate-online-design.md`. Read it before starting any task. Contracts are in `docs/BACKEND_STATUS.md` §3 (updated 2026-10-05 with the spec §8 corrections).

## Global Constraints

- Four outcomes only: **Admitted · Already used · Refused (reason) · Couldn't check**. 401/429/5xx/timeout/network/unparseable body → _Couldn't check_, never a refusal. "Couldn't check" uses the neutral `color.outcome.retry` fill, never red.
- No undo or un-admit anywhere in gate mode (FR-3.13).
- The API client never retries the scan POST. The scan queue owns retries, transient only, `400 ms × attempt + jitter(0–199 ms)`: at most 2 retries for network/429/5xx, at most 1 for a timeout; 6 s scan timeout.
- A held overlay (refused / couldn't check) is never replaced by a later result.
- Hold times: admitted 1600 ms, already used 3200 ms, refused and couldn't check held until dismissed.
- Gate fills: `color.outcome.{admitted,used,refused,retry}` only (DESIGN_SYSTEM D9). No raw hex, no `fontWeight`, no Lottie, no entrance animation on outcomes.
- Copy is sentence case, minimum text 12 px, touch targets ≥ 44 pt (gate controls use `density.gate.controlHeight` = 64).
- Domain files (`src/features/*/domain/**`, `src/shared/lib/**`) import no `react`, `react-native` or `expo-*`. No `any`, no `as` casts, no `@ts-ignore`, no `console.*`. Use exhaustive `switch`.
- Features never import other features (ESLint enforced). Shared code goes in `src/shared/`.
- PII: `booking.contact_email` and `contact_phone` are stripped by zod and never shown or logged. Logs and breadcrumbs carry outcome kind, status and latency only, never codes or ticket ids.
- API base is the apex `https://bookhushly.com` (already in env). Event ids must be UUIDs before any request.
- Install packages only with `npx expo install <pkg>`. New native modules need a new EAS dev/preview build.
- Commits: stage specific paths only, never `git add -A`, never on `main`, **no Co-Authored-By trailer** (git hooks reject it). Do not stage the uncommitted Sentry-wizard files (`.gitignore`, `app.json`, `metro.config.js`, `src/app/_layout.tsx`, `src/app/(customer)/home.tsx`, `src/features/auth/screens/SignInScreen.tsx`) unless the owner has decided about them. Task 13 has to edit `app.json`, so resolve that first.
- Production Supabase is live. Make no writes from tests or scripts. Every test uses fakes.
- RNTL v14 is async: `await render(...)`, `await fireEvent.press(...)`. Jest cannot do dynamic `import()`.

## Review Focus

1. **A timeout or network drop where the server actually admitted the ticket.** The next answer for that code is `409 already_checked_in` with no `by_me`. Staff must see "Already used — by you, just now", not a scary "used by someone else". Pinned in Task 5 (in-queue retry and manual "Try again") and Task 4 (timestamp rule).
2. **A burst of greens arrives while a red is queued.** The red must still be shown and held. Pinned in Task 6 ("+N admitted" collapse never drops a non-admitted).
3. **The camera fires the same QR 10–30 times a second, including junk QRs.** Expect one request and one overlay per presentation. Pinned in Task 5 (2 s cooldown, in-flight de-dupe) and Task 10 (junk-QR cooldown).
4. **The session expires mid-shift (refresh fails).** Expect _Couldn't check_ with a "Sign in again" action, never _Refused_. Pinned in Task 4 (`auth` → couldntCheck) and Task 12 (the button renders).
5. **An event-list row whose listing is hidden from the scanner (draft/private).** It must still appear when `is_listing_scanner` says yes, and the app must not crash on a `null` title. Pinned in Task 7 and Task 11.

---

## File map

| Path                                                                                                                                     | Responsibility                                          | Task |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---- |
| `src/features/gate/domain/parseTicketCode.ts`                                                                                            | raw QR/typed text → branded `TicketCode`                | 1    |
| `src/features/gate/schemas/scan.ts`                                                                                                      | zod: admit 200, already-used 409, summary               | 2    |
| `src/features/gate/schemas/__fixtures__/scan.ts`                                                                                         | contract fixtures, one per status row                   | 2    |
| `src/shared/api/client.ts`, `src/shared/lib/errors.ts`                                                                                   | per-request `timeoutMs`; keep `code` on 400             | 3    |
| `src/features/gate/domain/outcome.ts`                                                                                                    | `ScanOutcome` type, `classify()`                        | 4    |
| `src/features/gate/domain/present.ts`                                                                                                    | outcome → tone, hold, cue, copy                         | 4    |
| `src/features/gate/domain/scanQueue.ts`                                                                                                  | concurrency, retries, de-dupe, settled memory, cooldown | 5    |
| `src/features/gate/domain/overlayQueue.ts`                                                                                               | FIFO overlays, holds, "+N admitted"                     | 6    |
| `src/shared/lib/dbError.ts`                                                                                                              | PostgREST error → `ApiError` (moved from mode)          | 7    |
| `src/shared/api/scannableEvents.ts`                                                                                                      | eligibility rule + loader (DI)                          | 7    |
| `src/shared/supabase/scannerDb.ts`, `src/shared/supabase/wrap.ts`                                                                        | Supabase implementations                                | 7    |
| `src/features/mode/**`                                                                                                                   | mode count uses the shared rule                         | 8    |
| `src/features/gate/domain/eventList.ts`                                                                                                  | upcoming/earlier grouping, auto-open pick               | 8    |
| `src/shared/platform/feedback.ts`, `assets/sounds/*.wav`, `scripts/gen-gate-sounds.mjs`                                                  | sound + haptic cues, mute                               | 9    |
| `src/features/gate/api/scan.ts`, `api/keys.ts`                                                                                           | scan POST, summary GET, query keys                      | 10   |
| `src/features/gate/domain/scanSession.ts`                                                                                                | composes parse → queue → overlay → cues                 | 10   |
| `src/features/gate/state/scanView.ts`, `hooks/useScanSession.ts`, `hooks/useScanSummary.ts`                                              | React glue                                              | 10   |
| `src/features/gate/screens/EventListScreen.tsx`, `hooks/useScannableEvents.ts`, `hooks/useLastEvent.ts`, `src/app/(gate)/gate/index.tsx` | event list                                              | 11   |
| `src/features/gate/ui/OutcomeOverlay.tsx`, `ui/EnterCodeSheet.tsx`, `ui/RecentSheet.tsx`                                                 | overlay + sheets                                        | 12   |
| `src/features/gate/screens/ScannerScreen.tsx`, `ui/ScannerCamera.tsx`, `src/app/(gate)/gate/[eventId].tsx`, `app.json`                   | scanner                                                 | 13   |
| —                                                                                                                                        | verification, reviews, device run                       | 14   |

---

### Task 1: `parseTicketCode`

**Files:**

- Create: `src/features/gate/domain/parseTicketCode.ts`
- Test: `src/features/gate/domain/__tests__/parseTicketCode.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `type TicketCode` (zod-branded string); `type ParsedCode = { kind: 'rotating' | 'static'; value: TicketCode }`; `parseTicketCode(raw: string): ParsedCode | null`.

Mirrors web `lib/scan/parse-code.js`, with two additions: input over 400 chars is rejected (the server's limit), and static UUIDs are lower-cased so a typed id and a printed QR de-dupe to the same key.

- [ ] **Step 1: Write the failing test**

```ts
import { parseTicketCode } from '@/features/gate/domain/parseTicketCode';

const U = '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

describe('parseTicketCode', () => {
  it('accepts a bare uuid as a static code', () => {
    expect(parseTicketCode(U)).toEqual({ kind: 'static', value: U });
  });
  it('extracts the uuid from a printed-ticket url', () => {
    expect(parseTicketCode(`https://bookhushly.com/t/${U}?ref=pdf`)).toEqual({
      kind: 'static',
      value: U,
    });
  });
  it('lower-cases a static uuid so typed and scanned forms match', () => {
    expect(parseTicketCode(U.toUpperCase())?.value).toBe(U);
  });
  it('trims whitespace and newlines', () => {
    expect(parseTicketCode(`  ${U}\n`)?.value).toBe(U);
  });
  it('takes the first uuid when there are several', () => {
    const other = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    expect(parseTicketCode(`${U} ${other}`)?.value).toBe(U);
  });
  it('passes BH1 and BH2 rotating codes through untouched', () => {
    const bh2 = `BH2.k1.AAAAAAAAAAAAAAAAAAAAAA.1a2b.${'x'.repeat(86)}`;
    expect(parseTicketCode(` ${bh2} `)).toEqual({ kind: 'rotating', value: bh2 });
    expect(parseTicketCode(`BH1.${U}.abc`)).toEqual({ kind: 'rotating', value: `BH1.${U}.abc` });
  });
  it('does not treat a lower-case prefix as rotating', () => {
    expect(parseTicketCode('bh2.k1.zzz')).toBeNull();
  });
  it('rejects empty, junk and over-long input', () => {
    expect(parseTicketCode('')).toBeNull();
    expect(parseTicketCode('   ')).toBeNull();
    expect(parseTicketCode('WIFI:S:cafe;T:WPA;P:secret;;')).toBeNull();
    expect(parseTicketCode(`BH2.${'a'.repeat(400)}`)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx jest src/features/gate/domain/__tests__/parseTicketCode.test.ts`
Expected: FAIL, "Cannot find module '@/features/gate/domain/parseTicketCode'".

- [ ] **Step 3: Implement**

```ts
import { z } from 'zod';

// Minted only here; everything downstream (queue keys, the scan POST) takes a TicketCode.
const ticketCode = z.string().min(1).max(400).brand<'TicketCode'>();
export type TicketCode = z.infer<typeof ticketCode>;

export type ParsedCode = { kind: 'rotating' | 'static'; value: TicketCode };

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const ROTATING_RE = /^BH[12]\./;

export function parseTicketCode(raw: string): ParsedCode | null {
  const value = raw.trim();
  if (ROTATING_RE.test(value)) {
    const r = ticketCode.safeParse(value);
    return r.success ? { kind: 'rotating', value: r.data } : null;
  }
  if (value.length > 400) return null;
  const match = UUID_RE.exec(value);
  if (!match) return null;
  const r = ticketCode.safeParse(match[0].toLowerCase());
  return r.success ? { kind: 'static', value: r.data } : null;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx jest src/features/gate/domain/__tests__/parseTicketCode.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/domain/parseTicketCode.ts src/features/gate/domain/__tests__/parseTicketCode.test.ts
git commit -m "feat(gate): parse scanned ticket codes"
```

---

### Task 2: Scan contract schemas and fixtures

**Files:**

- Create: `src/features/gate/schemas/scan.ts`
- Create: `src/features/gate/schemas/__fixtures__/scan.ts`
- Test: `src/features/gate/schemas/__tests__/scan.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `admitBody`, `usedBody`, `summaryBody` (zod schemas); `type AdmitBody`, `type UsedBody`, `type ScanSummary` (`z.infer`); `fx` (fixtures, `{ status: number; body: unknown }` per row) and `TICKET_ID`.

Shapes were read from web `app/api/events/[id]/scan/route.js`, `admit_ticket` and `scan_summary` (baseline migration) on 2026-10-05. `ticket_index` is 1-based (`row_number()`). `scanned_by` is `coalesce(users.name, users.email)`, so it can be an email. `scanned_by_me` is `scanned_by = p_user_id`, so it can be `null`.

- [ ] **Step 1: Write the fixtures**

```ts
// Contract fixtures for POST /api/events/{id}/scan and GET …/scan/summary.
// Source: web scan/route.js + admit_ticket + scan_summary, read 2026-10-05.
export const TICKET_ID = '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const BOOKING_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const refusal = (code: string, error: string) => ({
  error,
  code,
  checked_in_at: null,
  scanned_by: null,
  ticket: null,
  ticket_count: null,
});

export const fx = {
  admitted: {
    status: 200,
    body: {
      ok: true,
      ticket: {
        id: TICKET_ID,
        ticket_type: 'Regular',
        ticket_index: 2,
        checked_in_at: '2026-10-05T18:04:00.000Z',
        seat: null,
      },
      booking: {
        id: BOOKING_ID,
        contact_email: 'guest@example.com',
        contact_phone: '+2348000000000',
        total_tickets: 3,
        checked_in_count: 2,
        tickets: [],
      },
    },
  },
  usedByName: {
    status: 409,
    body: {
      error: 'Ticket already checked in',
      code: 'already_checked_in',
      checked_in_at: '2026-10-05T17:30:00.000Z',
      scanned_by: 'Ada Gate',
      ticket: { ticket_type: 'Regular', ticket_index: 1 },
      ticket_count: null,
    },
  },
  usedByEmail: {
    status: 409,
    body: {
      error: 'Ticket already checked in',
      code: 'already_checked_in',
      checked_in_at: '2026-10-05T17:30:00.000Z',
      scanned_by: 'scanner@example.com',
      ticket: { ticket_type: 'VIP', ticket_index: 1 },
      ticket_count: null,
    },
  },
  notFound: { status: 404, body: refusal('not_found', 'Ticket not found') },
  forbidden: { status: 403, body: refusal('forbidden', "You aren't assigned to this event") },
  bookingQr: { status: 409, body: refusal('booking_qr', 'Old ticket format') },
  wrongEvent: { status: 409, body: refusal('wrong_event', 'This ticket is for a different event') },
  notConfirmed: { status: 409, body: refusal('not_confirmed', 'Booking is not confirmed') },
  staticNotAllowed: { status: 409, body: refusal('static_not_allowed', 'Live code required') },
  expiredCode: { status: 409, body: { error: 'Code expired', code: 'expired_code' } },
  invalidRotating: { status: 409, body: { error: 'Invalid ticket code', code: 'invalid_code' } },
  invalidStatic: { status: 400, body: { error: 'Not a Bookhushly ticket', code: 'invalid_code' } },
  missingId: { status: 400, body: { error: 'ticket_id is required' } },
  lookupFailed: { status: 503, body: { error: "Couldn't read the ticket", code: 'lookup_failed' } },
  unauthorized: { status: 401, body: { error: 'Unauthorized' } },
  rateLimited: { status: 429, body: { error: 'Too many requests' } },
  summary: {
    status: 200,
    body: {
      admitted: 41,
      total: 120,
      recent: [
        {
          id: TICKET_ID,
          ticket_type: 'Regular',
          checked_in_at: '2026-10-05T18:04:00.000Z',
          scanned_by_me: true,
        },
        {
          id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          ticket_type: null,
          checked_in_at: '2026-10-05T18:01:00.000Z',
          scanned_by_me: null,
        },
      ],
    },
  },
  summaryForbidden: { status: 403, body: { error: 'Forbidden' } },
  summaryFailed: { status: 503, body: { error: "Couldn't load totals" } },
} as const;
```

- [ ] **Step 2: Write the failing test**

```ts
import { fx, TICKET_ID } from '@/features/gate/schemas/__fixtures__/scan';
import { admitBody, summaryBody, usedBody } from '@/features/gate/schemas/scan';

describe('scan schemas', () => {
  it('parses an admission and strips guest contact details', () => {
    const r = admitBody.parse(fx.admitted.body);
    expect(r.ticket).toEqual({
      id: TICKET_ID,
      ticket_type: 'Regular',
      ticket_index: 2,
      checked_in_at: '2026-10-05T18:04:00.000Z',
    });
    expect(r.booking).toEqual({
      id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
      total_tickets: 3,
      checked_in_count: 2,
    });
    expect(JSON.stringify(r)).not.toMatch(/guest@example|2348000000000/);
  });
  it('parses an already-used body with a name or an email', () => {
    expect(usedBody.parse(fx.usedByName.body).scanned_by).toBe('Ada Gate');
    expect(usedBody.parse(fx.usedByEmail.body).scanned_by).toBe('scanner@example.com');
  });
  it('rejects a refusal body as already-used', () => {
    expect(usedBody.safeParse(fx.notFound.body).success).toBe(false);
  });
  it('parses the summary and treats a null scanned_by_me as false', () => {
    const r = summaryBody.parse(fx.summary.body);
    expect(r.admitted).toBe(41);
    expect(r.recent.map((x) => x.scanned_by_me)).toEqual([true, false]);
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `npx jest src/features/gate/schemas`
Expected: FAIL, "Cannot find module '@/features/gate/schemas/scan'".

- [ ] **Step 4: Implement**

```ts
import { z } from 'zod';

// z.object strips unknown keys: contact_email / contact_phone / sibling tickets never leave here.
export const admitBody = z.object({
  ok: z.literal(true),
  ticket: z.object({
    id: z.string(),
    ticket_type: z.string().nullable(),
    ticket_index: z.number().int().nullable(),
    checked_in_at: z.string().nullable(),
  }),
  booking: z.object({
    id: z.string(),
    total_tickets: z.number().int().nullable(),
    checked_in_count: z.number().int().nullable(),
  }),
});
export type AdmitBody = z.infer<typeof admitBody>;

export const usedBody = z.object({
  code: z.literal('already_checked_in'),
  checked_in_at: z.string().nullable(),
  // coalesce(users.name, users.email) on the server — may be an email.
  scanned_by: z.string().nullable(),
  ticket: z
    .object({ ticket_type: z.string().nullable(), ticket_index: z.number().int().nullable() })
    .nullable(),
});
export type UsedBody = z.infer<typeof usedBody>;

export const summaryBody = z.object({
  admitted: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  recent: z.array(
    z.object({
      id: z.string(),
      ticket_type: z.string().nullable(),
      checked_in_at: z.string(),
      scanned_by_me: z
        .boolean()
        .nullable()
        .transform((v) => v === true),
    }),
  ),
});
export type ScanSummary = z.infer<typeof summaryBody>;
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npx jest src/features/gate/schemas`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/gate/schemas
git commit -m "feat(gate): scan contract schemas and fixtures"
```

---

### Task 3: API client: per-request timeout, keep `code` on 400

**Files:**

- Modify: `src/shared/api/client.ts` (`RequestOptions`, `once`, `request`)
- Modify: `src/shared/lib/errors.ts` (`ApiError['unknown']`, `errorFromResponse`)
- Test: `src/shared/api/__tests__/client.test.ts`, `src/shared/lib/__tests__/errors.test.ts`

**Interfaces:**

- Consumes: existing `createApiClient`.
- Produces: `RequestOptions<T>.timeoutMs?: number`; `ApiError` member `{ kind: 'unknown'; status?: number; code?: string }`.

The scan POST needs an 8 s timeout (the client default is 15 s). A 400 `invalid_code` must stay distinguishable from other 400s.

- [ ] **Step 1: Write the failing tests**

Add to `src/shared/api/__tests__/client.test.ts`, inside `describe('api client', …)`:

```ts
it('honours a per-request timeout and does not retry a POST', async () => {
  jest.useFakeTimers();
  try {
    const fetchFn = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const e = new Error('aborted');
            e.name = 'AbortError';
            reject(e);
          });
        }),
    ) as unknown as typeof fetch;
    const { client } = make([], { fetchFn });
    const p = client.request('/api/x', { method: 'POST', body: {}, schema, timeoutMs: 8000 });
    await jest.advanceTimersByTimeAsync(8000);
    await expect(p).resolves.toEqual({ ok: false, error: { kind: 'timeout' } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

it('never retries a non-idempotent POST on 503', async () => {
  const { client, calls } = make([res(503, { code: 'lookup_failed' })]);
  const r = await client.request('/api/x', { method: 'POST', body: {}, schema });
  expect(r).toEqual({
    ok: false,
    error: { kind: 'unavailable', status: 503, code: 'lookup_failed' },
  });
  expect(calls).toHaveLength(1);
});
```

Add to `src/shared/lib/__tests__/errors.test.ts`:

```ts
it('keeps the code on a 400', () => {
  const h = { get: () => null };
  expect(errorFromResponse(400, { code: 'invalid_code' }, h)).toEqual({
    kind: 'unknown',
    status: 400,
    code: 'invalid_code',
  });
  expect(errorFromResponse(400, { error: 'x' }, h)).toEqual({ kind: 'unknown', status: 400 });
});
```

(If `errors.test.ts` does not already import `errorFromResponse`, add `import { errorFromResponse } from '@/shared/lib/errors';`.)

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx jest src/shared/api src/shared/lib/__tests__/errors.test.ts`
Expected: FAIL. The timeout test times out at 15 s of fake time instead of 8 s, and tsc reports `timeoutMs` missing. The 400 test fails on the missing `code`.

- [ ] **Step 3: Implement**

`src/shared/lib/errors.ts`: change the union member and the fall-through:

```ts
  | { kind: 'unknown'; status?: number; code?: string };
```

```ts
return code ? { kind: 'unknown', status, code } : { kind: 'unknown', status };
```

`src/shared/api/client.ts`:

```ts
export type RequestOptions<T> = {
  method?: Method;
  body?: unknown;
  schema: z.ZodType<T>;
  idempotent?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};
```

Change `once` to take the timeout as its last parameter and use it:

```ts
  async function once(
    path: string,
    method: Method,
    body: unknown,
    token: string | null,
    outerSignal: AbortSignal | undefined,
    limitMs: number,
  ): Promise<Result<Response, ApiError>> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, limitMs);
```

and the call site in `request`:

```ts
const sent = await once(path, method, opts.body, token, opts.signal, opts.timeoutMs ?? timeoutMs);
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest src/shared && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/client.ts src/shared/lib/errors.ts src/shared/api/__tests__/client.test.ts src/shared/lib/__tests__/errors.test.ts
git commit -m "feat(api): per-request timeout and keep the error code on 400"
```

---

### Task 4: Outcome model, `classify`, presentation

**Files:**

- Create: `src/features/gate/domain/outcome.ts`
- Create: `src/features/gate/domain/present.ts`
- Test: `src/features/gate/domain/__tests__/outcome.test.ts`, `src/features/gate/domain/__tests__/present.test.ts`

**Interfaces:**

- Consumes: `AdmitBody`, `usedBody` (Task 2); `ApiError` with `unknown.code` (Task 3); `Result` from `@/shared/lib/result`.
- Produces:

```ts
export type ScanResponse = Result<AdmitBody, ApiError>;
export type ScannedBy =
  | { kind: 'me' }
  | { kind: 'named'; name: string }
  | { kind: 'anotherScanner' }
  | { kind: 'unknown' };
export type RefusalReason =
  | 'notFound'
  | 'oldFormat'
  | 'wrongEvent'
  | 'notConfirmed'
  | 'invalid'
  | 'notTicket'
  | 'expired'
  | 'staticNotAllowed'
  | 'notAssigned'
  | 'other';
export type CouldntCheckCause =
  'network' | 'timeout' | 'rateLimited' | 'server' | 'auth' | 'unreadable';
export type ScanOutcome =
  | {
      kind: 'admitted';
      ticketType: string | null;
      ticketIndex: number | null;
      totalTickets: number | null;
      checkedInCount: number | null;
      checkedInAt: string | null;
    }
  | {
      kind: 'used';
      checkedInAt: string | null;
      scannedBy: ScannedBy;
      ticketType: string | null;
      replayed: boolean;
    }
  | { kind: 'refused'; reason: RefusalReason; fixable: boolean }
  | { kind: 'couldntCheck'; cause: CouldntCheckCause };
export type ClassifyContext = { uncertainSince: number | null };
export function classify(res: ScanResponse, ctx: ClassifyContext): ScanOutcome;
export function isTransient(res: ScanResponse): boolean;
export function mayHaveCommitted(res: ScanResponse): boolean;
export function replayOf(settled: ScanOutcome): ScanOutcome;
export const refusedLocally: ScanOutcome; // { kind:'refused', reason:'notTicket', fixable:false }
```

`present.ts`:

```ts
export type Tone = 'admitted' | 'used' | 'refused' | 'retry';
export type Cue = 'success' | 'warning' | 'error' | 'retry';
export type Presentation = {
  tone: Tone;
  cue: Cue;
  holdMs: number | null;
  title: string;
  detail: string;
  secondary: string | null;
  action: 'tryAgain' | 'signIn' | 'done' | null;
};
export const HOLD_ADMITTED_MS = 1600;
export const HOLD_USED_MS = 3200;
export function present(o: ScanOutcome, nowMs: number): Presentation;
```

**Refinement over spec decision 4 (deliberate):** `byMe` is not set from "a prior attempt was uncertain" alone. It also requires that the server's `checked_in_at` is no earlier than 5 s before that uncertain attempt started (server-clock). A ticket somebody else used an hour ago is then not shown as "by you". If `checked_in_at` is missing or unparseable, fall back to the spec rule (`byMe = true`).

- [ ] **Step 1: Write the failing `classify` test**

```ts
import { classify, isTransient, mayHaveCommitted, replayOf } from '@/features/gate/domain/outcome';
import { fx } from '@/features/gate/schemas/__fixtures__/scan';
import { admitBody } from '@/features/gate/schemas/scan';
import { errorFromResponse, type ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

const noHeaders = { get: () => null };
const fail = (f: { status: number; body: unknown }) =>
  err(errorFromResponse(f.status, f.body, noHeaders));
const failWith = (e: ApiError) => err(e);
const ctx = { uncertainSince: null };

describe('classify', () => {
  it('200 → admitted with ticket and booking progress', () => {
    expect(classify(ok(admitBody.parse(fx.admitted.body)), ctx)).toEqual({
      kind: 'admitted',
      ticketType: 'Regular',
      ticketIndex: 2,
      totalTickets: 3,
      checkedInCount: 2,
      checkedInAt: '2026-10-05T18:04:00.000Z',
    });
  });
  it('409 already_checked_in → used, named scanner', () => {
    expect(classify(fail(fx.usedByName), ctx)).toEqual({
      kind: 'used',
      checkedInAt: '2026-10-05T17:30:00.000Z',
      scannedBy: { kind: 'named', name: 'Ada Gate' },
      ticketType: 'Regular',
      replayed: false,
    });
  });
  it('an email in scanned_by is shown as another scanner', () => {
    const o = classify(fail(fx.usedByEmail), ctx);
    expect(o.kind === 'used' && o.scannedBy).toEqual({ kind: 'anotherScanner' });
  });
  it('used after an uncertain attempt that started before the check-in → by me', () => {
    const since = Date.parse('2026-10-05T17:29:58.000Z');
    const o = classify(fail(fx.usedByName), { uncertainSince: since });
    expect(o.kind === 'used' && o.scannedBy).toEqual({ kind: 'me' });
  });
  it('used long before the uncertain attempt → not by me', () => {
    const since = Date.parse('2026-10-05T18:30:00.000Z');
    const o = classify(fail(fx.usedByName), { uncertainSince: since });
    expect(o.kind === 'used' && o.scannedBy).toEqual({ kind: 'named', name: 'Ada Gate' });
  });
  it.each([
    [fx.notFound, 'notFound', false],
    [fx.bookingQr, 'oldFormat', false],
    [fx.wrongEvent, 'wrongEvent', false],
    [fx.notConfirmed, 'notConfirmed', false],
    [fx.invalidRotating, 'invalid', false],
    [fx.invalidStatic, 'invalid', false],
    [fx.forbidden, 'notAssigned', false],
    [fx.expiredCode, 'expired', true],
    [fx.staticNotAllowed, 'staticNotAllowed', true],
  ])('refusal %#', (f, reason, fixable) => {
    expect(classify(fail(f), ctx)).toEqual({ kind: 'refused', reason, fixable });
  });
  it('an unknown 409 code is a generic refusal', () => {
    expect(classify(fail({ status: 409, body: { code: 'new_thing' } }), ctx)).toEqual({
      kind: 'refused',
      reason: 'other',
      fixable: false,
    });
  });
  it.each([
    [fx.lookupFailed, 'server'],
    [fx.rateLimited, 'rateLimited'],
    [fx.unauthorized, 'auth'],
    [fx.missingId, 'unreadable'],
  ])('transient or unreadable %# → couldntCheck', (f, cause) => {
    expect(classify(fail(f), ctx)).toEqual({ kind: 'couldntCheck', cause });
  });
  it.each<[ApiError, string]>([
    [{ kind: 'network' }, 'network'],
    [{ kind: 'aborted' }, 'network'],
    [{ kind: 'timeout' }, 'timeout'],
    [{ kind: 'validation' }, 'unreadable'],
    [{ kind: 'unavailable', status: 502 }, 'server'],
  ])('%o → couldntCheck', (e, cause) => {
    expect(classify(failWith(e), ctx)).toEqual({ kind: 'couldntCheck', cause });
  });
});

describe('transience', () => {
  it('only network, timeout, 429 and 5xx are retried', () => {
    expect(isTransient(failWith({ kind: 'network' }))).toBe(true);
    expect(isTransient(failWith({ kind: 'timeout' }))).toBe(true);
    expect(isTransient(failWith({ kind: 'rateLimited' }))).toBe(true);
    expect(isTransient(failWith({ kind: 'unavailable', status: 503 }))).toBe(true);
    expect(isTransient(failWith({ kind: 'auth' }))).toBe(false);
    expect(isTransient(fail(fx.notFound))).toBe(false);
    expect(isTransient(failWith({ kind: 'validation' }))).toBe(false);
  });
  it('a request that may have reached the database is uncertain; a 429 is not', () => {
    expect(mayHaveCommitted(failWith({ kind: 'timeout' }))).toBe(true);
    expect(mayHaveCommitted(failWith({ kind: 'network' }))).toBe(true);
    expect(mayHaveCommitted(failWith({ kind: 'unavailable', status: 502 }))).toBe(true);
    expect(mayHaveCommitted(failWith({ kind: 'validation' }))).toBe(true);
    expect(mayHaveCommitted(failWith({ kind: 'rateLimited' }))).toBe(false);
    expect(mayHaveCommitted(fail(fx.notFound))).toBe(false);
  });
});

describe('replayOf', () => {
  it('an admission replays as used by this phone', () => {
    const admitted = classify(ok(admitBody.parse(fx.admitted.body)), ctx);
    expect(replayOf(admitted)).toEqual({
      kind: 'used',
      checkedInAt: '2026-10-05T18:04:00.000Z',
      scannedBy: { kind: 'me' },
      ticketType: 'Regular',
      replayed: true,
    });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/features/gate/domain/__tests__/outcome.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `outcome.ts`**

```ts
import { usedBody, type AdmitBody } from '@/features/gate/schemas/scan';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

export type ScanResponse = Result<AdmitBody, ApiError>;

export type ScannedBy =
  | { kind: 'me' }
  | { kind: 'named'; name: string }
  | { kind: 'anotherScanner' }
  | { kind: 'unknown' };

export type RefusalReason =
  | 'notFound'
  | 'oldFormat'
  | 'wrongEvent'
  | 'notConfirmed'
  | 'invalid'
  | 'notTicket'
  | 'expired'
  | 'staticNotAllowed'
  | 'notAssigned'
  | 'other';

export type CouldntCheckCause =
  'network' | 'timeout' | 'rateLimited' | 'server' | 'auth' | 'unreadable';

export type ScanOutcome =
  | {
      kind: 'admitted';
      ticketType: string | null;
      ticketIndex: number | null;
      totalTickets: number | null;
      checkedInCount: number | null;
      checkedInAt: string | null;
    }
  | {
      kind: 'used';
      checkedInAt: string | null;
      scannedBy: ScannedBy;
      ticketType: string | null;
      replayed: boolean;
    }
  | { kind: 'refused'; reason: RefusalReason; fixable: boolean }
  | { kind: 'couldntCheck'; cause: CouldntCheckCause };

/** uncertainSince: server-clock ms when an earlier attempt for this code may have committed. */
export type ClassifyContext = { uncertainSince: number | null };

// A check-in this close before our uncertain attempt started is still ours (clock skew).
const BY_ME_SLACK_MS = 5_000;

const refused = (reason: RefusalReason, fixable = false): ScanOutcome => ({
  kind: 'refused',
  reason,
  fixable,
});
const couldnt = (cause: CouldntCheckCause): ScanOutcome => ({ kind: 'couldntCheck', cause });

export const refusedLocally: ScanOutcome = refused('notTicket');

function scannedByFrom(raw: string | null, at: string | null, ctx: ClassifyContext): ScannedBy {
  if (ctx.uncertainSince !== null) {
    const t = at === null ? NaN : Date.parse(at);
    if (!Number.isFinite(t) || t >= ctx.uncertainSince - BY_ME_SLACK_MS) return { kind: 'me' };
  }
  const name = raw?.trim() ?? '';
  if (name === '') return { kind: 'unknown' };
  // The server falls back to the scanner's email; never show another person's email.
  if (name.includes('@')) return { kind: 'anotherScanner' };
  return { kind: 'named', name };
}

function fromConflict(code: string, body: unknown, ctx: ClassifyContext): ScanOutcome {
  switch (code) {
    case 'already_checked_in': {
      const p = usedBody.safeParse(body);
      const d = p.success ? p.data : null;
      const at = d?.checked_in_at ?? null;
      return {
        kind: 'used',
        checkedInAt: at,
        scannedBy: scannedByFrom(d?.scanned_by ?? null, at, ctx),
        ticketType: d?.ticket?.ticket_type ?? null,
        replayed: false,
      };
    }
    case 'booking_qr':
      return refused('oldFormat');
    case 'wrong_event':
      return refused('wrongEvent');
    case 'not_confirmed':
      return refused('notConfirmed');
    case 'invalid_code':
      return refused('invalid');
    case 'expired_code':
      return refused('expired', true);
    case 'static_not_allowed':
      return refused('staticNotAllowed', true);
    default:
      // A 409 is the server saying no; an unrecognised code is still a refusal.
      return refused('other');
  }
}

export function classify(res: ScanResponse, ctx: ClassifyContext): ScanOutcome {
  if (res.ok) {
    const { ticket, booking } = res.value;
    return {
      kind: 'admitted',
      ticketType: ticket.ticket_type,
      ticketIndex: ticket.ticket_index,
      totalTickets: booking.total_tickets,
      checkedInCount: booking.checked_in_count,
      checkedInAt: ticket.checked_in_at,
    };
  }
  const e = res.error;
  switch (e.kind) {
    case 'conflict':
      return fromConflict(e.code, e.body, ctx);
    case 'notFound':
      return refused('notFound');
    case 'forbidden':
      return refused('notAssigned');
    case 'unknown':
      return e.status === 400 && e.code === 'invalid_code'
        ? refused('invalid')
        : couldnt('unreadable');
    case 'auth':
      return couldnt('auth');
    case 'network':
    case 'aborted':
      return couldnt('network');
    case 'timeout':
      return couldnt('timeout');
    case 'rateLimited':
      return couldnt('rateLimited');
    case 'unavailable':
      return couldnt('server');
    case 'validation':
      return couldnt('unreadable');
  }
}

export function isTransient(res: ScanResponse): boolean {
  if (res.ok) return false;
  switch (res.error.kind) {
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

/** True when the request may have reached admit_ticket and committed. 429 is refused before the handler. */
export function mayHaveCommitted(res: ScanResponse): boolean {
  if (res.ok) return false;
  switch (res.error.kind) {
    case 'network':
    case 'timeout':
    case 'unavailable':
    case 'validation':
      return true;
    case 'rateLimited':
    case 'auth':
    case 'forbidden':
    case 'notFound':
    case 'conflict':
    case 'aborted':
    case 'unknown':
      return false;
  }
}

/** What a settled code shows when presented again on this phone. */
export function replayOf(settled: ScanOutcome): ScanOutcome {
  switch (settled.kind) {
    case 'admitted':
      return {
        kind: 'used',
        checkedInAt: settled.checkedInAt,
        scannedBy: { kind: 'me' },
        ticketType: settled.ticketType,
        replayed: true,
      };
    case 'used':
      return { ...settled, replayed: true };
    case 'refused':
    case 'couldntCheck':
      return settled;
  }
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx jest src/features/gate/domain/__tests__/outcome.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing `present` test**

```ts
import type { ScanOutcome } from '@/features/gate/domain/outcome';
import { present } from '@/features/gate/domain/present';

const NOW = Date.parse('2026-10-05T18:05:00.000Z');
const admitted: ScanOutcome = {
  kind: 'admitted',
  ticketType: 'Regular',
  ticketIndex: 2,
  totalTickets: 3,
  checkedInCount: 2,
  checkedInAt: '2026-10-05T18:04:00.000Z',
};

describe('present', () => {
  it('admitted: green, 1.6 s, ticket n of m and booking progress', () => {
    expect(present(admitted, NOW)).toEqual({
      tone: 'admitted',
      cue: 'success',
      holdMs: 1600,
      title: 'Admitted',
      detail: 'Regular · ticket 2 of 3',
      secondary: '2 of 3 on this booking are in',
      action: null,
    });
  });
  it('admitted single ticket: no "of" line', () => {
    const p = present({ ...admitted, ticketIndex: 1, totalTickets: 1, checkedInCount: 1 }, NOW);
    expect(p.detail).toBe('Regular');
    expect(p.secondary).toBeNull();
  });
  it('used by another named scanner: amber, 3.2 s, time and name', () => {
    const p = present(
      {
        kind: 'used',
        checkedInAt: '2026-10-05T17:30:00.000Z',
        scannedBy: { kind: 'named', name: 'Ada Gate' },
        ticketType: 'Regular',
        replayed: false,
      },
      NOW,
    );
    expect(p).toMatchObject({ tone: 'used', cue: 'warning', holdMs: 3200, title: 'Already used' });
    expect(p.detail).toMatch(/^Checked in .* by Ada Gate$/);
  });
  it('used by me just now / replay on this phone', () => {
    const base = { checkedInAt: '2026-10-05T18:04:40.000Z', ticketType: null } as const;
    expect(
      present({ kind: 'used', ...base, scannedBy: { kind: 'me' }, replayed: false }, NOW).detail,
    ).toBe('Checked in just now by you');
    expect(
      present({ kind: 'used', ...base, scannedBy: { kind: 'me' }, replayed: true }, NOW).detail,
    ).toBe('Checked in just now on this phone');
  });
  it('refused holds until Done; fixable refusals are amber', () => {
    expect(present({ kind: 'refused', reason: 'wrongEvent', fixable: false }, NOW)).toEqual({
      tone: 'refused',
      cue: 'error',
      holdMs: null,
      title: 'Refused',
      detail: 'This ticket is for a different event',
      secondary: null,
      action: 'done',
    });
    expect(present({ kind: 'refused', reason: 'expired', fixable: true }, NOW)).toMatchObject({
      tone: 'used',
      cue: 'warning',
      holdMs: null,
      detail: 'Code expired — ask them to refresh their ticket',
    });
  });
  it("couldn't check is neutral, held, and offers try again or sign in", () => {
    expect(present({ kind: 'couldntCheck', cause: 'timeout' }, NOW)).toEqual({
      tone: 'retry',
      cue: 'retry',
      holdMs: null,
      title: "Couldn't check",
      detail: "We couldn't reach the server — scan again",
      secondary: null,
      action: 'tryAgain',
    });
    expect(present({ kind: 'couldntCheck', cause: 'auth' }, NOW).action).toBe('signIn');
  });
});
```

- [ ] **Step 6: Run it and confirm it fails**

Run: `npx jest src/features/gate/domain/__tests__/present.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 7: Implement `present.ts`**

```ts
import type { RefusalReason, ScanOutcome, ScannedBy } from './outcome';

export type Tone = 'admitted' | 'used' | 'refused' | 'retry';
export type Cue = 'success' | 'warning' | 'error' | 'retry';
export type Presentation = {
  tone: Tone;
  cue: Cue;
  holdMs: number | null;
  title: string;
  detail: string;
  secondary: string | null;
  action: 'tryAgain' | 'signIn' | 'done' | null;
};

export const HOLD_ADMITTED_MS = 1600;
export const HOLD_USED_MS = 3200;

const REASON: Record<RefusalReason, string> = {
  notFound: 'Ticket not found',
  oldFormat: 'Old ticket format — look this booking up by hand',
  wrongEvent: 'This ticket is for a different event',
  notConfirmed: 'Booking is not confirmed',
  invalid: 'Invalid ticket code',
  notTicket: 'Not a Bookhushly ticket',
  expired: 'Code expired — ask them to refresh their ticket',
  staticNotAllowed: 'Printed QR not accepted — ask for the live ticket',
  notAssigned: "You aren't assigned to this event — call the organiser",
  other: "This ticket can't be admitted",
};

const pad = (n: number) => String(n).padStart(2, '0');

function when(iso: string | null, nowMs: number): string {
  const t = iso === null ? NaN : Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  if (Math.abs(nowMs - t) < 60_000) return 'just now';
  const d = new Date(t);
  return `at ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function who(by: ScannedBy, replayed: boolean): string {
  switch (by.kind) {
    case 'me':
      return replayed ? 'on this phone' : 'by you';
    case 'named':
      return `by ${by.name}`;
    case 'anotherScanner':
      return 'by another scanner';
    case 'unknown':
      return '';
  }
}

export function present(o: ScanOutcome, nowMs: number): Presentation {
  switch (o.kind) {
    case 'admitted': {
      const type = o.ticketType ?? 'Ticket';
      const many = o.totalTickets !== null && o.totalTickets > 1;
      return {
        tone: 'admitted',
        cue: 'success',
        holdMs: HOLD_ADMITTED_MS,
        title: 'Admitted',
        detail:
          many && o.ticketIndex !== null
            ? `${type} · ticket ${String(o.ticketIndex)} of ${String(o.totalTickets)}`
            : type,
        secondary:
          many && o.checkedInCount !== null
            ? `${String(o.checkedInCount)} of ${String(o.totalTickets)} on this booking are in`
            : null,
        action: null,
      };
    }
    case 'used': {
      const parts = ['Checked in', when(o.checkedInAt, nowMs), who(o.scannedBy, o.replayed)];
      return {
        tone: 'used',
        cue: 'warning',
        holdMs: HOLD_USED_MS,
        title: 'Already used',
        detail: parts.filter((p) => p !== '').join(' '),
        secondary: null,
        action: null,
      };
    }
    case 'refused':
      return {
        tone: o.fixable ? 'used' : 'refused',
        cue: o.fixable ? 'warning' : 'error',
        holdMs: null,
        title: 'Refused',
        detail: REASON[o.reason],
        secondary: null,
        action: 'done',
      };
    case 'couldntCheck':
      return {
        tone: 'retry',
        cue: 'retry',
        holdMs: null,
        title: "Couldn't check",
        detail:
          o.cause === 'auth'
            ? 'Your session expired — sign in again, then scan again'
            : "We couldn't reach the server — scan again",
        secondary: null,
        action: o.cause === 'auth' ? 'signIn' : 'tryAgain',
      };
  }
}
```

- [ ] **Step 8: Run all domain tests and confirm they pass**

Run: `npx jest src/features/gate/domain`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/gate/domain/outcome.ts src/features/gate/domain/present.ts src/features/gate/domain/__tests__/outcome.test.ts src/features/gate/domain/__tests__/present.test.ts
git commit -m "feat(gate): classify scan responses into the four outcomes"
```

---

### Task 5: Scan queue

**Files:**

- Create: `src/features/gate/domain/scanQueue.ts`
- Test: `src/features/gate/domain/__tests__/scanQueue.test.ts`

**Interfaces:**

- Consumes: `TicketCode` (Task 1); `ScanResponse`, `ScanOutcome`, `classify`, `isTransient`, `mayHaveCommitted`, `replayOf` (Task 4).
- Produces:

```ts
export type EnqueueResult = 'queued' | 'inFlight' | 'replayed' | 'cooldown';
export type ScanQueueDeps = {
  submit: (code: TicketCode) => Promise<ScanResponse>;
  onResult: (code: TicketCode, outcome: ScanOutcome) => void;
  now: () => number; // server-clock ms (clock.serverNow)
  random: () => number;
  sleep: (ms: number) => Promise<void>;
  concurrency?: number; // 3
  maxRetries?: number; // 2
  cooldownMs?: number; // 2000
  maxSettled?: number; // 5000
};
export function createScanQueue(deps: ScanQueueDeps): {
  enqueue(code: TicketCode, opts?: { manual?: boolean }): EnqueueResult;
  pendingCount(): number;
  reset(): void;
};
```

Semantics:

- `manual: true` (typed code, "Try again") skips the cooldown. It still de-dupes in-flight codes and replays settled ones.
- Only `admitted` and `used` are remembered. Refusals and `couldntCheck` always go back to the server.
- The queue remembers per code when a request may have committed (`uncertainSince`), so a later manual "Try again" that gets `already_checked_in` shows "by you".
- `reset()` (event switch) drops queued work, memory and cooldowns. Results from older generations are not emitted.

- [ ] **Step 1: Write the failing test**

```ts
import { createScanQueue, type ScanQueueDeps } from '@/features/gate/domain/scanQueue';
import type { ScanOutcome, ScanResponse } from '@/features/gate/domain/outcome';
import { parseTicketCode, type TicketCode } from '@/features/gate/domain/parseTicketCode';
import { fx } from '@/features/gate/schemas/__fixtures__/scan';
import { admitBody } from '@/features/gate/schemas/scan';
import { errorFromResponse } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

const code = (n: number): TicketCode => {
  const p = parseTicketCode(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
  if (!p) throw new Error('bad fixture');
  return p.value;
};
const H = { get: () => null };
const ADMIT: ScanResponse = ok(admitBody.parse(fx.admitted.body));
const fail = (f: { status: number; body: unknown }): ScanResponse =>
  err(errorFromResponse(f.status, f.body, H));
const TIMEOUT: ScanResponse = err({ kind: 'timeout' });

type Deferred = { resolve: (r: ScanResponse) => void };
const flush = () => new Promise<void>((r) => setImmediate(r));

function harness(over: Partial<ScanQueueDeps> = {}) {
  let t = Date.parse('2026-10-05T18:00:00.000Z');
  const pending: Deferred[] = [];
  const results: { code: TicketCode; outcome: ScanOutcome }[] = [];
  const sleeps: number[] = [];
  const submit = jest.fn(
    () =>
      new Promise<ScanResponse>((resolve) => {
        pending.push({ resolve });
      }),
  );
  const q = createScanQueue({
    submit,
    onResult: (c, o) => results.push({ code: c, outcome: o }),
    now: () => t,
    random: () => 0,
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
    ...over,
  });
  return {
    q,
    submit,
    results,
    sleeps,
    advance: (ms: number) => {
      t += ms;
    },
    answer: async (r: ScanResponse) => {
      const d = pending.shift();
      if (!d) throw new Error('nothing in flight');
      d.resolve(r);
      await flush();
    },
  };
}

describe('scan queue', () => {
  it('submits and reports the classified outcome', async () => {
    const h = harness();
    expect(h.q.enqueue(code(1))).toBe('queued');
    await h.answer(ADMIT);
    expect(h.results.map((r) => r.outcome.kind)).toEqual(['admitted']);
    expect(h.q.pendingCount()).toBe(0);
  });

  it('runs at most three requests at once and keeps the rest queued', async () => {
    const h = harness();
    for (let i = 1; i <= 5; i++) h.q.enqueue(code(i));
    expect(h.submit).toHaveBeenCalledTimes(3);
    expect(h.q.pendingCount()).toBe(5);
    await h.answer(ADMIT);
    expect(h.submit).toHaveBeenCalledTimes(4);
  });

  it('ignores the same code while it is queued or in flight', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    expect(h.q.enqueue(code(1))).toBe('inFlight');
    expect(h.q.enqueue(code(1), { manual: true })).toBe('inFlight');
    expect(h.submit).toHaveBeenCalledTimes(1);
  });

  it('absorbs repeat camera reads for 2 s after a result, unless manual', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(fail(fx.notFound));
    expect(h.q.enqueue(code(1))).toBe('cooldown');
    expect(h.q.enqueue(code(1), { manual: true })).toBe('queued');
    await h.answer(fail(fx.notFound));
    h.advance(2001);
    expect(h.q.enqueue(code(1))).toBe('queued');
  });

  it('replays a settled code as already used on this phone without a request', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(ADMIT);
    h.advance(2001);
    expect(h.q.enqueue(code(1))).toBe('replayed');
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.results[1]?.outcome).toMatchObject({
      kind: 'used',
      scannedBy: { kind: 'me' },
      replayed: true,
    });
  });

  it('retries transient failures twice with 400 ms × attempt backoff', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(fail(fx.lookupFailed));
    await h.answer(fail(fx.rateLimited));
    await h.answer(ADMIT);
    expect(h.submit).toHaveBeenCalledTimes(3);
    expect(h.sleeps).toEqual([400, 800]);
    expect(h.results.map((r) => r.outcome.kind)).toEqual(['admitted']);
  });

  it("gives up after two retries with couldn't check", async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(TIMEOUT);
    await h.answer(TIMEOUT);
    await h.answer(TIMEOUT);
    expect(h.submit).toHaveBeenCalledTimes(3);
    expect(h.results[0]?.outcome).toEqual({ kind: 'couldntCheck', cause: 'timeout' });
  });

  it.each([fx.notFound, fx.forbidden, fx.wrongEvent, fx.unauthorized, fx.invalidStatic])(
    'never retries a business answer or auth failure %#',
    async (f) => {
      const h = harness();
      h.q.enqueue(code(1));
      await h.answer(fail(f));
      expect(h.submit).toHaveBeenCalledTimes(1);
    },
  );

  it('timeout then already used → used by me', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(TIMEOUT);
    const usedNow = {
      status: 409,
      body: { ...fx.usedByName.body, checked_in_at: '2026-10-05T18:00:00.500Z' },
    };
    await h.answer(fail(usedNow));
    expect(h.results[0]?.outcome).toMatchObject({ kind: 'used', scannedBy: { kind: 'me' } });
  });

  it('429 then already used → not by me (a 429 never reached the database)', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(fail(fx.rateLimited));
    await h.answer(fail(fx.usedByName));
    expect(h.results[0]?.outcome).toMatchObject({ scannedBy: { kind: 'named', name: 'Ada Gate' } });
  });

  it("remembers an uncertain couldn't-check so Try again shows used by me", async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(TIMEOUT);
    await h.answer(TIMEOUT);
    await h.answer(TIMEOUT);
    h.q.enqueue(code(1), { manual: true });
    await h.answer(
      fail({
        status: 409,
        body: { ...fx.usedByName.body, checked_in_at: '2026-10-05T18:00:01.000Z' },
      }),
    );
    expect(h.results[1]?.outcome).toMatchObject({ kind: 'used', scannedBy: { kind: 'me' } });
  });

  it("does not remember fixable refusals, not-assigned or couldn't check", async () => {
    const h = harness();
    for (const f of [fx.expiredCode, fx.staticNotAllowed, fx.forbidden]) {
      h.q.enqueue(code(1), { manual: true });
      await h.answer(fail(f));
    }
    expect(h.submit).toHaveBeenCalledTimes(3);
  });

  it('evicts the oldest settled code past the cap', async () => {
    const h = harness({ maxSettled: 2 });
    for (const n of [1, 2, 3]) {
      h.q.enqueue(code(n));
      await h.answer(ADMIT);
    }
    h.advance(2001);
    expect(h.q.enqueue(code(1))).toBe('queued');
    expect(h.q.enqueue(code(3))).toBe('replayed');
  });

  it('treats a throwing submit as a network failure', async () => {
    const h = harness({ submit: () => Promise.reject(new Error('boom')), maxRetries: 0 });
    h.q.enqueue(code(1));
    await flush();
    expect(h.results[0]?.outcome).toEqual({ kind: 'couldntCheck', cause: 'network' });
  });

  it('reset drops queued work, memory and late results', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    h.q.reset();
    await h.answer(ADMIT);
    expect(h.results).toEqual([]);
    expect(h.q.pendingCount()).toBe(0);
    expect(h.q.enqueue(code(1))).toBe('queued');
  });

  it('a throwing onResult does not stall the queue', async () => {
    const h = harness({
      onResult: () => {
        throw new Error('consumer bug');
      },
    });
    h.q.enqueue(code(1));
    h.q.enqueue(code(2));
    h.q.enqueue(code(3));
    h.q.enqueue(code(4));
    await h.answer(ADMIT);
    expect(h.submit).toHaveBeenCalledTimes(4);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/features/gate/domain/__tests__/scanQueue.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
import { err } from '@/shared/lib/result';

import {
  classify,
  isTransient,
  mayHaveCommitted,
  replayOf,
  type ScanOutcome,
  type ScanResponse,
} from './outcome';
import type { TicketCode } from './parseTicketCode';

export type EnqueueResult = 'queued' | 'inFlight' | 'replayed' | 'cooldown';

export type ScanQueueDeps = {
  submit: (code: TicketCode) => Promise<ScanResponse>;
  onResult: (code: TicketCode, outcome: ScanOutcome) => void;
  now: () => number;
  random: () => number;
  sleep: (ms: number) => Promise<void>;
  concurrency?: number;
  maxRetries?: number;
  cooldownMs?: number;
  maxSettled?: number;
};

// Port of web lib/scan/queue.js: queue, don't drop; de-dupe on the code; replay settled codes.
// Differences: the queue (not the API client) owns retries because the scan POST is not
// idempotent, and it tracks when an attempt may have committed (see classify's uncertainSince).
export function createScanQueue(deps: ScanQueueDeps) {
  const concurrency = deps.concurrency ?? 3;
  const maxRetries = deps.maxRetries ?? 2;
  const cooldownMs = deps.cooldownMs ?? 2_000;
  const maxSettled = deps.maxSettled ?? 5_000;

  let generation = 0;
  let active = 0;
  const waiting: TicketCode[] = [];
  const pending = new Set<TicketCode>();
  const settled = new Map<TicketCode, ScanOutcome>();
  const uncertain = new Map<TicketCode, number>();
  const cooldownUntil = new Map<TicketCode, number>();

  function emit(code: TicketCode, outcome: ScanOutcome) {
    try {
      deps.onResult(code, outcome);
    } catch {
      // A throwing consumer must not stall the door.
    }
  }

  function startCooldown(code: TicketCode) {
    const now = deps.now();
    cooldownUntil.set(code, now + cooldownMs);
    if (cooldownUntil.size > 1_000) {
      for (const [k, until] of cooldownUntil) if (until <= now) cooldownUntil.delete(k);
    }
  }

  function remember(code: TicketCode, outcome: ScanOutcome) {
    settled.delete(code);
    settled.set(code, outcome);
    if (settled.size > maxSettled) {
      const oldest = settled.keys().next();
      if (!oldest.done) settled.delete(oldest.value);
    }
  }

  async function submitSafely(code: TicketCode): Promise<ScanResponse> {
    try {
      return await deps.submit(code);
    } catch {
      return err({ kind: 'network' });
    }
  }

  async function run(
    code: TicketCode,
  ): Promise<{ outcome: ScanOutcome; uncertainSince: number | null }> {
    let uncertainSince = uncertain.get(code) ?? null;
    for (let attempt = 0; ; attempt++) {
      const startedAt = deps.now();
      const res = await submitSafely(code);
      const outcome = classify(res, { uncertainSince });
      if (mayHaveCommitted(res)) uncertainSince ??= startedAt;
      if (!isTransient(res) || attempt >= maxRetries) return { outcome, uncertainSince };
      await deps.sleep(400 * (attempt + 1) + Math.floor(deps.random() * 200));
    }
  }

  function drain() {
    while (active < concurrency) {
      const code = waiting.shift();
      if (code === undefined) return;
      active += 1;
      const gen = generation;
      void run(code).then(({ outcome, uncertainSince }) => {
        if (gen !== generation) return;
        active -= 1;
        pending.delete(code);
        if (outcome.kind === 'admitted' || outcome.kind === 'used') {
          remember(code, outcome);
          uncertain.delete(code);
        } else if (outcome.kind === 'couldntCheck' && uncertainSince !== null) {
          uncertain.set(code, uncertainSince);
        }
        startCooldown(code);
        emit(code, outcome);
        drain();
      });
    }
  }

  return {
    enqueue(code: TicketCode, opts: { manual?: boolean } = {}): EnqueueResult {
      if (pending.has(code)) return 'inFlight';
      const until = cooldownUntil.get(code);
      if (opts.manual !== true && until !== undefined && deps.now() < until) return 'cooldown';
      const s = settled.get(code);
      if (s) {
        startCooldown(code);
        emit(code, replayOf(s));
        return 'replayed';
      }
      pending.add(code);
      waiting.push(code);
      drain();
      return 'queued';
    },
    pendingCount: () => pending.size,
    reset() {
      generation += 1;
      active = 0;
      waiting.length = 0;
      pending.clear();
      settled.clear();
      uncertain.clear();
      cooldownUntil.clear();
    },
  };
}

export type ScanQueue = ReturnType<typeof createScanQueue>;
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx jest src/features/gate/domain/__tests__/scanQueue.test.ts`
Expected: PASS. If a test that answers several times in a row fails because the retry loop has not yet re-submitted, the `flush()` helper is not draining enough microtasks. Replace it with `await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));`. Do not change the queue to fit the test.

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/domain/scanQueue.ts src/features/gate/domain/__tests__/scanQueue.test.ts
git commit -m "feat(gate): scan queue with transient-only retries and settled replay"
```

---

### Task 6: Overlay queue

**Files:**

- Create: `src/features/gate/domain/overlayQueue.ts`
- Test: `src/features/gate/domain/__tests__/overlayQueue.test.ts`

**Interfaces:**

- Consumes: `ScanOutcome` (Task 4), `TicketCode` (Task 1), `present` (Task 4) for hold times.
- Produces:

```ts
export type OverlayItem = {
  id: number;
  code: TicketCode | null;
  outcome: ScanOutcome;
  shownAt: number | null;
  extraAdmitted: number;
};
export function createOverlayQueue(deps: { now: () => number; collapseAfter?: number }): {
  push(code: TicketCode | null, outcome: ScanOutcome): void;
  current(): OverlayItem | null;
  dismiss(): void;
  tick(): boolean; // true if current changed
  nextDeadline(): number | null;
  waitingCount(): number;
  clear(): void;
};
```

- [ ] **Step 1: Write the failing test**

```ts
import { createOverlayQueue } from '@/features/gate/domain/overlayQueue';
import type { ScanOutcome } from '@/features/gate/domain/outcome';

const A: ScanOutcome = {
  kind: 'admitted',
  ticketType: null,
  ticketIndex: null,
  totalTickets: null,
  checkedInCount: null,
  checkedInAt: null,
};
const U: ScanOutcome = {
  kind: 'used',
  checkedInAt: null,
  scannedBy: { kind: 'unknown' },
  ticketType: null,
  replayed: false,
};
const R: ScanOutcome = { kind: 'refused', reason: 'notFound', fixable: false };
const C: ScanOutcome = { kind: 'couldntCheck', cause: 'network' };

function harness() {
  let t = 0;
  const q = createOverlayQueue({ now: () => t });
  return { q, at: (ms: number) => (t = ms) };
}

describe('overlay queue', () => {
  it('shows the first result at once', () => {
    const { q } = harness();
    q.push(null, A);
    expect(q.current()).toMatchObject({ outcome: A, shownAt: 0, extraAdmitted: 0 });
  });
  it('auto-advances admitted after 1.6 s and used after 3.2 s', () => {
    const { q, at } = harness();
    q.push(null, A);
    q.push(null, U);
    at(1599);
    expect(q.tick()).toBe(false);
    at(1600);
    expect(q.tick()).toBe(true);
    expect(q.current()?.outcome).toBe(U);
    expect(q.nextDeadline()).toBe(1600 + 3200);
    at(4800);
    q.tick();
    expect(q.current()).toBeNull();
  });
  it('holds refusals and couldn’t-check until dismissed', () => {
    const { q, at } = harness();
    q.push(null, R);
    at(3_600_000);
    expect(q.tick()).toBe(false);
    expect(q.nextDeadline()).toBeNull();
    q.dismiss();
    expect(q.current()).toBeNull();
  });
  it('never replaces a held overlay with a later result', () => {
    const { q } = harness();
    q.push(null, C);
    q.push(null, A);
    q.push(null, R);
    expect(q.current()?.outcome).toBe(C);
    q.dismiss();
    expect(q.current()?.outcome).toBe(A);
  });
  it('collapses queued admissions into +N when more than three wait, keeping every non-admitted', () => {
    const { q } = harness();
    q.push(null, R);
    q.push(null, A);
    q.push(null, A);
    q.push(null, U);
    q.push(null, A);
    q.dismiss();
    expect(q.current()).toMatchObject({ outcome: U, extraAdmitted: 3 });
    expect(q.waitingCount()).toBe(0);
  });
  it('a run of admissions only collapses into one admitted with the rest counted', () => {
    const { q } = harness();
    q.push(null, R);
    for (let i = 0; i < 5; i++) q.push(null, A);
    q.dismiss();
    expect(q.current()).toMatchObject({ outcome: A, extraAdmitted: 4 });
  });
  it('does not collapse three or fewer', () => {
    const { q } = harness();
    q.push(null, R);
    q.push(null, A);
    q.push(null, A);
    q.push(null, U);
    q.dismiss();
    expect(q.current()).toMatchObject({ outcome: A, extraAdmitted: 0 });
    expect(q.waitingCount()).toBe(2);
  });
  it('gives each item a new id', () => {
    const { q } = harness();
    q.push(null, R);
    const first = q.current()?.id;
    q.push(null, R);
    q.dismiss();
    expect(q.current()?.id).not.toBe(first);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/features/gate/domain/__tests__/overlayQueue.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
import type { ScanOutcome } from './outcome';
import type { TicketCode } from './parseTicketCode';
import { HOLD_ADMITTED_MS, HOLD_USED_MS } from './present';

export type OverlayItem = {
  id: number;
  code: TicketCode | null;
  outcome: ScanOutcome;
  shownAt: number | null;
  extraAdmitted: number;
};

function holdOf(o: ScanOutcome): number | null {
  switch (o.kind) {
    case 'admitted':
      return HOLD_ADMITTED_MS;
    case 'used':
      return HOLD_USED_MS;
    case 'refused':
    case 'couldntCheck':
      return null;
  }
}

export function createOverlayQueue(deps: { now: () => number; collapseAfter?: number }) {
  const collapseAfter = deps.collapseAfter ?? 3;
  let nextId = 1;
  let current: OverlayItem | null = null;
  let waiting: OverlayItem[] = [];

  function advance() {
    let next = waiting.shift() ?? null;
    if (next !== null && waiting.length + 1 > collapseAfter) {
      // A run of greens must never bury a red: fold admitted results into a count.
      const all = [next, ...waiting];
      const admitted = all.filter((i) => i.outcome.kind === 'admitted');
      const rest = all.filter((i) => i.outcome.kind !== 'admitted');
      if (rest.length > 0) {
        next = { ...(rest[0] ?? next), extraAdmitted: admitted.length };
        waiting = rest.slice(1);
      } else {
        next = { ...(admitted[admitted.length - 1] ?? next), extraAdmitted: admitted.length - 1 };
        waiting = [];
      }
    }
    current = next === null ? null : { ...next, shownAt: deps.now() };
  }

  return {
    push(code: TicketCode | null, outcome: ScanOutcome) {
      const item: OverlayItem = { id: nextId++, code, outcome, shownAt: null, extraAdmitted: 0 };
      if (current === null) current = { ...item, shownAt: deps.now() };
      else waiting.push(item);
    },
    current: () => current,
    dismiss() {
      if (current !== null) advance();
    },
    tick(): boolean {
      if (current === null || current.shownAt === null) return false;
      const hold = holdOf(current.outcome);
      if (hold === null || deps.now() < current.shownAt + hold) return false;
      advance();
      return true;
    },
    nextDeadline(): number | null {
      if (current === null || current.shownAt === null) return null;
      const hold = holdOf(current.outcome);
      return hold === null ? null : current.shownAt + hold;
    },
    waitingCount: () => waiting.length,
    clear() {
      current = null;
      waiting = [];
    },
  };
}

export type OverlayQueue = ReturnType<typeof createOverlayQueue>;
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx jest src/features/gate/domain/__tests__/overlayQueue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/domain/overlayQueue.ts src/features/gate/domain/__tests__/overlayQueue.test.ts
git commit -m "feat(gate): overlay queue that never replaces a held refusal"
```

---

### Task 7: Shared scannable-events loader

**Files:**

- Create: `src/shared/lib/dbError.ts`
- Create: `src/shared/api/scannableEvents.ts`
- Create: `src/shared/supabase/wrap.ts`
- Create: `src/shared/supabase/scannerDb.ts`
- Test: `src/shared/lib/__tests__/dbError.test.ts`, `src/shared/api/__tests__/scannableEvents.test.ts`

**Interfaces:**

- Consumes: `ApiError`, `Result`.
- Produces:

```ts
// src/shared/lib/dbError.ts
export type DbError = { code?: string; status?: number };
export type DbRes = { data: unknown; error: DbError | null };
export function dbErrorToApiError(e: DbError): ApiError;

// src/shared/api/scannableEvents.ts
export type ScannableEvent = {
  id: string;
  title: string | null;
  startsAt: string | null;
  location: string | null;
};
export type ScannerDb = {
  assignments(userId: string): Promise<DbRes>; // event_scanners + embedded listing
  vendorLinks(userId: string): Promise<DbRes>; // active vendor_scanners
  isListingScanner(listingId: string, userId: string): Promise<DbRes>;
};
export function loadScannableEvents(
  db: ScannerDb,
  userId: string,
): Promise<Result<ScannableEvent[], ApiError>>;

// src/shared/supabase/wrap.ts
export const wrap: (
  b: PromiseLike<{ data: unknown; error: { code?: string } | null; status: number }>,
) => Promise<DbRes>;

// src/shared/supabase/scannerDb.ts
export const scannerDb: ScannerDb;
```

Eligibility is the server's rule (`admit_ticket` / `is_listing_scanner`): an active `event_scanners` row AND an active `vendor_scanners` row for that listing's vendor. RLS: `event_scanners_self_select`, `vendor_scanners_self_select`, and listings are visible when public. A hidden listing embeds as `null`. For those rows only, call the RPC (it is `GRANT`ed to `authenticated`). With no active vendor link, nothing is eligible, so skip the RPCs.

- [ ] **Step 1: Write the failing tests**

`src/shared/lib/__tests__/dbError.test.ts`:

```ts
import { dbErrorToApiError } from '@/shared/lib/dbError';

it('maps PostgREST failures to the api taxonomy', () => {
  expect(dbErrorToApiError({ status: 401 })).toEqual({ kind: 'forbidden' });
  expect(dbErrorToApiError({ status: 403 })).toEqual({ kind: 'forbidden' });
  expect(dbErrorToApiError({ status: 503 })).toEqual({ kind: 'unavailable', status: 503 });
  expect(dbErrorToApiError({ status: 0 })).toEqual({ kind: 'network' });
  expect(dbErrorToApiError({})).toEqual({ kind: 'network' });
  expect(dbErrorToApiError({ status: 400 })).toEqual({ kind: 'unknown', status: 400 });
});
```

`src/shared/api/__tests__/scannableEvents.test.ts`:

```ts
import { loadScannableEvents, type ScannerDb } from '@/shared/api/scannableEvents';

const okRes = (data: unknown) => Promise.resolve({ data, error: null });
const errRes = (status: number) => Promise.resolve({ data: null, error: { status } });

const L1 = '11111111-1111-4111-8111-111111111111';
const L2 = '22222222-2222-4222-8222-222222222222';
const L3 = '33333333-3333-4333-8333-333333333333';
const listing = (id: string, vendor: string) => ({
  id,
  title: `Event ${id.slice(0, 1)}`,
  event_date: '2026-10-10T00:00:00',
  event_time: '2026-10-10T18:00:00+00:00',
  location: 'Lagos',
  vendor_id: vendor,
});

const db = (over: Partial<ScannerDb> = {}): ScannerDb => ({
  assignments: () => okRes([]),
  vendorLinks: () => okRes([]),
  isListingScanner: () => okRes(false),
  ...over,
});

describe('loadScannableEvents', () => {
  it('keeps assignments whose vendor has an active link to me', async () => {
    const r = await loadScannableEvents(
      db({
        assignments: () =>
          okRes([
            { listing_id: L1, listing: listing(L1, 'v1') },
            { listing_id: L2, listing: listing(L2, 'v2') },
          ]),
        vendorLinks: () => okRes([{ vendor_id: 'v1' }]),
      }),
      'u',
    );
    expect(r).toEqual({
      ok: true,
      value: [
        { id: L1, title: 'Event 1', startsAt: '2026-10-10T18:00:00+00:00', location: 'Lagos' },
      ],
    });
  });

  it('falls back to event_date when there is no event_time', async () => {
    const r = await loadScannableEvents(
      db({
        assignments: () =>
          okRes([{ listing_id: L1, listing: { ...listing(L1, 'v1'), event_time: null } }]),
        vendorLinks: () => okRes([{ vendor_id: 'v1' }]),
      }),
      'u',
    );
    expect(r.ok && r.value[0]?.startsAt).toBe('2026-10-10T00:00:00');
  });

  it('includes a hidden listing only when the server confirms access', async () => {
    const isListingScanner = jest.fn((id: string) => okRes(id === L2));
    const r = await loadScannableEvents(
      db({
        assignments: () =>
          okRes([
            { listing_id: L2, listing: null },
            { listing_id: L3, listing: null },
          ]),
        vendorLinks: () => okRes([{ vendor_id: 'v9' }]),
        isListingScanner,
      }),
      'u',
    );
    expect(r).toEqual({
      ok: true,
      value: [{ id: L2, title: null, startsAt: null, location: null }],
    });
    expect(isListingScanner).toHaveBeenCalledTimes(2);
  });

  it('with no active vendor link nothing is eligible and no rpc is made', async () => {
    const isListingScanner = jest.fn(() => okRes(true));
    const r = await loadScannableEvents(
      db({
        assignments: () => okRes([{ listing_id: L2, listing: null }]),
        isListingScanner,
      }),
      'u',
    );
    expect(r).toEqual({ ok: true, value: [] });
    expect(isListingScanner).not.toHaveBeenCalled();
  });

  it('de-duplicates repeated assignment rows', async () => {
    const row = { listing_id: L1, listing: listing(L1, 'v1') };
    const r = await loadScannableEvents(
      db({ assignments: () => okRes([row, row]), vendorLinks: () => okRes([{ vendor_id: 'v1' }]) }),
      'u',
    );
    expect(r.ok && r.value).toHaveLength(1);
  });

  it('surfaces read failures and malformed rows as errors', async () => {
    expect(await loadScannableEvents(db({ assignments: () => errRes(503) }), 'u')).toEqual({
      ok: false,
      error: { kind: 'unavailable', status: 503 },
    });
    expect(await loadScannableEvents(db({ vendorLinks: () => errRes(0) }), 'u')).toEqual({
      ok: false,
      error: { kind: 'network' },
    });
    expect(await loadScannableEvents(db({ assignments: () => okRes([{ nope: 1 }]) }), 'u')).toEqual(
      { ok: false, error: { kind: 'validation' } },
    );
    expect(
      await loadScannableEvents(
        db({
          assignments: () => okRes([{ listing_id: L2, listing: null }]),
          vendorLinks: () => okRes([{ vendor_id: 'v1' }]),
          isListingScanner: () => errRes(503),
        }),
        'u',
      ),
    ).toEqual({ ok: false, error: { kind: 'unavailable', status: 503 } });
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx jest src/shared/lib/__tests__/dbError.test.ts src/shared/api/__tests__/scannableEvents.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `dbError.ts`** (moved verbatim from `src/features/mode/api/loadModeInputs.ts` `toApiError`)

```ts
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
```

- [ ] **Step 4: Implement `scannableEvents.ts`**

```ts
import { z } from 'zod';

import { dbErrorToApiError, type DbRes } from '@/shared/lib/dbError';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

export type ScannableEvent = {
  id: string;
  /** null when the listing is hidden from this scanner (draft/private) — show "Event · <short id>". */
  title: string | null;
  startsAt: string | null;
  location: string | null;
};

export type ScannerDb = {
  assignments(userId: string): Promise<DbRes>;
  vendorLinks(userId: string): Promise<DbRes>;
  isListingScanner(listingId: string, userId: string): Promise<DbRes>;
};

const listingRow = z.object({
  id: z.string(),
  title: z.string(),
  event_date: z.string().nullable(),
  event_time: z.string().nullable(),
  location: z.string().nullable(),
  vendor_id: z.string(),
});
const assignmentRows = z.array(
  z.object({ listing_id: z.string(), listing: listingRow.nullable() }),
);
const vendorRows = z.array(z.object({ vendor_id: z.string() }));

// Server rule (admit_ticket / is_listing_scanner): active event_scanners row AND an active
// vendor_scanners row for that listing's vendor.
export async function loadScannableEvents(
  db: ScannerDb,
  userId: string,
): Promise<Result<ScannableEvent[], ApiError>> {
  const [a, v] = await Promise.all([db.assignments(userId), db.vendorLinks(userId)]);
  if (a.error) return err(dbErrorToApiError(a.error));
  if (v.error) return err(dbErrorToApiError(v.error));
  const rows = assignmentRows.safeParse(a.data);
  const vendors = vendorRows.safeParse(v.data);
  if (!rows.success || !vendors.success) return err({ kind: 'validation' });

  const activeVendors = new Set(vendors.data.map((r) => r.vendor_id));
  if (activeVendors.size === 0) return ok([]);

  const seen = new Set<string>();
  const events: ScannableEvent[] = [];
  const hidden: string[] = [];
  for (const row of rows.data) {
    if (seen.has(row.listing_id)) continue;
    seen.add(row.listing_id);
    const l = row.listing;
    if (l === null) hidden.push(row.listing_id);
    else if (activeVendors.has(l.vendor_id)) {
      events.push({
        id: l.id,
        title: l.title,
        startsAt: l.event_time ?? l.event_date,
        location: l.location,
      });
    }
  }

  const checks = await Promise.all(hidden.map((id) => db.isListingScanner(id, userId)));
  for (const [i, c] of checks.entries()) {
    if (c.error) return err(dbErrorToApiError(c.error));
    const id = hidden[i];
    if (c.data === true && id !== undefined) {
      events.push({ id, title: null, startsAt: null, location: null });
    }
  }
  return ok(events);
}
```

- [ ] **Step 5: Implement the Supabase side** (no unit test; it is only `supabase` calls)

`src/shared/supabase/wrap.ts` (moved from `src/features/mode/hooks/useModeState.ts`):

```ts
import type { DbRes } from '@/shared/lib/dbError';

type Builder = PromiseLike<{ data: unknown; error: { code?: string } | null; status: number }>;

export const wrap = async (b: Builder): Promise<DbRes> => {
  const r = await b;
  return { data: r.data, error: r.error ? { code: r.error.code, status: r.status } : null };
};
```

`src/shared/supabase/scannerDb.ts`:

```ts
import type { ScannerDb } from '@/shared/api/scannableEvents';

import { supabase } from './client';
import { wrap } from './wrap';

export const scannerDb: ScannerDb = {
  assignments: (userId) =>
    wrap(
      supabase
        .from('event_scanners')
        .select('listing_id, listing:listings(id,title,event_date,event_time,location,vendor_id)')
        .eq('user_id', userId)
        .eq('is_active', true),
    ),
  vendorLinks: (userId) =>
    wrap(
      supabase
        .from('vendor_scanners')
        .select('vendor_id')
        .eq('user_id', userId)
        .eq('is_active', true),
    ),
  isListingScanner: (listingId, userId) =>
    wrap(supabase.rpc('is_listing_scanner', { p_listing_id: listingId, p_user_id: userId })),
};
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `npx jest src/shared && npx tsc --noEmit`
Expected: PASS; tsc clean. If tsc rejects `supabase.rpc(...)` as a `Builder` because its `status` type differs, widen `Builder` to `PromiseLike<{ data: unknown; error: { code?: string } | null; status?: number }>` and use `status: r.status ?? 0`.

- [ ] **Step 7: Commit**

```bash
git add src/shared/lib/dbError.ts src/shared/lib/__tests__/dbError.test.ts src/shared/api/scannableEvents.ts src/shared/api/__tests__/scannableEvents.test.ts src/shared/supabase/wrap.ts src/shared/supabase/scannerDb.ts
git commit -m "feat(shared): scannable-events loader using the server's scanner rule"
```

---

### Task 8: Mode count uses the shared rule; event-list grouping

**Files:**

- Modify: `src/features/mode/api/loadModeInputs.ts`
- Modify: `src/features/mode/hooks/useModeState.ts`
- Modify: `src/features/mode/api/__tests__/loadModeInputs.test.ts`
- Create: `src/features/gate/domain/eventList.ts`
- Test: `src/features/gate/domain/__tests__/eventList.test.ts`

**Interfaces:**

- Consumes: `loadScannableEvents`, `ScannableEvent`, `scannerDb`, `wrap`, `dbErrorToApiError` (Task 7).
- Produces:

```ts
// mode
export type ModeDb = {
  profile(userId: string): Promise<DbRes>;
  hotelStaff(userId: string): Promise<DbRes>;
  scannableEvents(userId: string): Promise<Result<readonly unknown[], ApiError>>;
};
// gate
export type EventGroups = { upcoming: ScannableEvent[]; earlier: ScannableEvent[] };
export function groupEvents(events: readonly ScannableEvent[], nowMs: number): EventGroups;
export function pickAutoOpen(
  events: readonly ScannableEvent[],
  lastEventId: string | null,
): string | null;
export function eventLabel(e: ScannableEvent): string;
```

This fixes the Phase 0 bug: gate mode is now offered only when the server would let the user scan.

- [ ] **Step 1: Update the mode tests first**

In `src/features/mode/api/__tests__/loadModeInputs.test.ts`, replace the `db` factory and every `activeScanners: () => okRes([...])` override with `scannableEvents`:

```ts
const db = (over: Partial<ModeDb> = {}): ModeDb => ({
  profile: () => okRes({ id: 'u', role: 'customer' }),
  hotelStaff: () => okRes(null),
  scannableEvents: () => Promise.resolve({ ok: true, value: [] }),
  ...over,
});
```

The "assembles inputs" test override becomes:

```ts
        scannableEvents: () => Promise.resolve({ ok: true, value: [{ id: 'l1' }] }),
```

Add:

```ts
it('a failed scannable-events read is an error, not "no gate mode"', async () => {
  const r = await loadModeInputs(
    db({ scannableEvents: () => Promise.resolve({ ok: false, error: { kind: 'network' } }) }),
    'u',
  );
  expect(r).toEqual({ ok: false, error: { kind: 'network' } });
});
```

Any remaining test that used `activeScanners: () => errRes(...)` becomes `scannableEvents: () => Promise.resolve({ ok: false, error: { kind: 'unavailable', status: 503 } })`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx jest src/features/mode`
Expected: FAIL, tsc/jest type error on `scannableEvents`.

- [ ] **Step 3: Implement the mode change**

`src/features/mode/api/loadModeInputs.ts`:

```ts
import type { ModeInputs } from '@/features/mode/domain/resolveMode';
import { hotelStaffRow, profileRow } from '@/features/mode/schemas/rows';
import { dbErrorToApiError, type DbRes } from '@/shared/lib/dbError';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

export type ModeDb = {
  profile(userId: string): Promise<DbRes>;
  hotelStaff(userId: string): Promise<DbRes>;
  scannableEvents(userId: string): Promise<Result<readonly unknown[], ApiError>>;
};

export async function loadModeInputs(
  db: ModeDb,
  userId: string,
): Promise<Result<ModeInputs, ApiError>> {
  const [p, h, s] = await Promise.all([
    db.profile(userId),
    db.hotelStaff(userId),
    db.scannableEvents(userId),
  ]);
  if (p.error) return err(dbErrorToApiError(p.error));
  if (h.error) return err(dbErrorToApiError(h.error));
  if (!s.ok) return err(s.error);
  if (p.data === null) return err({ kind: 'notFound' });
  const profile = profileRow.safeParse(p.data);
  const staff = hotelStaffRow.safeParse(h.data);
  if (!profile.success || !staff.success) return err({ kind: 'validation' });
  return ok({
    role: profile.data.role,
    hotelStaff: staff.data ? { hotelId: staff.data.hotel_id } : null,
    activeScannerCount: s.value.length,
  });
}
```

Delete `scannerRows` from `src/features/mode/schemas/rows.ts` and its test case in `schemas/__tests__/rows.test.ts`. Check first with `grep -rn scannerRows src`.

`src/features/mode/hooks/useModeState.ts`: delete the local `Builder` type and `wrap` function, then:

```ts
import { loadScannableEvents } from '@/shared/api/scannableEvents';
import { scannerDb } from '@/shared/supabase/scannerDb';
import { wrap } from '@/shared/supabase/wrap';
// …
const db: ModeDb = {
  profile: (id) =>
    wrap(supabase.from('users').select('id,role,name,email').eq('id', id).maybeSingle()),
  hotelStaff: (id) =>
    wrap(supabase.from('hotel_staff').select('hotel_id').eq('user_id', id).maybeSingle()),
  scannableEvents: (id) => loadScannableEvents(scannerDb, id),
};
```

- [ ] **Step 4: Run the mode tests and confirm they pass**

Run: `npx jest src/features/mode && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Write the failing `eventList` test**

```ts
import { eventLabel, groupEvents, pickAutoOpen } from '@/features/gate/domain/eventList';
import type { ScannableEvent } from '@/shared/api/scannableEvents';

const NOW = Date.parse('2026-10-05T12:00:00.000Z');
const ev = (id: string, startsAt: string | null, title: string | null = id): ScannableEvent => ({
  id,
  title,
  startsAt,
  location: null,
});

describe('groupEvents', () => {
  it('upcoming soonest first, unknown dates last; earlier most recent first', () => {
    const g = groupEvents(
      [
        ev('late', '2026-10-20T18:00:00Z'),
        ev('nodate', null),
        ev('soon', '2026-10-06T18:00:00Z'),
        ev('old', '2026-09-01T18:00:00Z'),
        ev('older', '2026-08-01T18:00:00Z'),
      ],
      NOW,
    );
    expect(g.upcoming.map((e) => e.id)).toEqual(['soon', 'late', 'nodate']);
    expect(g.earlier.map((e) => e.id)).toEqual(['old', 'older']);
  });
  it('an event that started within the last 12 h is still upcoming (doors are open)', () => {
    const g = groupEvents([ev('tonight', '2026-10-05T02:00:00Z')], NOW);
    expect(g.upcoming).toHaveLength(1);
  });
});

describe('pickAutoOpen', () => {
  it('reopens the last event only if it is still listed', () => {
    const list = [ev('a', null), ev('b', null)];
    expect(pickAutoOpen(list, 'b')).toBe('b');
    expect(pickAutoOpen(list, 'gone')).toBeNull();
    expect(pickAutoOpen(list, null)).toBeNull();
  });
});

describe('eventLabel', () => {
  it('falls back to a short id for hidden listings', () => {
    expect(eventLabel(ev('11111111-2222-4333-8444-555555555555', null, null))).toBe(
      'Event · 11111111',
    );
    expect(eventLabel(ev('x', null, 'Afro Night'))).toBe('Afro Night');
  });
});
```

- [ ] **Step 6: Run it and confirm it fails**

Run: `npx jest src/features/gate/domain/__tests__/eventList.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 7: Implement**

```ts
import type { ScannableEvent } from '@/shared/api/scannableEvents';

export type EventGroups = { upcoming: ScannableEvent[]; earlier: ScannableEvent[] };

// Doors stay open after the listed start time; keep tonight's event at the top.
const STILL_ON_MS = 12 * 60 * 60 * 1000;

const startOf = (e: ScannableEvent) => (e.startsAt === null ? NaN : Date.parse(e.startsAt));

export function groupEvents(events: readonly ScannableEvent[], nowMs: number): EventGroups {
  const upcoming: ScannableEvent[] = [];
  const earlier: ScannableEvent[] = [];
  for (const e of events) {
    const t = startOf(e);
    if (Number.isFinite(t) && t < nowMs - STILL_ON_MS) earlier.push(e);
    else upcoming.push(e);
  }
  const key = (e: ScannableEvent) => {
    const t = startOf(e);
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
  };
  upcoming.sort((a, b) => key(a) - key(b));
  earlier.sort((a, b) => startOf(b) - startOf(a));
  return { upcoming, earlier };
}

export function pickAutoOpen(
  events: readonly ScannableEvent[],
  lastEventId: string | null,
): string | null {
  if (lastEventId === null) return null;
  return events.some((e) => e.id === lastEventId) ? lastEventId : null;
}

export function eventLabel(e: ScannableEvent): string {
  return e.title ?? `Event · ${e.id.slice(0, 8)}`;
}
```

- [ ] **Step 8: Run all tests**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/mode src/features/gate/domain/eventList.ts src/features/gate/domain/__tests__/eventList.test.ts
git commit -m "fix(mode): offer gate mode only when the server's scanner rule allows it"
```

---

### Task 9: Feedback: sounds, haptics, mute

**Files:**

- Create: `scripts/gen-gate-sounds.mjs`
- Create (generated): `assets/sounds/gate-success.wav`, `gate-warning.wav`, `gate-error.wav`, `gate-retry.wav`
- Create: `src/shared/lib/feedbackPlan.ts` (pure)
- Create: `src/shared/platform/feedback.ts`
- Modify: `docs/ASSET_LICENSES.md` (record that the sounds are generated in-repo)
- Modify: `package.json` / `package-lock.json` via `npx expo install expo-audio expo-haptics`
- Test: `src/shared/lib/__tests__/feedbackPlan.test.ts`, `src/shared/platform/__tests__/feedback.test.ts`

**Interfaces:**

- Consumes: `KeyValue` (`@/shared/lib/kv`), `plainKv`.
- Produces:

```ts
// shared/lib/feedbackPlan.ts
export type CueKind = 'success' | 'warning' | 'error' | 'retry';
export type HapticKind = 'success' | 'warning' | 'error' | 'light';
export function hapticFor(cue: CueKind): HapticKind;
export const MUTE_KEY = 'bh.gate.muted';
// shared/platform/feedback.ts
export type Feedback = {
  load(): Promise<void>;
  cue(kind: CueKind): void;
  isMuted(): boolean;
  setMuted(muted: boolean): Promise<void>;
  release(): void;
};
export function createFeedback(deps?: { kv?: KeyValue }): Feedback;
```

`CueKind` matches the gate's `Cue` string-for-string. The gate passes its `Cue` straight through (a string literal union is structurally compatible), so `shared` never imports from the feature.

The sounds are short sine tones generated in-repo, so there is no licence question. If the owner later supplies designed sounds, swap the files and keep the names.

- [ ] **Step 1: Install the native modules**

Run: `npx expo install expo-audio expo-haptics`
Expected: both added to `package.json` at SDK 57 versions.

- [ ] **Step 2: Write the sound generator and generate the files**

`scripts/gen-gate-sounds.mjs`:

```js
// Generates the four gate cue sounds as 16-bit mono PCM WAV. Deterministic; no third-party audio.
import { mkdirSync, writeFileSync } from 'node:fs';

const RATE = 22050;

function tone(segments) {
  const samples = [];
  for (const { hz, ms, gain = 0.6 } of segments) {
    const n = Math.round((RATE * ms) / 1000);
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / (RATE * 0.005), (n - i) / (RATE * 0.02)); // 5 ms in, 20 ms out
      samples.push(hz === 0 ? 0 : Math.sin((2 * Math.PI * hz * i) / RATE) * gain * env);
    }
  }
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(s * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

mkdirSync('assets/sounds', { recursive: true });
const out = {
  'gate-success': [
    { hz: 880, ms: 90 },
    { hz: 1320, ms: 140 },
  ],
  'gate-warning': [
    { hz: 660, ms: 120 },
    { hz: 0, ms: 60 },
    { hz: 660, ms: 120 },
  ],
  'gate-error': [{ hz: 220, ms: 420, gain: 0.7 }],
  'gate-retry': [{ hz: 520, ms: 110, gain: 0.45 }],
};
for (const [name, segs] of Object.entries(out)) {
  writeFileSync(`assets/sounds/${name}.wav`, tone(segs));
}
```

Run: `node scripts/gen-gate-sounds.mjs && ls -la assets/sounds`
Expected: four `.wav` files, each under 25 KB.

Append to `docs/ASSET_LICENSES.md`:

```markdown
## Gate sounds

`assets/sounds/gate-{success,warning,error,retry}.wav` — sine tones generated by `scripts/gen-gate-sounds.mjs` in this repo. No third-party material.
```

- [ ] **Step 3: Write the failing tests**

`src/shared/lib/__tests__/feedbackPlan.test.ts`:

```ts
import { hapticFor } from '@/shared/lib/feedbackPlan';

it('maps each cue to a distinct haptic', () => {
  expect(hapticFor('success')).toBe('success');
  expect(hapticFor('warning')).toBe('warning');
  expect(hapticFor('error')).toBe('error');
  expect(hapticFor('retry')).toBe('light');
});
```

`src/shared/platform/__tests__/feedback.test.ts`:

```ts
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { memoryKv } from '@/shared/lib/kv';
import { createFeedback } from '@/shared/platform/feedback';

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => ({
    seekTo: jest.fn(() => Promise.resolve()),
    play: jest.fn(),
    remove: jest.fn(),
  })),
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

type MockPlayer = { play: jest.Mock; seekTo: jest.Mock; remove: jest.Mock };
const players = () =>
  (createAudioPlayer as jest.Mock).mock.results.map((r: { value: MockPlayer }) => r.value);

beforeEach(() => {
  jest.clearAllMocks();
});

it('respects silent mode and preloads four sounds', async () => {
  const f = createFeedback({ kv: memoryKv() });
  await f.load();
  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }),
  );
  expect(createAudioPlayer).toHaveBeenCalledTimes(4);
});

it('plays the sound from the start and fires the haptic', async () => {
  const f = createFeedback({ kv: memoryKv() });
  await f.load();
  f.cue('error');
  const p = players()[2];
  expect(p?.seekTo).toHaveBeenCalledWith(0);
  expect(p?.play).toHaveBeenCalled();
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
});

it('mute silences sound but keeps haptics, and persists', async () => {
  const kv = memoryKv();
  const f = createFeedback({ kv });
  await f.load();
  await f.setMuted(true);
  f.cue('success');
  expect(players()[0]?.play).not.toHaveBeenCalled();
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  const g = createFeedback({ kv });
  await g.load();
  expect(g.isMuted()).toBe(true);
});

it('retry uses a light impact', async () => {
  const f = createFeedback({ kv: memoryKv() });
  await f.load();
  f.cue('retry');
  expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
});
```

- [ ] **Step 4: Run them and confirm they fail**

Run: `npx jest src/shared/lib/__tests__/feedbackPlan.test.ts src/shared/platform/__tests__/feedback.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 5: Implement**

`src/shared/lib/feedbackPlan.ts`:

```ts
export type CueKind = 'success' | 'warning' | 'error' | 'retry';
export type HapticKind = 'success' | 'warning' | 'error' | 'light';

export const MUTE_KEY = 'bh.gate.muted';

export function hapticFor(cue: CueKind): HapticKind {
  switch (cue) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    case 'retry':
      return 'light';
  }
}
```

`src/shared/platform/feedback.ts`:

```ts
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import { hapticFor, MUTE_KEY, type CueKind, type HapticKind } from '@/shared/lib/feedbackPlan';
import type { KeyValue } from '@/shared/lib/kv';

import { plainKv } from './storage';

const SOURCES: Record<CueKind, number> = {
  success: require('../../../assets/sounds/gate-success.wav') as number,
  warning: require('../../../assets/sounds/gate-warning.wav') as number,
  error: require('../../../assets/sounds/gate-error.wav') as number,
  retry: require('../../../assets/sounds/gate-retry.wav') as number,
};
const ORDER: CueKind[] = ['success', 'warning', 'error', 'retry'];

function haptic(kind: HapticKind): Promise<void> {
  switch (kind) {
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'warning':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case 'error':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    case 'light':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export type Feedback = {
  load(): Promise<void>;
  cue(kind: CueKind): void;
  isMuted(): boolean;
  setMuted(muted: boolean): Promise<void>;
  release(): void;
};

// iOS haptics can be silent while the camera runs — colour + icon + text + sound carry the result.
export function createFeedback(deps: { kv?: KeyValue } = {}): Feedback {
  const kv = deps.kv ?? plainKv;
  const players = new Map<CueKind, AudioPlayer>();
  let muted = false;

  return {
    async load() {
      try {
        muted = (await kv.get(MUTE_KEY)) === '1';
      } catch {
        muted = false;
      }
      await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
      for (const k of ORDER) if (!players.has(k)) players.set(k, createAudioPlayer(SOURCES[k]));
    },
    cue(kind) {
      void haptic(hapticFor(kind)).catch(() => undefined);
      if (muted) return;
      const p = players.get(kind);
      if (!p) return;
      void p.seekTo(0).catch(() => undefined);
      p.play();
    },
    isMuted: () => muted,
    async setMuted(next) {
      muted = next;
      await kv.set(MUTE_KEY, next ? '1' : '0');
    },
    release() {
      for (const p of players.values()) p.remove();
      players.clear();
    },
  };
}
```

`require(...) as number` is how RN types static assets. If the lint hook rejects the `as` (the rule targets domain/lib, and this is platform), use `const SOURCES: Record<CueKind, number> = { success: require('…') }` without the cast, adding `// eslint-disable-next-line @typescript-eslint/no-require-imports` only if lint demands it. If `@typescript-eslint/no-unsafe-assignment` fires on `require`, keep the narrowest disable on those four lines and say so in the commit message. Before writing, check for an existing pattern with `grep -rn "require(" src`.

- [ ] **Step 6: Run the tests, typecheck and lint**

Run: `npx jest src/shared && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/gen-gate-sounds.mjs assets/sounds src/shared/lib/feedbackPlan.ts src/shared/lib/__tests__/feedbackPlan.test.ts src/shared/platform/feedback.ts src/shared/platform/__tests__/feedback.test.ts docs/ASSET_LICENSES.md package.json package-lock.json
git commit -m "feat(shared): gate sound and haptic cues with persisted mute"
```

---

### Task 10: Scan API, session composition, React glue

**Files:**

- Create: `src/features/gate/api/scan.ts`, `src/features/gate/api/keys.ts`
- Create: `src/features/gate/domain/scanSession.ts`
- Create: `src/features/gate/state/scanView.ts`
- Create: `src/features/gate/hooks/useScanSession.ts`, `src/features/gate/hooks/useScanSummary.ts`
- Test: `src/features/gate/api/__tests__/scan.test.ts`, `src/features/gate/domain/__tests__/scanSession.test.ts`

**Interfaces:**

- Consumes: Tasks 1–6 and 9; `api` and `clock` from `@/shared/api/instance`; `ApiClient`.
- Produces:

```ts
// api/scan.ts
export const SCAN_TIMEOUT_MS = 8_000;
type Requester = Pick<ApiClient, 'request'>;
export function submitScan(
  client: Requester,
  eventId: string,
  code: TicketCode,
): Promise<ScanResponse>;
export function fetchSummary(
  client: Requester,
  eventId: string,
): Promise<Result<ScanSummary, ApiError>>;
// api/keys.ts
export const gateKeys: {
  events: (userId: string) => readonly ['gate', 'events', string];
  summary: (eventId: string) => readonly ['gate', 'summary', string];
};
// domain/scanSession.ts
export type OverlayView = {
  id: number;
  code: TicketCode | null;
  outcome: ScanOutcome;
  extraAdmitted: number;
};
export type SessionView = { current: OverlayView | null; waiting: number; pending: number };
export type ScanSessionDeps = Omit<ScanQueueDeps, 'onResult'> & {
  onChange: (v: SessionView) => void;
  onCue: (cue: Cue) => void;
  onAdmitted: () => void;
  onNotAssigned: () => void;
};
export function createScanSession(deps: ScanSessionDeps): {
  scan(raw: string, source: 'camera' | 'manual'): void;
  tryAgain(): void; // resubmits the current overlay's code (manual) and dismisses it
  dismiss(): void;
  tick(): void;
  nextDeadline(): number | null;
  reset(): void;
  view(): SessionView;
};
// state/scanView.ts
export const useScanView: UseBoundStore<
  StoreApi<{ view: SessionView; set: (v: SessionView) => void }>
>;
// hooks/useScanSession.ts
export function useScanSession(
  eventId: string,
  opts: { onNotAssigned: () => void },
): { session: ScanSession; muted: boolean; toggleMute: () => void };
// hooks/useScanSummary.ts
export function useScanSummary(
  eventId: string,
  focused: boolean,
): { summary: ScanSummary | null; stale: boolean };
```

- [ ] **Step 1: Write the failing API test**

```ts
import { submitScan, fetchSummary, SCAN_TIMEOUT_MS } from '@/features/gate/api/scan';
import { parseTicketCode } from '@/features/gate/domain/parseTicketCode';
import { ok } from '@/shared/lib/result';

const EVENT = '11111111-1111-4111-8111-111111111111';

it('posts the code with an 8 s timeout and no retry flag', async () => {
  const request = jest.fn(() => Promise.resolve(ok({})));
  const code = parseTicketCode('3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f');
  if (!code) throw new Error('fixture');
  await submitScan({ request }, EVENT, code.value);
  expect(request).toHaveBeenCalledWith(
    `/api/events/${EVENT}/scan`,
    expect.objectContaining({
      method: 'POST',
      body: { ticket_id: code.value },
      timeoutMs: SCAN_TIMEOUT_MS,
    }),
  );
  const opts = (request.mock.calls[0] as unknown[])[1];
  expect(opts).not.toHaveProperty('idempotent');
});

it('gets the summary', async () => {
  const request = jest.fn(() => Promise.resolve(ok({})));
  await fetchSummary({ request }, EVENT);
  expect(request).toHaveBeenCalledWith(
    `/api/events/${EVENT}/scan/summary`,
    expect.objectContaining({ schema: expect.anything() }),
  );
});
```

- [ ] **Step 2: Implement `api/scan.ts` and `api/keys.ts`**

```ts
import type { ScanResponse } from '@/features/gate/domain/outcome';
import type { TicketCode } from '@/features/gate/domain/parseTicketCode';
import { admitBody, summaryBody, type ScanSummary } from '@/features/gate/schemas/scan';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

export const SCAN_TIMEOUT_MS = 8_000;

type Requester = Pick<ApiClient, 'request'>;

// Not idempotent on the server: never pass `idempotent: true`. The scan queue owns retries.
export function submitScan(
  client: Requester,
  eventId: string,
  code: TicketCode,
): Promise<ScanResponse> {
  return client.request(`/api/events/${encodeURIComponent(eventId)}/scan`, {
    method: 'POST',
    body: { ticket_id: code },
    schema: admitBody,
    timeoutMs: SCAN_TIMEOUT_MS,
  });
}

export function fetchSummary(
  client: Requester,
  eventId: string,
): Promise<Result<ScanSummary, ApiError>> {
  return client.request(`/api/events/${encodeURIComponent(eventId)}/scan/summary`, {
    schema: summaryBody,
  });
}
```

```ts
export const gateKeys = {
  events: (userId: string) => ['gate', 'events', userId] as const,
  summary: (eventId: string) => ['gate', 'summary', eventId] as const,
};
```

If `request: jest.fn(() => Promise.resolve(ok({})))` fails to typecheck against `Requester`, type the mock as `jest.fn<ReturnType<ApiClient['request']>, Parameters<ApiClient['request']>>()`. Do not loosen `Requester`.

Run: `npx jest src/features/gate/api`
Expected: PASS.

- [ ] **Step 3: Write the failing session test**

```ts
import type { ScanResponse } from '@/features/gate/domain/outcome';
import { createScanSession, type SessionView } from '@/features/gate/domain/scanSession';
import { fx } from '@/features/gate/schemas/__fixtures__/scan';
import { admitBody } from '@/features/gate/schemas/scan';
import { errorFromResponse } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

const U1 = '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const flush = () => new Promise<void>((r) => setImmediate(r));

function harness(responses: ScanResponse[]) {
  let t = 0;
  const views: SessionView[] = [];
  const cues: string[] = [];
  const onAdmitted = jest.fn();
  const onNotAssigned = jest.fn();
  const submit = jest.fn(() => {
    const r = responses.shift();
    return r ? Promise.resolve(r) : Promise.reject(new Error('no response'));
  });
  const s = createScanSession({
    submit,
    now: () => t,
    random: () => 0,
    sleep: () => Promise.resolve(),
    maxRetries: 0,
    onChange: (v) => views.push(v),
    onCue: (c) => cues.push(c),
    onAdmitted,
    onNotAssigned,
  });
  return { s, submit, views, cues, onAdmitted, onNotAssigned, at: (ms: number) => (t = ms) };
}

describe('scan session', () => {
  it('a non-ticket QR is refused locally without a request', async () => {
    const h = harness([]);
    h.s.scan('WIFI:S:cafe;;', 'camera');
    await flush();
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.s.view().current?.outcome).toEqual({
      kind: 'refused',
      reason: 'notTicket',
      fixable: false,
    });
    expect(h.cues).toEqual(['error']);
  });

  it('the same junk QR seen repeatedly by the camera refuses once per 2 s', async () => {
    const h = harness([]);
    h.s.scan('junk', 'camera');
    h.s.dismiss();
    h.s.scan('junk', 'camera');
    expect(h.s.view().current).toBeNull();
    h.at(2001);
    h.s.scan('junk', 'camera');
    expect(h.s.view().current).not.toBeNull();
  });

  it('admission shows the overlay, cues success and reports for summary refresh', async () => {
    const h = harness([ok(admitBody.parse(fx.admitted.body))]);
    h.s.scan(U1, 'camera');
    expect(h.s.view().pending).toBe(1);
    await flush();
    expect(h.s.view()).toMatchObject({ pending: 0, current: { outcome: { kind: 'admitted' } } });
    expect(h.cues).toEqual(['success']);
    expect(h.onAdmitted).toHaveBeenCalledTimes(1);
  });

  it('cues fire when an overlay appears, not when it is queued', async () => {
    const h = harness([
      err(errorFromResponse(404, fx.notFound.body, { get: () => null })),
      ok(admitBody.parse(fx.admitted.body)),
    ]);
    h.s.scan(U1, 'camera');
    h.s.scan('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', 'camera');
    await flush();
    expect(h.cues).toEqual(['error']);
    h.s.dismiss();
    expect(h.cues).toEqual(['error', 'success']);
  });

  it('try again resubmits the held code even inside the cooldown', async () => {
    const h = harness([err({ kind: 'timeout' }), ok(admitBody.parse(fx.admitted.body))]);
    h.s.scan(U1, 'camera');
    await flush();
    expect(h.s.view().current?.outcome.kind).toBe('couldntCheck');
    h.s.tryAgain();
    await flush();
    expect(h.submit).toHaveBeenCalledTimes(2);
    expect(h.s.view().current?.outcome.kind).toBe('admitted');
  });

  it('a 403 tells the screen to leave', async () => {
    const h = harness([err(errorFromResponse(403, fx.forbidden.body, { get: () => null }))]);
    h.s.scan(U1, 'camera');
    await flush();
    expect(h.onNotAssigned).toHaveBeenCalledTimes(1);
  });

  it('tick advances a timed overlay', async () => {
    const h = harness([ok(admitBody.parse(fx.admitted.body))]);
    h.s.scan(U1, 'camera');
    await flush();
    h.at(1600);
    h.s.tick();
    expect(h.s.view().current).toBeNull();
  });
});
```

- [ ] **Step 4: Run it and confirm it fails**

Run: `npx jest src/features/gate/domain/__tests__/scanSession.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 5: Implement `domain/scanSession.ts`**

```ts
import type { ScanOutcome } from './outcome';
import { refusedLocally } from './outcome';
import { createOverlayQueue } from './overlayQueue';
import { parseTicketCode, type TicketCode } from './parseTicketCode';
import { present, type Cue } from './present';
import { createScanQueue, type ScanQueueDeps } from './scanQueue';

export type OverlayView = {
  id: number;
  code: TicketCode | null;
  outcome: ScanOutcome;
  extraAdmitted: number;
};
export type SessionView = { current: OverlayView | null; waiting: number; pending: number };

export type ScanSessionDeps = Omit<ScanQueueDeps, 'onResult'> & {
  onChange: (v: SessionView) => void;
  onCue: (cue: Cue) => void;
  onAdmitted: () => void;
  onNotAssigned: () => void;
};

const JUNK_COOLDOWN_MS = 2_000;

// Phase 2 swaps `submit` for roster + outbox; nothing else here changes.
export function createScanSession(deps: ScanSessionDeps) {
  const overlays = createOverlayQueue({ now: deps.now });
  const junkUntil = new Map<string, number>();
  let shownId: number | null = null;

  const queue = createScanQueue({
    ...deps,
    onResult: (code, outcome) => {
      overlays.push(code, outcome);
      if (outcome.kind === 'admitted') deps.onAdmitted();
      if (outcome.kind === 'refused' && outcome.reason === 'notAssigned') deps.onNotAssigned();
      publish();
    },
  });

  function view(): SessionView {
    const c = overlays.current();
    return {
      current:
        c === null
          ? null
          : { id: c.id, code: c.code, outcome: c.outcome, extraAdmitted: c.extraAdmitted },
      waiting: overlays.waitingCount(),
      pending: queue.pendingCount(),
    };
  }

  function publish() {
    const c = overlays.current();
    if (c !== null && c.id !== shownId) deps.onCue(present(c.outcome, deps.now()).cue);
    shownId = c?.id ?? null;
    deps.onChange(view());
  }

  return {
    scan(raw: string, source: 'camera' | 'manual') {
      const parsed = parseTicketCode(raw);
      if (parsed === null) {
        if (source === 'camera') {
          const now = deps.now();
          const until = junkUntil.get(raw);
          if (until !== undefined && now < until) return;
          if (junkUntil.size > 200) junkUntil.clear();
          junkUntil.set(raw, now + JUNK_COOLDOWN_MS);
        }
        overlays.push(null, refusedLocally);
        publish();
        return;
      }
      queue.enqueue(parsed.value, { manual: source === 'manual' });
      publish();
    },
    tryAgain() {
      const c = overlays.current();
      overlays.dismiss();
      if (c?.code != null) queue.enqueue(c.code, { manual: true });
      publish();
    },
    dismiss() {
      overlays.dismiss();
      publish();
    },
    tick() {
      if (overlays.tick()) publish();
    },
    nextDeadline: () => overlays.nextDeadline(),
    reset() {
      queue.reset();
      overlays.clear();
      junkUntil.clear();
      shownId = null;
      deps.onChange(view());
    },
    view,
  };
}

export type ScanSession = ReturnType<typeof createScanSession>;
```

Run: `npx jest src/features/gate/domain/__tests__/scanSession.test.ts`
Expected: PASS.

- [ ] **Step 6: Implement the React glue** (exercised by the screen tests in Tasks 12–13)

`src/features/gate/state/scanView.ts`:

```ts
import { create } from 'zustand';

import type { SessionView } from '@/features/gate/domain/scanSession';

const EMPTY: SessionView = { current: null, waiting: 0, pending: 0 };

// Only the overlay and the "checking…" chip subscribe; the camera never re-renders on a result.
export const useScanView = create<{ view: SessionView; set: (v: SessionView) => void }>((set) => ({
  view: EMPTY,
  set: (view) => {
    set({ view });
  },
}));
```

`src/features/gate/hooks/useScanSession.ts`:

```ts
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { gateKeys } from '@/features/gate/api/keys';
import { submitScan } from '@/features/gate/api/scan';
import { createScanSession, type ScanSession } from '@/features/gate/domain/scanSession';
import { useScanView } from '@/features/gate/state/scanView';
import { api, clock } from '@/shared/api/instance';
import { createFeedback } from '@/shared/platform/feedback';

// One Feedback instance per scanner screen: it plays the cues and owns the mute preference.
export function useScanSession(
  eventId: string,
  opts: { onNotAssigned: () => void },
): { session: ScanSession; muted: boolean; toggleMute: () => void } {
  const qc = useQueryClient();
  const setView = useScanView((s) => s.set);
  const notAssigned = useRef(opts.onNotAssigned);
  notAssigned.current = opts.onNotAssigned;
  const [feedback] = useState(createFeedback);
  const [session] = useState(() =>
    createScanSession({
      submit: (code) => submitScan(api, eventId, code),
      now: () => clock.serverNow(),
      random: Math.random,
      sleep: (ms) => new Promise<void>((r) => setTimeout(r, ms)),
      onChange: setView,
      onCue: (cue) => {
        feedback.cue(cue);
      },
      onAdmitted: () => {
        void qc.invalidateQueries({ queryKey: gateKeys.summary(eventId) });
      },
      onNotAssigned: () => {
        notAssigned.current();
      },
    }),
  );

  const [muted, setMuted] = useState(false);
  useEffect(() => {
    let live = true;
    void feedback.load().then(() => {
      if (live) setMuted(feedback.isMuted());
    });
    return () => {
      live = false;
      feedback.release();
    };
  }, [feedback]);
  const toggleMute = useCallback(() => {
    const next = !feedback.isMuted();
    setMuted(next);
    void feedback.setMuted(next);
  }, [feedback]);

  // Timed overlays advance on their own deadline; no polling interval.
  const currentId = useScanView((s) => s.view.current?.id ?? null);
  useEffect(() => {
    const deadline = session.nextDeadline();
    if (deadline === null) return;
    const t = setTimeout(
      () => {
        session.tick();
      },
      Math.max(0, deadline - clock.serverNow()),
    );
    return () => {
      clearTimeout(t);
    };
  }, [session, currentId]);

  useEffect(
    () => () => {
      session.reset();
    },
    [session],
  );

  return { session, muted, toggleMute };
}
```

The scanner route is keyed by `eventId` (Task 13), so a new event mounts a new session. Settled memory then lasts for as long as that screen stays mounted. That includes re-sign-in, because sign-out is reached from the event list, not from this screen.

`src/features/gate/hooks/useScanSummary.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { gateKeys } from '@/features/gate/api/keys';
import { fetchSummary } from '@/features/gate/api/scan';
import type { ScanSummary } from '@/features/gate/schemas/scan';
import { api } from '@/shared/api/instance';

export function useScanSummary(
  eventId: string,
  focused: boolean,
): { summary: ScanSummary | null; stale: boolean } {
  const q = useQuery({
    queryKey: gateKeys.summary(eventId),
    queryFn: async () => {
      const r = await fetchSummary(api, eventId);
      if (!r.ok) throw r.error;
      return r.value;
    },
    refetchInterval: focused ? 15_000 : false,
    staleTime: 0,
  });
  return { summary: q.data ?? null, stale: q.isError && q.data !== undefined };
}
```

`throw r.error` throws a plain `ApiError` object. `shouldRetryQuery` already classifies by `kind`. If lint flags `@typescript-eslint/only-throw-error`, wrap it the same way `ModeLoadError` does in `useModeState.ts` (a small `class SummaryError extends Error { kind }`) instead of disabling the rule.

- [ ] **Step 7: Run everything**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/gate/api src/features/gate/domain/scanSession.ts src/features/gate/domain/__tests__/scanSession.test.ts src/features/gate/state src/features/gate/hooks/useScanSession.ts src/features/gate/hooks/useScanSummary.ts
git commit -m "feat(gate): scan session wiring the queue, overlays and cues to the API"
```

---

### Task 11: Event list screen and `/gate` route

**Files:**

- Create: `src/features/gate/screens/EventListScreen.tsx`
- Create: `src/features/gate/hooks/useScannableEvents.ts`, `src/features/gate/hooks/useLastEvent.ts`
- Create: `src/app/(gate)/gate/index.tsx`
- Delete: `src/app/(gate)/gate.tsx`, `src/features/gate/screens/GateShell.tsx`
- Test: `src/features/gate/screens/__tests__/EventListScreen.test.tsx`

**Interfaces:**

- Consumes: `groupEvents`, `pickAutoOpen`, `eventLabel` (Task 8); `loadScannableEvents`, `scannerDb` (Task 7); `gateKeys` (Task 10); `ModeSwitcher`, `useModeSwitcher`, `useAuth` (route file only, since route files may import any feature).
- Produces:

```ts
type EventListProps = {
  state:
    { status: 'loading' } | { status: 'error' } | { status: 'ready'; events: ScannableEvent[] };
  nowMs: number;
  lastEventId: string | null;
  identity: string;
  refreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onOpen: (eventId: string) => void;
  onSignOut: () => void;
  header?: ReactNode; // mode switcher
};
export function EventListScreen(p: EventListProps): JSX.Element;
export function useScannableEvents(userId: string | null): {
  state: EventListProps['state'];
  refreshing: boolean;
  refresh: () => void;
};
export function useLastEvent(userId: string | null): {
  lastEventId: string | null;
  loaded: boolean;
  remember: (id: string) => void;
};
```

Auto-open fires once per mount, after both the list and the stored id have loaded. Returning to the list via "Change event" does not re-open, because the list stays mounted beneath the scanner.

- [ ] **Step 1: Write the failing screen test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { EventListScreen } from '@/features/gate/screens/EventListScreen';
import type { ScannableEvent } from '@/shared/api/scannableEvents';

const NOW = Date.parse('2026-10-05T12:00:00.000Z');
const ev = (id: string, title: string | null, startsAt: string | null): ScannableEvent => ({
  id,
  title,
  startsAt,
  location: 'Lagos',
});
const base = {
  nowMs: NOW,
  lastEventId: null,
  identity: 'gate@example.com',
  refreshing: false,
  onRefresh: jest.fn(),
  onRetry: jest.fn(),
  onOpen: jest.fn(),
  onSignOut: jest.fn(),
};

it('empty: tells staff to ask the organiser and offers sign out', async () => {
  const onSignOut = jest.fn();
  await render(
    <EventListScreen {...base} onSignOut={onSignOut} state={{ status: 'ready', events: [] }} />,
  );
  expect(screen.getByText('No events assigned — ask the organiser.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(onSignOut).toHaveBeenCalled();
});

it('auto-opens the last event once when it is still listed', async () => {
  const onOpen = jest.fn();
  const events = [ev('a', 'Afro Night', '2026-10-06T18:00:00Z')];
  const { rerender } = await render(
    <EventListScreen
      {...base}
      onOpen={onOpen}
      lastEventId="a"
      state={{ status: 'ready', events }}
    />,
  );
  expect(onOpen).toHaveBeenCalledWith('a');
  await rerender(
    <EventListScreen
      {...base}
      onOpen={onOpen}
      lastEventId="a"
      state={{ status: 'ready', events }}
    />,
  );
  expect(onOpen).toHaveBeenCalledTimes(1);
});

it('does not auto-open an event that is no longer listed', async () => {
  const onOpen = jest.fn();
  await render(
    <EventListScreen
      {...base}
      onOpen={onOpen}
      lastEventId="gone"
      state={{ status: 'ready', events: [ev('a', 'Afro Night', null)] }}
    />,
  );
  expect(onOpen).not.toHaveBeenCalled();
});

it('lists upcoming events, hides past ones under Earlier, and labels hidden listings', async () => {
  const onOpen = jest.fn();
  await render(
    <EventListScreen
      {...base}
      onOpen={onOpen}
      state={{
        status: 'ready',
        events: [
          ev('11111111-2222-4333-8444-555555555555', null, null),
          ev('old', 'Last month', '2026-09-01T18:00:00Z'),
        ],
      }}
    />,
  );
  expect(screen.getByText('Event · 11111111')).toBeTruthy();
  expect(screen.queryByText('Last month')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Earlier (1)' }));
  await fireEvent.press(screen.getByRole('button', { name: /Last month/ }));
  expect(onOpen).toHaveBeenCalledWith('old');
});

it('error state offers retry and never says there are no events', async () => {
  const onRetry = jest.fn();
  await render(<EventListScreen {...base} onRetry={onRetry} state={{ status: 'error' }} />);
  expect(screen.queryByText(/No events assigned/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(onRetry).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/features/gate/screens`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `EventListScreen.tsx`**

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { eventLabel, groupEvents, pickAutoOpen } from '@/features/gate/domain/eventList';
import type { ScannableEvent } from '@/shared/api/scannableEvents';
import { color, density, radius, space } from '@/shared/theme';
import { Button, Text } from '@/shared/ui';

type State =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; events: ScannableEvent[] };

type Props = {
  state: State;
  nowMs: number;
  lastEventId: string | null;
  identity: string;
  refreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onOpen: (eventId: string) => void;
  onSignOut: () => void;
  header?: ReactNode;
};

function when(iso: string | null): string {
  if (iso === null) return 'Date to be confirmed';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'Date to be confirmed';
  return new Date(t).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Row({ e, onOpen }: { e: ScannableEvent; onOpen: (id: string) => void }) {
  const label = eventLabel(e);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${when(e.startsAt)}`}
      onPress={() => {
        onOpen(e.id);
      }}
      style={({ pressed }) => ({
        minHeight: density.gate.rowMin,
        padding: space.s5,
        borderRadius: radius.r3,
        borderWidth: 1,
        borderColor: color.border,
        backgroundColor: pressed ? color.wash : color.surface,
        gap: space.s2,
      })}
    >
      <Text variant="bodyStrong" numberOfLines={2}>
        {label}
      </Text>
      <Text variant="bodySm" tone="textSecondary">
        {when(e.startsAt)}
        {e.location ? ` · ${e.location}` : ''}
      </Text>
    </Pressable>
  );
}

export function EventListScreen(p: Props) {
  const [showEarlier, setShowEarlier] = useState(false);
  const autoOpened = useRef(false);
  const events = p.state.status === 'ready' ? p.state.events : null;
  const { onOpen, lastEventId } = p;

  useEffect(() => {
    if (autoOpened.current || events === null) return;
    autoOpened.current = true;
    const id = pickAutoOpen(events, lastEventId);
    if (id !== null) onOpen(id);
  }, [events, lastEventId, onOpen]);

  let body: ReactNode;
  if (p.state.status === 'loading') {
    body = <ActivityIndicator color={color.actionFill} accessibilityLabel="Loading events" />;
  } else if (p.state.status === 'error') {
    body = (
      <View style={{ gap: space.s4 }}>
        <Text variant="body">We couldn't load your events. Check your connection.</Text>
        <Button label="Try again" onPress={p.onRetry} />
      </View>
    );
  } else if (p.state.events.length === 0) {
    body = <Text variant="body">No events assigned — ask the organiser.</Text>;
  } else {
    const g = groupEvents(p.state.events, p.nowMs);
    body = (
      <View style={{ gap: space.s4 }}>
        {g.upcoming.map((e) => (
          <Row key={e.id} e={e} onOpen={p.onOpen} />
        ))}
        {g.earlier.length > 0 ? (
          <>
            <Button
              variant="secondary"
              label={`Earlier (${String(g.earlier.length)})`}
              onPress={() => {
                setShowEarlier((v) => !v);
              }}
            />
            {showEarlier ? g.earlier.map((e) => <Row key={e.id} e={e} onOpen={p.onOpen} />) : null}
          </>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.canvas }}>
      <ScrollView
        contentContainerStyle={{ padding: space.s5, gap: space.s6 }}
        refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} />}
      >
        <View style={{ gap: space.s2 }}>
          <Text variant="titleLg" accessibilityRole="header">
            Your events
          </Text>
          <Text variant="bodySm" tone="textMuted">
            {p.identity}
          </Text>
        </View>
        {p.header}
        {body}
        <Button variant="secondary" label="Sign out" onPress={p.onSignOut} />
      </ScrollView>
    </SafeAreaView>
  );
}
```

The list is a `ScrollView`, not a `FlatList`: a scanner has a handful of events. If perf-auditor disagrees for > 50 rows, switch to `FlatList` then.

- [ ] **Step 4: Implement the hooks**

`src/features/gate/hooks/useScannableEvents.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { gateKeys } from '@/features/gate/api/keys';
import { loadScannableEvents, type ScannableEvent } from '@/shared/api/scannableEvents';
import { scannerDb } from '@/shared/supabase/scannerDb';

type State =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; events: ScannableEvent[] };

export function useScannableEvents(userId: string | null) {
  const q = useQuery({
    queryKey: gateKeys.events(userId ?? ''),
    enabled: userId !== null,
    queryFn: async () => {
      const r = await loadScannableEvents(scannerDb, userId ?? '');
      if (!r.ok) throw r.error;
      return r.value;
    },
  });
  let state: State = { status: 'loading' };
  if (q.data !== undefined) state = { status: 'ready', events: q.data };
  else if (q.isError) state = { status: 'error' };
  return {
    state,
    refreshing: q.isRefetching,
    refresh: () => {
      void q.refetch();
    },
  };
}
```

(Apply the same `only-throw-error` note as `useScanSummary`.)

`src/features/gate/hooks/useLastEvent.ts`:

```ts
import { useEffect, useState } from 'react';

import { plainKv } from '@/shared/platform/storage';

const key = (userId: string) => `bh.gate.lastEvent.${userId}`;

export function useLastEvent(userId: string | null) {
  const [state, setState] = useState<{ id: string | null; loaded: boolean }>({
    id: null,
    loaded: false,
  });
  useEffect(() => {
    if (userId === null) return;
    let live = true;
    plainKv
      .get(key(userId))
      .catch(() => null)
      .then((id) => {
        if (live) setState({ id, loaded: true });
      });
    return () => {
      live = false;
    };
  }, [userId]);
  return {
    lastEventId: state.id,
    loaded: state.loaded,
    remember: (id: string) => {
      if (userId !== null) void plainKv.set(key(userId), id).catch(() => undefined);
    },
  };
}
```

- [ ] **Step 5: Implement the route and remove the Phase 0 placeholder**

`src/app/(gate)/gate/index.tsx`:

```tsx
import { router } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLastEvent } from '@/features/gate/hooks/useLastEvent';
import { useScannableEvents } from '@/features/gate/hooks/useScannableEvents';
import { EventListScreen } from '@/features/gate/screens/EventListScreen';
import { useModeSwitcher } from '@/features/mode/hooks/useModeSwitcher';
import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';

export default function GateEventsRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useAuth((s) => s.signOut);
  const userId = state.status === 'signedIn' ? state.userId : null;
  const { modes, choose } = useModeSwitcher(userId);
  const events = useScannableEvents(userId);
  const last = useLastEvent(userId);
  const { remember } = last;

  const open = useCallback(
    (eventId: string) => {
      remember(eventId);
      router.push({ pathname: '/gate/[eventId]', params: { eventId } });
    },
    [remember],
  );

  return (
    <EventListScreen
      state={last.loaded ? events.state : { status: 'loading' }}
      nowMs={Date.now()}
      lastEventId={last.lastEventId}
      identity={state.status === 'signedIn' ? state.email : ''}
      refreshing={events.refreshing}
      onRefresh={events.refresh}
      onRetry={events.refresh}
      onOpen={open}
      onSignOut={() => {
        void signOut();
      }}
      header={<ModeSwitcher modes={modes} current="gate" onChoose={choose} />}
    />
  );
}
```

`remember` must be stable for the `useCallback`. If it is not (it is rebuilt each render in `useLastEvent`), wrap it in `useCallback` inside `useLastEvent` keyed on `userId`. `EventListScreen` only auto-opens once per mount, so a changing `onOpen` cannot cause a second open, but keep it stable anyway.

Delete the placeholder: `git rm "src/app/(gate)/gate.tsx" src/features/gate/screens/GateShell.tsx`. Then run `grep -rn GateShell src` and expect no hits. `useRouteStore.ts` keeps `gate: '/gate'`, which now resolves to `gate/index.tsx`.

- [ ] **Step 6: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS. tsc only accepts the typed href `/gate/[eventId]` once Task 13 creates `[eventId].tsx`. If typed routes reject it now, add a minimal `src/app/(gate)/gate/[eventId].tsx` that renders `null`; Task 13 replaces it.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(gate)/gate" src/features/gate/screens/EventListScreen.tsx src/features/gate/screens/__tests__/EventListScreen.test.tsx src/features/gate/hooks/useScannableEvents.ts src/features/gate/hooks/useLastEvent.ts
git rm --cached -q "src/app/(gate)/gate.tsx" src/features/gate/screens/GateShell.tsx 2>/dev/null || true
git commit -m "feat(gate): assigned-events list with auto-open of the last event"
```

---

### Task 12: Outcome overlay, Enter code sheet, Recent sheet

**Files:**

- Create: `src/features/gate/ui/OutcomeOverlay.tsx`
- Create: `src/features/gate/ui/EnterCodeSheet.tsx`
- Create: `src/features/gate/ui/RecentSheet.tsx`
- Test: `src/features/gate/ui/__tests__/OutcomeOverlay.test.tsx`, `EnterCodeSheet.test.tsx`, `RecentSheet.test.tsx`

**Interfaces:**

- Consumes: `OverlayView` (Task 10), `present` (Task 4), `parseTicketCode` (Task 1), `ScanSummary` (Task 2), `color.outcome`, `Icon`, `Text`, `Button`.
- Produces:

```ts
export function OutcomeOverlay(p: {
  view: OverlayView;
  nowMs: number;
  onDismiss: () => void;
  onTryAgain: () => void;
  onSignIn: () => void;
}): JSX.Element;
export function EnterCodeSheet(p: {
  visible: boolean;
  onSubmit: (raw: string) => void;
  onClose: () => void;
}): JSX.Element;
export function RecentSheet(p: {
  visible: boolean;
  recent: ScanSummary['recent'] | null;
  onClose: () => void;
}): JSX.Element;
```

The overlay is a full-screen solid fill: large icon, one-word title, detail, optional "+N admitted" chip and an action button. It has no animation. It is announced with `accessibilityLiveRegion="assertive"` and `accessibilityRole="alert"`. Timed overlays can be tapped away (`onDismiss`). The sheets are React Native `Modal`s (`presentationStyle="pageSheet"`, `animationType="slide"`) so state stays in the scanner screen.

- [ ] **Step 1: Write the failing tests**

`OutcomeOverlay.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { OverlayView } from '@/features/gate/domain/scanSession';
import { OutcomeOverlay } from '@/features/gate/ui/OutcomeOverlay';
import { color } from '@/shared/theme';

const NOW = Date.parse('2026-10-05T18:05:00.000Z');
const view = (outcome: OverlayView['outcome'], extraAdmitted = 0): OverlayView => ({
  id: 1,
  code: null,
  outcome,
  extraAdmitted,
});
const handlers = { onDismiss: jest.fn(), onTryAgain: jest.fn(), onSignIn: jest.fn() };
const fill = () => screen.getByTestId('outcome-overlay').props.style as { backgroundColor: string };

it.each([
  [
    {
      kind: 'admitted',
      ticketType: 'Regular',
      ticketIndex: 1,
      totalTickets: 1,
      checkedInCount: 1,
      checkedInAt: null,
    },
    'Admitted',
    color.outcome.admitted.bg,
  ],
  [
    {
      kind: 'used',
      checkedInAt: null,
      scannedBy: { kind: 'anotherScanner' },
      ticketType: null,
      replayed: false,
    },
    'Already used',
    color.outcome.used.bg,
  ],
  [{ kind: 'refused', reason: 'wrongEvent', fixable: false }, 'Refused', color.outcome.refused.bg],
  [{ kind: 'refused', reason: 'expired', fixable: true }, 'Refused', color.outcome.used.bg],
  [{ kind: 'couldntCheck', cause: 'network' }, "Couldn't check", color.outcome.retry.bg],
] as const)('%o renders title, icon and fill', async (outcome, title, bg) => {
  await render(<OutcomeOverlay view={view(outcome)} nowMs={NOW} {...handlers} />);
  expect(screen.getByText(title)).toBeTruthy();
  expect(screen.getByTestId(`outcome-icon-${title}`)).toBeTruthy();
  expect(fill().backgroundColor).toBe(bg);
});

it("couldn't check is never red", async () => {
  await render(
    <OutcomeOverlay
      view={view({ kind: 'couldntCheck', cause: 'rateLimited' })}
      nowMs={NOW}
      {...handlers}
    />,
  );
  expect(fill().backgroundColor).not.toBe(color.outcome.refused.bg);
});

it('try again and sign in call back; refusals have Done', async () => {
  const onTryAgain = jest.fn();
  const onSignIn = jest.fn();
  const onDismiss = jest.fn();
  const { rerender } = await render(
    <OutcomeOverlay
      view={view({ kind: 'couldntCheck', cause: 'timeout' })}
      nowMs={NOW}
      onDismiss={onDismiss}
      onTryAgain={onTryAgain}
      onSignIn={onSignIn}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(onTryAgain).toHaveBeenCalled();
  await rerender(
    <OutcomeOverlay
      view={view({ kind: 'couldntCheck', cause: 'auth' })}
      nowMs={NOW}
      onDismiss={onDismiss}
      onTryAgain={onTryAgain}
      onSignIn={onSignIn}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in again' }));
  expect(onSignIn).toHaveBeenCalled();
  await rerender(
    <OutcomeOverlay
      view={view({ kind: 'refused', reason: 'notFound', fixable: false })}
      nowMs={NOW}
      onDismiss={onDismiss}
      onTryAgain={onTryAgain}
      onSignIn={onSignIn}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(onDismiss).toHaveBeenCalled();
});

it('shows the +N admitted chip', async () => {
  await render(
    <OutcomeOverlay
      view={view({ kind: 'refused', reason: 'notFound', fixable: false }, 4)}
      nowMs={NOW}
      {...handlers}
    />,
  );
  expect(screen.getByText('+4 admitted')).toBeTruthy();
});
```

`EnterCodeSheet.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { EnterCodeSheet } from '@/features/gate/ui/EnterCodeSheet';

it('rejects input that is not a ticket inline, without submitting', async () => {
  const onSubmit = jest.fn();
  await render(<EnterCodeSheet visible onSubmit={onSubmit} onClose={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('Ticket code or link'), 'hello');
  await fireEvent.press(screen.getByRole('button', { name: 'Check ticket' }));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText('That is not a Bookhushly ticket code or link.')).toBeTruthy();
});

it('submits a pasted link', async () => {
  const onSubmit = jest.fn();
  const link = 'https://bookhushly.com/t/3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
  await render(<EnterCodeSheet visible onSubmit={onSubmit} onClose={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('Ticket code or link'), link);
  await fireEvent.press(screen.getByRole('button', { name: 'Check ticket' }));
  expect(onSubmit).toHaveBeenCalledWith(link);
});
```

`RecentSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';

import { RecentSheet } from '@/features/gate/ui/RecentSheet';

it('marks admissions made on this account', async () => {
  await render(
    <RecentSheet
      visible
      onClose={jest.fn()}
      recent={[
        {
          id: 'a',
          ticket_type: 'VIP',
          checked_in_at: '2026-10-05T18:04:00.000Z',
          scanned_by_me: true,
        },
        {
          id: 'b',
          ticket_type: null,
          checked_in_at: '2026-10-05T18:01:00.000Z',
          scanned_by_me: false,
        },
      ]}
    />,
  );
  expect(screen.getByText('VIP')).toBeTruthy();
  expect(screen.getAllByText('By me')).toHaveLength(1);
});

it('says when nothing has been admitted yet', async () => {
  await render(<RecentSheet visible onClose={jest.fn()} recent={[]} />);
  expect(screen.getByText('No admissions yet.')).toBeTruthy();
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx jest src/features/gate/ui`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `OutcomeOverlay.tsx`**

```tsx
import { CircleAlert, CircleCheck, CircleX, RotateCw } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { OverlayView } from '@/features/gate/domain/scanSession';
import { present, type Tone } from '@/features/gate/domain/present';
import { color, density, radius, space } from '@/shared/theme';
import { Text } from '@/shared/ui';

const GLYPH = {
  admitted: CircleCheck,
  used: CircleAlert,
  refused: CircleX,
  retry: RotateCw,
} as const;

type Props = {
  view: OverlayView;
  nowMs: number;
  onDismiss: () => void;
  onTryAgain: () => void;
  onSignIn: () => void;
};

function Action({ label, fg, onPress }: { label: string; fg: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: density.gate.controlHeight,
        borderRadius: radius.r3,
        borderWidth: 2,
        borderColor: fg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: space.s7,
      }}
    >
      <Text variant="headline" style={{ color: fg }}>
        {label}
      </Text>
    </Pressable>
  );
}

// Solid D9 fills, no entrance animation (MOTION.md: no Lottie on gate outcomes).
export function OutcomeOverlay({ view, nowMs, onDismiss, onTryAgain, onSignIn }: Props) {
  const p = present(view.outcome, nowMs);
  const tone: Tone = p.tone;
  const { bg, fg } = color.outcome[tone];
  const Glyph = GLYPH[tone];
  return (
    <Pressable
      testID="outcome-overlay"
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`${p.title}. ${p.detail}`}
      onPress={p.holdMs === null ? undefined : onDismiss}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: bg,
        padding: space.s7,
        justifyContent: 'center',
        gap: space.s6,
      }}
    >
      <View testID={`outcome-icon-${p.title}`}>
        <Glyph size={96} color={fg} strokeWidth={2} />
      </View>
      <Text variant="display" style={{ color: fg }}>
        {p.title}
      </Text>
      {p.detail !== '' ? (
        <Text variant="titleLg" style={{ color: fg }}>
          {p.detail}
        </Text>
      ) : null}
      {p.secondary !== null ? (
        <Text variant="headline" style={{ color: fg }}>
          {p.secondary}
        </Text>
      ) : null}
      {view.extraAdmitted > 0 ? (
        <Text variant="label" style={{ color: fg }}>
          {`+${String(view.extraAdmitted)} admitted`}
        </Text>
      ) : null}
      {p.action === 'tryAgain' ? <Action label="Try again" fg={fg} onPress={onTryAgain} /> : null}
      {p.action === 'signIn' ? <Action label="Sign in again" fg={fg} onPress={onSignIn} /> : null}
      {p.action === 'done' ? <Action label="Done" fg={fg} onPress={onDismiss} /> : null}
      {p.action === 'tryAgain' || p.action === 'signIn' ? (
        <Action label="Dismiss" fg={fg} onPress={onDismiss} />
      ) : null}
    </Pressable>
  );
}
```

The overlay uses lucide glyphs directly at 96 px because `Icon` caps size at 32. If the owner prefers, add `96` to `Icon`'s size union in `src/shared/ui/Icon.tsx` and use `<Icon as={Glyph} size={96} color={fg} />`. Do that rather than add a second icon path if ux-design-reviewer asks. `style={{ color: fg }}` on `Text` overrides the tone. Check that `Text` merges `style` last (it passes `style` in an array after the base). If the hook rejects inline colour in styles, add `onOutcome` to `ColorRole` instead.

- [ ] **Step 4: Implement `EnterCodeSheet.tsx`**

```tsx
import { useState } from 'react';
import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseTicketCode } from '@/features/gate/domain/parseTicketCode';
import { color, space } from '@/shared/theme';
import { Button, Input, Text } from '@/shared/ui';

type Props = { visible: boolean; onSubmit: (raw: string) => void; onClose: () => void };

export function EnterCodeSheet({ visible, onSubmit, onClose }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    if (parseTicketCode(value) === null) {
      setError('That is not a Bookhushly ticket code or link.');
      return;
    }
    onSubmit(value);
    setValue('');
    setError(null);
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }}>
        <View style={{ padding: space.s5, gap: space.s5 }}>
          <Text variant="title" accessibilityRole="header">
            Enter code
          </Text>
          <Input
            label="Ticket code or link"
            value={value}
            onChangeText={(t) => {
              setValue(t);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            error={error ?? undefined}
          />
          <Button label="Check ticket" onPress={submit} />
          <Button variant="secondary" label="Cancel" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
```

Before writing this, read `src/shared/ui/Input.tsx` and use its actual prop names (`label`, `error`, `onChangeText`, …). The test finds the field by `getByLabelText('Ticket code or link')`, so the label must be the accessibility label.

- [ ] **Step 5: Implement `RecentSheet.tsx`**

```tsx
import { FlatList, Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ScanSummary } from '@/features/gate/schemas/scan';
import { color, density, space } from '@/shared/theme';
import { Button, Text } from '@/shared/ui';

type Props = { visible: boolean; recent: ScanSummary['recent'] | null; onClose: () => void };

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t)
    ? new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';
};

export function RecentSheet({ visible, recent, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }}>
        <View style={{ padding: space.s5, gap: space.s4, flex: 1 }}>
          <Text variant="title" accessibilityRole="header">
            Recent admissions
          </Text>
          {recent === null ? (
            <Text variant="body" tone="textMuted">
              Not loaded yet.
            </Text>
          ) : recent.length === 0 ? (
            <Text variant="body">No admissions yet.</Text>
          ) : (
            <FlatList
              data={recent}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => (
                <View
                  style={{
                    minHeight: density.work.rowMin,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottomWidth: 1,
                    borderBottomColor: color.border,
                  }}
                >
                  <View style={{ gap: space.s1 }}>
                    <Text variant="bodyStrong">{item.ticket_type ?? 'Ticket'}</Text>
                    <Text variant="bodySm" tone="textSecondary" tabular>
                      {time(item.checked_in_at)}
                    </Text>
                  </View>
                  {item.scanned_by_me ? (
                    <Text variant="labelSm" tone="linkText">
                      By me
                    </Text>
                  ) : null}
                </View>
              )}
            />
          )}
          <Button variant="secondary" label="Close" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
```

- [ ] **Step 6: Run the tests, typecheck and lint**

Run: `npx jest src/features/gate/ui && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/gate/ui
git commit -m "feat(gate): outcome overlay, enter-code and recent sheets"
```

---

### Task 13: Scanner screen and `/gate/[eventId]` route

**Precondition:** this task edits `app.json`, which holds uncommitted Sentry-wizard changes. Ask the owner whether to keep, commit separately, or discard those changes. Then commit only the expo-camera plugin edit here.

**Files:**

- Modify: `app.json` (expo-camera plugin)
- Modify: `package.json` / `package-lock.json` via `npx expo install expo-camera expo-keep-awake`
- Create: `src/features/gate/ui/ScannerCamera.tsx` (thin adapter, mocked in tests)
- Create: `src/features/gate/screens/ScannerScreen.tsx`
- Create: `src/app/(gate)/gate/[eventId].tsx`
- Test: `src/features/gate/screens/__tests__/ScannerScreen.test.tsx`

**Interfaces:**

- Consumes: `useScanSession`, `useScanSummary`, `useScanView` (Task 10); `OutcomeOverlay`, `EnterCodeSheet`, `RecentSheet` (Task 12).
- Produces:

```ts
// ui/ScannerCamera.tsx
export type CameraPermission = 'unknown' | 'granted' | 'denied';
export function useCameraAccess(): {
  permission: CameraPermission;
  canAsk: boolean;
  request: () => void;
};
export function ScannerCamera(p: { torch: boolean; onCode: (raw: string) => void }): JSX.Element;
// screens/ScannerScreen.tsx
type ScannerProps = {
  title: string;
  summary: ScanSummary | null;
  summaryStale: boolean;
  focused: boolean;
  permission: CameraPermission;
  canAskPermission: boolean;
  onRequestPermission: () => void;
  onOpenSettings: () => void;
  muted: boolean;
  onToggleMute: () => void;
  session: Pick<ScanSession, 'scan' | 'tryAgain' | 'dismiss'>;
  onSignIn: () => void;
  onChangeEvent: () => void;
};
export function ScannerScreen(p: ScannerProps): JSX.Element;
```

API facts (verified for SDK 57 on 2026-10-05):

- `CameraView` from `expo-camera`: `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}`, `onBarcodeScanned={(r) => r.data}`, `enableTorch`, `active` (iOS only).
- `useCameraPermissions()` returns `[permission | null, request, get]`, where `permission` has `granted` and `canAskAgain`.
- Unmount the camera when the screen is unfocused (`useIsFocused` from `expo-router`).
- `useKeepAwake()` from `expo-keep-awake`.
- `Linking.openSettings()` from `react-native`.
- Do not use `launchScanner()`.
- The callback fires continuously; the scan session's cooldowns absorb that.

- [ ] **Step 1: Install and configure**

Run: `npx expo install expo-camera expo-keep-awake`

In `app.json` → `expo.plugins`, add:

```json
[
  "expo-camera",
  {
    "cameraPermission": "Bookhushly uses the camera to scan tickets at the door.",
    "recordAudioAndroid": false
  }
]
```

Do not set `microphonePermission`. Then run `npx expo config --type introspect | grep -i -E "RECORD_AUDIO|NSMicrophone"` and expect no output. If something prints, add `"microphonePermission": false` and check again.

- [ ] **Step 2: Write the camera adapter**

`src/features/gate/ui/ScannerCamera.tsx`:

```tsx
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';

export type CameraPermission = 'unknown' | 'granted' | 'denied';

export function useCameraAccess() {
  const [perm, request] = useCameraPermissions();
  const permission: CameraPermission =
    perm === null ? 'unknown' : perm.granted ? 'granted' : 'denied';
  return {
    permission,
    canAsk: perm?.canAskAgain ?? true,
    request: () => {
      void request();
    },
  };
}

type Props = { torch: boolean; onCode: (raw: string) => void };

// Mounted only while the screen is focused (the parent unmounts it on blur).
export function ScannerCamera({ torch, onCode }: Props) {
  return (
    <CameraView
      style={{ flex: 1 }}
      facing="back"
      enableTorch={torch}
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={(r: BarcodeScanningResult) => {
        onCode(r.data);
      }}
    />
  );
}
```

- [ ] **Step 3: Write the failing screen test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ScannerScreen } from '@/features/gate/screens/ScannerScreen';
import { useScanView } from '@/features/gate/state/scanView';

jest.mock('@/features/gate/ui/ScannerCamera', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ScannerCamera: ({ onCode }: { onCode: (raw: string) => void }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="fake-camera"
        onPress={() => {
          onCode('3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f');
        }}
      >
        <Text>camera</Text>
      </Pressable>
    ),
  };
});
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

const session = { scan: jest.fn(), tryAgain: jest.fn(), dismiss: jest.fn() };
const base = {
  title: 'Afro Night',
  summary: { admitted: 41, total: 120, recent: [] },
  summaryStale: false,
  focused: true,
  permission: 'granted' as const,
  canAskPermission: true,
  onRequestPermission: jest.fn(),
  onOpenSettings: jest.fn(),
  muted: false,
  onToggleMute: jest.fn(),
  session,
  onSignIn: jest.fn(),
  onChangeEvent: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  useScanView.setState({ view: { current: null, waiting: 0, pending: 0 } });
});

it('shows the door counter and passes camera reads to the session', async () => {
  await render(<ScannerScreen {...base} />);
  expect(screen.getByText('41 / 120')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'fake-camera' }));
  expect(session.scan).toHaveBeenCalledWith('3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f', 'camera');
});

it('shows a dash before the first summary', async () => {
  await render(<ScannerScreen {...base} summary={null} />);
  expect(screen.getByText('— / —')).toBeTruthy();
});

it('permission denied: explains, offers settings, and manual entry still works', async () => {
  const onOpenSettings = jest.fn();
  await render(
    <ScannerScreen
      {...base}
      permission="denied"
      canAskPermission={false}
      onOpenSettings={onOpenSettings}
    />,
  );
  expect(screen.queryByRole('button', { name: 'fake-camera' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));
  expect(onOpenSettings).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Enter code' })).toBeTruthy();
});

it('unmounts the camera when the screen is not focused', async () => {
  await render(<ScannerScreen {...base} focused={false} />);
  expect(screen.queryByRole('button', { name: 'fake-camera' })).toBeNull();
});

it('renders the current overlay over the camera', async () => {
  useScanView.setState({
    view: {
      current: {
        id: 1,
        code: null,
        outcome: { kind: 'couldntCheck', cause: 'network' },
        extraAdmitted: 0,
      },
      waiting: 0,
      pending: 0,
    },
  });
  await render(<ScannerScreen {...base} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(session.tryAgain).toHaveBeenCalled();
});

it('has no undo control anywhere', async () => {
  await render(<ScannerScreen {...base} />);
  expect(screen.queryByText(/undo|un-admit/i)).toBeNull();
});
```

- [ ] **Step 4: Run it and confirm it fails**

Run: `npx jest src/features/gate/screens/__tests__/ScannerScreen.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 5: Implement `ScannerScreen.tsx`**

```tsx
import { useKeepAwake } from 'expo-keep-awake';
import { Flashlight, Keyboard, ListChecks, Volume2, VolumeX } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ScanSession } from '@/features/gate/domain/scanSession';
import type { ScanSummary } from '@/features/gate/schemas/scan';
import { useScanView } from '@/features/gate/state/scanView';
import { EnterCodeSheet } from '@/features/gate/ui/EnterCodeSheet';
import { OutcomeOverlay } from '@/features/gate/ui/OutcomeOverlay';
import { RecentSheet } from '@/features/gate/ui/RecentSheet';
import { ScannerCamera, type CameraPermission } from '@/features/gate/ui/ScannerCamera';
import { color, density, radius, space } from '@/shared/theme';
import { Button, Icon, Text } from '@/shared/ui';

type Props = {
  title: string;
  summary: ScanSummary | null;
  summaryStale: boolean;
  focused: boolean;
  permission: CameraPermission;
  canAskPermission: boolean;
  onRequestPermission: () => void;
  onOpenSettings: () => void;
  muted: boolean;
  onToggleMute: () => void;
  session: Pick<ScanSession, 'scan' | 'tryAgain' | 'dismiss'>;
  onSignIn: () => void;
  onChangeEvent: () => void;
};

function Control({
  label,
  glyph,
  onPress,
  selected,
}: {
  label: string;
  glyph: Parameters<typeof Icon>[0]['as'];
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: selected === true }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: density.gate.controlHeight,
        borderRadius: radius.r3,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.s2,
        backgroundColor: pressed || selected === true ? color.wash : color.surface,
        borderWidth: 1,
        borderColor: color.border,
      })}
    >
      <Icon as={glyph} color={color.textPrimary} />
      <Text variant="label">{label}</Text>
    </Pressable>
  );
}

function Overlay(p: Pick<Props, 'session' | 'onSignIn'>) {
  const current = useScanView((s) => s.view.current);
  if (current === null) return null;
  return (
    <OutcomeOverlay
      view={current}
      nowMs={Date.now()}
      onDismiss={p.session.dismiss}
      onTryAgain={p.session.tryAgain}
      onSignIn={p.onSignIn}
    />
  );
}

function Checking() {
  const pending = useScanView((s) => s.view.pending);
  if (pending === 0) return null;
  return (
    <Text variant="label" tone="onAction" accessibilityLiveRegion="polite">
      {`Checking ${String(pending)}…`}
    </Text>
  );
}

export function ScannerScreen(p: Props) {
  useKeepAwake();
  const [torch, setTorch] = useState(false);
  const [entering, setEntering] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const counter =
    p.summary === null ? '— / —' : `${String(p.summary.admitted)} / ${String(p.summary.total)}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.textPrimary }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.s4,
          padding: space.s4,
          backgroundColor: color.surface,
        }}
      >
        <View style={{ flex: 1, gap: space.s1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {p.title}
          </Text>
          <Pressable accessibilityRole="link" onPress={p.onChangeEvent} hitSlop={12}>
            <Text variant="labelSm" tone="linkText">
              Change event
            </Text>
          </Pressable>
        </View>
        <View accessibilityLabel={`Admitted ${counter}`}>
          <Text variant="num" tabular>
            {counter}
          </Text>
          {p.summaryStale ? (
            <Text variant="caption" tone="textMuted">
              not updated
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={p.muted ? 'Sound off' : 'Sound on'}
          onPress={p.onToggleMute}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon as={p.muted ? VolumeX : Volume2} color={color.textPrimary} />
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {p.permission === 'granted' && p.focused ? (
          <ScannerCamera
            torch={torch}
            onCode={(raw) => {
              p.session.scan(raw, 'camera');
            }}
          />
        ) : null}
        {p.permission === 'denied' ? (
          <View style={{ flex: 1, padding: space.s6, justifyContent: 'center', gap: space.s5 }}>
            <Text variant="title" tone="onAction">
              Camera access is off
            </Text>
            <Text variant="body" tone="onAction">
              Turn on camera access for Bookhushly to scan tickets. You can still enter codes by
              hand.
            </Text>
            {p.canAskPermission ? (
              <Button label="Allow camera" onPress={p.onRequestPermission} />
            ) : (
              <Button label="Open settings" onPress={p.onOpenSettings} />
            )}
          </View>
        ) : null}
        <View style={{ position: 'absolute', top: space.s4, left: space.s4 }}>
          <Checking />
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: space.s4,
          padding: space.s4,
          backgroundColor: color.surface,
        }}
      >
        <Control
          label="Torch"
          glyph={Flashlight}
          selected={torch}
          onPress={() => {
            setTorch((t) => !t);
          }}
        />
        <Control
          label="Enter code"
          glyph={Keyboard}
          onPress={() => {
            setEntering(true);
          }}
        />
        <Control
          label="Recent"
          glyph={ListChecks}
          onPress={() => {
            setShowRecent(true);
          }}
        />
      </View>

      <Overlay session={p.session} onSignIn={p.onSignIn} />

      <EnterCodeSheet
        visible={entering}
        onClose={() => {
          setEntering(false);
        }}
        onSubmit={(raw) => {
          setEntering(false);
          p.session.scan(raw, 'manual');
        }}
      />
      <RecentSheet
        visible={showRecent}
        recent={p.summary?.recent ?? null}
        onClose={() => {
          setShowRecent(false);
        }}
      />
    </SafeAreaView>
  );
}
```

Viewfinder brackets (static, no animation). Add this component to `ScannerScreen.tsx` and render `<Viewfinder />` right after `<ScannerCamera … />` inside the `permission === 'granted' && p.focused` branch, wrapping both in a fragment:

```tsx
const CORNER = 32;
const EDGE = 4;
const corners = [
  { top: 0, left: 0, borderTopWidth: EDGE, borderLeftWidth: EDGE },
  { top: 0, right: 0, borderTopWidth: EDGE, borderRightWidth: EDGE },
  { bottom: 0, left: 0, borderBottomWidth: EDGE, borderLeftWidth: EDGE },
  { bottom: 0, right: 0, borderBottomWidth: EDGE, borderRightWidth: EDGE },
] as const;

function Viewfinder() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: '70%', aspectRatio: 1 }}>
        {corners.map((c, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: CORNER,
              height: CORNER,
              borderColor: color.onAction,
              ...c,
            }}
          />
        ))}
      </View>
    </View>
  );
}
```

The background behind the camera is `color.textPrimary` (ink), so permission-card text uses `tone="onAction"` (white on ink, 17:1).

- [ ] **Step 6: Implement the route**

`src/app/(gate)/gate/[eventId].tsx`:

```tsx
import { useIsFocused, useLocalSearchParams, router } from 'expo-router';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import { z } from 'zod';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useScannableEvents } from '@/features/gate/hooks/useScannableEvents';
import { useScanSession } from '@/features/gate/hooks/useScanSession';
import { useScanSummary } from '@/features/gate/hooks/useScanSummary';
import { eventLabel } from '@/features/gate/domain/eventList';
import { ScannerScreen } from '@/features/gate/screens/ScannerScreen';
import { useCameraAccess } from '@/features/gate/ui/ScannerCamera';

const eventIdParam = z.uuid();

function Scanner({ eventId }: { eventId: string }) {
  const focused = useIsFocused();
  const auth = useAuth((s) => s.state);
  const signOut = useAuth((s) => s.signOut);
  const userId = auth.status === 'signedIn' ? auth.userId : null;
  const events = useScannableEvents(userId);
  const camera = useCameraAccess();
  const { summary, stale } = useScanSummary(eventId, focused);
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/gate');
  };
  const { session, muted, toggleMute } = useScanSession(eventId, { onNotAssigned: leave });

  const { permission, request } = camera;
  useEffect(() => {
    if (permission === 'unknown') request();
  }, [permission, request]);

  const listed = events.state.status === 'ready' ? events.state.events : [];
  const event = listed.find((e) => e.id === eventId);

  return (
    <ScannerScreen
      title={event ? eventLabel(event) : 'Scanning'}
      summary={summary}
      summaryStale={stale}
      focused={focused}
      permission={camera.permission}
      canAskPermission={camera.canAsk}
      onRequestPermission={camera.request}
      onOpenSettings={() => {
        void Linking.openSettings();
      }}
      muted={muted}
      onToggleMute={toggleMute}
      session={session}
      onSignIn={() => {
        void signOut();
      }}
      onChangeEvent={leave}
    />
  );
}

export default function GateScannerRoute() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const parsed = eventIdParam.safeParse(eventId);
  useEffect(() => {
    if (!parsed.success) router.replace('/gate');
  }, [parsed.success]);
  if (!parsed.success) return null;
  // Keyed so switching events mounts a fresh session (spec: reset on event switch).
  return <Scanner key={parsed.data} eventId={parsed.data} />;
}
```

"Sign in again" calls `signOut()`. The root navigator then routes to sign-in. After sign-in the same user returns to gate mode and the last event auto-opens. Settled memory is lost because the screen unmounted. That is acceptable: replays then come from the server as `already_checked_in`. Record this in the commit message as a known gap against spec §5 ("settled memory survives re-sign-in"). If the owner wants it kept, hoist the session into a module-level map keyed by `eventId` and clear it on sign-out.

`request` must be stable for the permission effect. Write it with `useCallback` in `useCameraAccess` (Step 2):

```tsx
const ask = useCallback(() => {
  void request();
}, [request]);
return { permission, canAsk: perm?.canAskAgain ?? true, request: ask };
```

(add `import { useCallback } from 'react';` to `ScannerCamera.tsx`).

- [ ] **Step 7: Run everything**

Run: `npx jest && npx tsc --noEmit && npx expo lint && npx prettier --check .`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(gate)/gate/[eventId].tsx" src/features/gate/screens/ScannerScreen.tsx src/features/gate/screens/__tests__/ScannerScreen.test.tsx src/features/gate/ui/ScannerCamera.tsx src/features/gate/hooks/useScanSession.ts package.json package-lock.json app.json
git commit -m "feat(gate): live scanner with camera, manual entry and door counter"
```

---

### Task 14: Verification, reviews, device run

**Files:** none new. Fixes go back into the owning task's files.

- [ ] **Step 1: Full gate**

Run: `npx tsc --noEmit && npx expo lint && npx prettier --check . && npx jest && npx expo-doctor`
Expected: all clean. Report any failure verbatim.

- [ ] **Step 2: Specialist reviews (run in parallel, read-only)**

Dispatch `rn-code-reviewer`, `offline-scan-reviewer`, `ux-design-reviewer`, `mobile-security-reviewer` and `perf-auditor` on `git diff main...HEAD`. Fix confirmed findings in their owning files, rerun Step 1 and commit each fix separately (`fix(gate): …`).

- [ ] **Step 3: Production read checks (needs the owner's test scanner account)**

On a dev build signed in as the test scanner:

1. The event list shows the test event. This proves the RLS embed and the vendor-link read work with Bearer.
2. If the owner can make the test listing private for a minute, it still appears as "Event · xxxxxxxx". This proves `rpc('is_listing_scanner')` works with Bearer.
3. The QA customer account shows no gate mode and no mode error.

Record the results in `docs/BACKEND_STATUS.md` §10 with the date.

- [ ] **Step 4: New EAS build**

Run: `npx eas-cli@latest build --profile preview --platform android` (the owner triggers it if credentials are needed). The new native modules are expo-camera, expo-audio, expo-haptics and expo-keep-awake.

- [ ] **Step 5: Device scenarios (Moto G06), requirements §11.2 scenarios 1–8**

Using the owner's test event (2–3 free tickets booked by the QA customer):

- Valid ticket → Admitted, green, "ticket n of m", counter increments.
- Same ticket again → Already used, "on this phone"/"by you".
- Ticket for another event → Refused, "different event".
- Random QR → Refused, "Not a Bookhushly ticket", no network call.
- Airplane mode → Couldn't check (neutral), Try again after reconnecting → Admitted or Already used by you.
- Camera permission denied → card + Open settings; Enter code works.
- Scan 3 tickets quickly → each result shown in order, no lost result.
- Background and return → camera resumes; in-flight result shows.
- Outcome on screen < 100 ms after the response (Sentry span or a dev-only log of `latency`); no dropped frames on the idle camera; 10 minutes of continuous scanning without heat or memory growth.
- Confirm WAV playback on device. The SDK docs do not list WAV explicitly; if a sound is silent, convert it to `.m4a` and update `SOURCES`.
- Confirm Android scanning works with the network off (the docs don't say whether ML Kit is bundled).

- [ ] **Step 6: Clean-up**

Ask the owner to deactivate the test scanner and unpublish the test event. Confirm that no test data is left behind.

- [ ] **Step 7: Finish the branch**

Use superpowers:finishing-a-development-branch.
