# Phase 2a — Gate offline core loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the network drops at the door, the scanner decides on the phone from an encrypted, auto-downloaded roster, records every offline admission durably before showing it, and syncs it to the server when the connection returns.

**Architecture:** Online-first: the Phase 1 scan queue keeps calling the live scan route, and only falls back to a pure local decision (`decideOffline`) when the server can't be reached, or straight away while the connection is *degraded*. Storage is SQLCipher `expo-sqlite` behind a tiny `Sql` interface, so the real SQL runs under Jest on Node's built-in `node:sqlite`. A per-screen controller runs roster sync (resumable, delta + periodic full with a staging swap) and outbox batch sync in the foreground.

**Tech Stack:** Expo SDK 57, expo-sqlite (SQLCipher), expo-crypto, @noble/curves (Ed25519), expo-network, TanStack Query v5, Zustand v5, zod v4, Jest (jest-expo) + RNTL v14 (async).

**Spec:** `docs/superpowers/specs/2026-10-07-phase-2a-gate-offline-design.md` (read it with this plan). Contracts: `docs/BACKEND_STATUS.md` §2–§3 plus the corrections in Task 17.

## Global Constraints

- Branch `feat/phase-2a-gate-offline`. Commit only the paths a task lists (`git add <paths>`, never `-A`). **No `Co-Authored-By` trailer of any kind** (owner rule, enforced by `.githooks/commit-msg`).
- Install packages only with `npx expo install <pkg>`.
- TypeScript strict + `noUncheckedIndexedAccess`; ESLint `strictTypeChecked`: no `any`, no `@ts-ignore`, no non-null `!`, numbers in template literals go through `String()`, no floating promises (`void` them), `require-await` (an `async` function must `await`).
- `src/features/*/domain/**` and `src/shared/lib/**` must not import `react`, `react-native`, `expo`, `expo-*` or `@/shared/ui/*`. A feature must not import another feature (`@/features/<other>/*`); `src/app/**` route files may.
- No raw hex colours, no `fontWeight`, no `console.*` in `src/` (use `log` from `@/shared/lib/log`); colours/spacing from `@/shared/theme`; text through `Text` from `@/shared/ui`; touch targets ≥ 44 pt (`density.gate.minTarget`).
- No secrets in code. No PII, tokens or ticket codes in logs or Sentry (`captureException` from `@/shared/monitoring` already scrubs).
- Gate outcomes are only **Admitted / Already used / Refused (reason) / Couldn't check**. A transient failure (network, timeout, 5xx, 429) is never a refusal. No undo anywhere.
- **Write-ahead:** an offline admission's roster update and outbox row commit in one transaction *before* the outcome is returned.
- Roster stores **name + masked phone only** — exactly the fields the endpoint returns; never email or full phone.
- Copy is sentence case. Spec deviations decided while planning (keep them): a UUID that matches a roster `booking_id` reuses the existing `oldFormat` refusal copy ("Old ticket format — look this booking up by hand") to match the online `booking_qr`; revoked (`blocked`) items say "Not sent — you were removed from this event" (the spec's "the organiser has these on record" is untrue for items the server never accepted); the database is **per user** (`gate-<userId>.db`), so a session-expiry "Sign in again" keeps it and a different account never syncs someone else's admissions.
- Inside a `db.tx(async (t) => …)` callback use only `t`; the outer handle waits for the transaction and deadlocks.
- Test command: `npx jest <path>`; before each commit also `npx tsc --noEmit`. Before the final task: `npx expo lint` and the full `npx jest`.

## Review Focus

1. **Phone sleeps with the scanner open, then wakes** → the clock must not turn *suspect* (the monotonic clock pauses in deep sleep; the guard rebases when the app becomes active). Pinned in Task 3 (`rebase` test) and wired in Task 15.
2. **A 30-minute full refresh runs while staff keep scanning offline** → decisions keep using the old roster until the swap commits; local admissions made meanwhile survive the swap. Pinned in Task 8 (swap re-applies the outbox) and Task 12 (decide during staging).
3. **Sign out tapped while a batch is in flight (`sending`)** → counts as unsynced and blocks sign-out. Pinned in Task 9 (`totals` counts `sending`).
4. **Server timestamps with microseconds** (`…:00.123456+00:00`, what Postgres jsonb emits) in roster `checked_in_at` → "Already used at 18:04" still renders and the delta mark still parses. Pinned in Task 1 (`parseIsoMs`) and Task 5 (present test with a microsecond time).
5. **The same ticket presented twice at once offline** (printed UUID and its live BH2 code, concurrency 3) → exactly one admission and one outbox row; the other is *Already used — by you*. Pinned in Task 12 (race test).

---

## File map

| File | Responsibility |
|---|---|
| `src/shared/lib/base64url.ts` | strict canonical unpadded base64url (matches web `decodeExact`) |
| `src/shared/lib/isoTime.ts` | `parseIsoMs` tolerant of microsecond timestamps |
| `src/shared/lib/clock.ts` (modify) | persist last server contact with the offset |
| `src/shared/lib/clockGuard.ts` | suspect-clock detection |
| `src/shared/lib/connectivity.ts` | degraded/online tracker |
| `src/shared/lib/signOutGuard.ts` | registry so auth can ask gate "may I wipe?" without a cross-feature import |
| `src/shared/api/client.ts`, `instance.ts` (modify) | report reach to connectivity; export `connectivity`, `clockGuard` |
| `src/shared/db/sql.ts` | `Sql` interface + `migrate` |
| `src/shared/db/expoSql.ts` | SQLCipher open/delete via expo-sqlite |
| `src/shared/db/__tests__/nodeSql.ts` (+ `node-sqlite.d.ts`) | the same interface over `node:sqlite` for Jest |
| `src/features/gate/domain/bh2.ts` | BH2 parse + Ed25519 verify + step window |
| `src/features/gate/domain/offlineDecide.ts` | §4 decision table; `ticketIdOf` |
| `src/features/gate/domain/outcome.ts`, `present.ts` (modify) | offline outcome variants and copy |
| `src/features/gate/domain/ago.ts` | "4 min ago" wording |
| `src/features/gate/domain/syncReconcile.ts` | batch item → outbox state |
| `src/features/gate/domain/syncLine.ts` | sync bar + attention wording |
| `src/features/gate/domain/listExpiry.ts` | when a roster may be dropped |
| `src/features/gate/domain/scanQueue.ts` (modify) | `fallback`, `skipOnline`, `onLive` |
| `src/features/gate/schemas/roster.ts`, `batch.ts` | response schemas |
| `src/features/gate/api/roster.ts`, `batch.ts` | requests |
| `src/features/gate/offline/schema.ts` | migrations |
| `src/features/gate/offline/rosterStore.ts`, `outboxStore.ts` | SQL repositories |
| `src/features/gate/offline/rosterSync.ts`, `batchSync.ts` | sync algorithms |
| `src/features/gate/offline/offlineGate.ts` | decide + write-ahead + learn from live |
| `src/features/gate/offline/gateDb.ts` | per-user encrypted DB, key, wipe, sweep |
| `src/features/gate/offline/signOutGuard.ts` | registers the gate guard |
| `src/features/gate/offline/controller.ts` | timers, sync orchestration, status publishing |
| `src/features/gate/state/syncView.ts` | zustand store for the sync bar |
| `src/features/gate/hooks/useOfflineGate.ts` | React wiring of the controller |
| `src/features/gate/ui/SyncBar.tsx`, `AttentionSheet.tsx` | UI |
| `src/features/auth/domain/signOutPlan.ts`, `hooks/useSignOut.ts` | sign-out gating |

---

### Task 1: Base64url and ISO time helpers

**Files:**
- Create: `src/shared/lib/base64url.ts`, `src/shared/lib/isoTime.ts`
- Test: `src/shared/lib/__tests__/base64url.test.ts`, `src/shared/lib/__tests__/isoTime.test.ts`

**Interfaces:**
- Produces: `encodeBase64url(bytes: Uint8Array): string`; `decodeBase64url(text: string, length?: number): Uint8Array | null` (null unless canonical and, when given, exactly `length` bytes); `parseIsoMs(iso: string | null | undefined): number | null`.

- [ ] **Step 1: Write the failing tests**

`src/shared/lib/__tests__/base64url.test.ts`:
```ts
import { decodeBase64url, encodeBase64url } from '@/shared/lib/base64url';

const bytes = (...n: number[]) => new Uint8Array(n);
const UUID_BYTES = bytes(63, 37, 4, 224, 79, 137, 17, 211, 154, 12, 3, 5, 232, 44, 51, 1);

describe('base64url', () => {
  it('encodes without padding', () => {
    expect(encodeBase64url(bytes(251, 255))).toBe('-_8');
    expect(encodeBase64url(UUID_BYTES)).toBe('PyUE4E-JEdOaDAMF6CwzAQ');
  });
  it('round-trips every length remainder', () => {
    for (const b of [bytes(1), bytes(1, 2), bytes(1, 2, 3), bytes(255, 254, 253, 252)]) {
      expect(decodeBase64url(encodeBase64url(b))).toEqual(b);
    }
  });
  it('decodes to the exact length asked for', () => {
    expect(decodeBase64url('PyUE4E-JEdOaDAMF6CwzAQ', 16)).toEqual(UUID_BYTES);
    expect(decodeBase64url('PyUE4E-JEdOaDAMF6CwzAQ', 15)).toBeNull();
  });
  it('rejects padding, standard-alphabet characters and impossible lengths', () => {
    expect(decodeBase64url('-_8=')).toBeNull();
    expect(decodeBase64url('+/8')).toBeNull();
    expect(decodeBase64url('abcde')).toBeNull();
    expect(decodeBase64url('')).toBeNull();
  });
  it('rejects non-canonical spare bits (the web calls these malformed)', () => {
    expect(decodeBase64url('-_9')).toBeNull();
  });
});
```

`src/shared/lib/__tests__/isoTime.test.ts`:
```ts
import { parseIsoMs } from '@/shared/lib/isoTime';

describe('parseIsoMs', () => {
  it('parses Postgres jsonb timestamps with microseconds', () => {
    expect(parseIsoMs('2026-10-07T18:04:00.123456+00:00')).toBe(
      Date.parse('2026-10-07T18:04:00.123Z'),
    );
  });
  it('parses plain ISO strings', () => {
    expect(parseIsoMs('2026-10-07T18:04:00Z')).toBe(Date.parse('2026-10-07T18:04:00Z'));
  });
  it('returns null for missing or unparseable input', () => {
    expect(parseIsoMs(null)).toBeNull();
    expect(parseIsoMs(undefined)).toBeNull();
    expect(parseIsoMs('soon')).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest src/shared/lib/__tests__/base64url.test.ts src/shared/lib/__tests__/isoTime.test.ts`
Expected: FAIL — cannot find module `@/shared/lib/base64url` / `isoTime`.

- [ ] **Step 3: Implement**

`src/shared/lib/base64url.ts`:
```ts
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i] as const));
const CHARS = /^[A-Za-z0-9_-]+$/;

const at = (i: number) => ALPHABET.charAt(i & 63);

/** Unpadded base64url. */
export function encodeBase64url(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += at(n >> 18) + at(n >> 12) + at(n >> 6) + at(n);
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = (bytes[i] ?? 0) << 16;
    out += at(n >> 18) + at(n >> 12);
  } else if (rest === 2) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8);
    out += at(n >> 18) + at(n >> 12) + at(n >> 6);
  }
  return out;
}

/**
 * Strict unpadded base64url, like the web's decodeExact: null unless re-encoding gives the same
 * text (no padding, no spare bits) and, when `length` is given, exactly that many bytes.
 */
export function decodeBase64url(text: string, length?: number): Uint8Array | null {
  if (!CHARS.test(text) || text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 6) / 8));
  let buf = 0;
  let bits = 0;
  let j = 0;
  for (const c of text) {
    buf = (buf << 6) | (INDEX.get(c) ?? 0);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[j++] = (buf >> bits) & 255;
      buf &= (1 << bits) - 1;
    }
  }
  if (length !== undefined && out.length !== length) return null;
  return encodeBase64url(out) === text ? out : null;
}
```

`src/shared/lib/isoTime.ts`:
```ts
// Postgres jsonb timestamps carry microseconds ("…T18:04:00.123456+00:00"); trim to
// milliseconds before Date.parse so every JS engine reads them the same way.
const FRACTION = /(\.\d{3})\d+/;

export function parseIsoMs(iso: string | null | undefined): number | null {
  if (iso === null || iso === undefined) return null;
  const t = Date.parse(iso.replace(FRACTION, '$1'));
  return Number.isFinite(t) ? t : null;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx jest src/shared/lib/__tests__/base64url.test.ts src/shared/lib/__tests__/isoTime.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/base64url.ts src/shared/lib/isoTime.ts src/shared/lib/__tests__/base64url.test.ts src/shared/lib/__tests__/isoTime.test.ts
git commit -m "feat(gate): strict base64url and microsecond-safe ISO parsing"
```

---

### Task 2: BH2 code verification

**Files:**
- Modify: `package.json` (via `npx expo install @noble/curves`; then add `transformIgnorePatterns`)
- Create: `src/features/gate/domain/bh2.ts`
- Test: `src/features/gate/domain/__tests__/bh2Vector.ts` (shared fixture, not a test), `src/features/gate/domain/__tests__/bh2.test.ts`

**Interfaces:**
- Consumes: `decodeBase64url` (Task 1).
- Produces:
  - `type TicketKey = { kid: string; publicKey: string }` (publicKey = raw 32-byte Ed25519 key, base64url)
  - `parseBh2(token: string): { kid: string; ticketId: string; step: number; signature: Uint8Array; message: Uint8Array } | null`
  - `verifyBh2(token: string, keys: readonly TicketKey[]): { ok: true; ticketId: string; kid: string; step: number } | { ok: false; reason: 'malformed' | 'unknown_key' | 'bad_signature' }`
  - `stepAt(ms: number): number`; `stepInWindow(step: number, nowMs: number, tolerance?: number): boolean` (default ±1)
  - Fixture exports `BH2_PUB, BH2_AT, BH2_ID, BH2_TOKEN, BH2_KEYS`.

Facts (verified against web `lib/ticket-signing.js` on `origin/main` `c8fe25e8`): token `BH2.<kid>.<id>.<step>.<sig>`, kid `/^[a-z0-9]{1,8}$/`, id = 16 UUID bytes as 22-char canonical base64url, step = `floor(epochMs/30000)` in base36 (1–10 chars, no leading zeros — must round-trip), sig = 64 bytes as 86-char canonical base64url. **Signed message = UTF-8 `bh2:<kid>:<uuid lowercase dashed>:<step as a DECIMAL number>`.** Any published kid verifies regardless of its `signing` flag. The server uses OpenSSL Ed25519 (RFC 8032, strict); noble must use `{ zip215: false }`.

- [ ] **Step 1: Install noble and let Jest transform it**

Run: `npx expo install @noble/curves`
Then in `package.json` → `"jest"`, add (this is jest-expo's default list with `|@noble` appended — `@noble/*` is ESM-only):
```json
"transformIgnorePatterns": [
  "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@noble))",
  "/node_modules/react-native-reanimated/plugin/",
  "/node_modules/@react-native/babel-preset/"
]
```

- [ ] **Step 2: Add the fixture and the failing tests**

`src/features/gate/domain/__tests__/bh2Vector.ts` (generated 2026-10-07 with the web's own `signTicketTokenV2`, test-only seed `0x07` × 32 — not a production key):
```ts
import type { TicketKey } from '@/features/gate/domain/bh2';

export const BH2_PUB = '6kpsY-KcUgq-9VB7Ey7F-ZVHdq6-vnuSQh7qaRRG0iw';
export const BH2_AT = 1_700_000_000_000;
export const BH2_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
export const BH2_TOKEN =
  'BH2.t.PyUE4E-JEdOaDAMF6CwzAQ.xqka2.scN75wRuNrd4H0BDHL5n7_CtEpOIKFpryKIt24lKOBgrv5ZBmiOQJNQh8Mgm7CCYxyO0DbhkKTOKRvF0W3FwDw';
// The same token with one signature character flipped in the middle (web says bad_signature).
export const BH2_BAD_SIG =
  'BH2.t.PyUE4E-JEdOaDAMF6CwzAQ.xqka2.scN75wRuNrd4H0BDHL5n7_CtEpOIKFpryKIt24lKABgrv5ZBmiOQJNQh8Mgm7CCYxyO0DbhkKTOKRvF0W3FwDw';
export const BH2_KEYS: TicketKey[] = [{ kid: 't', publicKey: BH2_PUB }];
```

`src/features/gate/domain/__tests__/bh2.test.ts`:
```ts
import { parseBh2, stepAt, stepInWindow, verifyBh2 } from '@/features/gate/domain/bh2';

import { BH2_AT, BH2_BAD_SIG, BH2_ID, BH2_KEYS, BH2_TOKEN } from './bh2Vector';

const swapPart = (i: number, value: string) => {
  const p = BH2_TOKEN.split('.');
  p[i] = value;
  return p.join('.');
};

describe('BH2', () => {
  it('verifies the web-signed vector', () => {
    expect(verifyBh2(BH2_TOKEN, BH2_KEYS)).toEqual({
      ok: true,
      ticketId: BH2_ID,
      kid: 't',
      step: stepAt(BH2_AT),
    });
  });
  it('parses the ticket id without verifying', () => {
    expect(parseBh2(BH2_TOKEN)?.ticketId).toBe(BH2_ID);
  });
  it('a flipped signature byte is a bad signature', () => {
    expect(verifyBh2(BH2_BAD_SIG, BH2_KEYS)).toEqual({ ok: false, reason: 'bad_signature' });
  });
  it('a tampered ticket id or step is a bad signature', () => {
    expect(verifyBh2(swapPart(2, 'QyUE4E-JEdOaDAMF6CwzAQ'), BH2_KEYS)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
    expect(verifyBh2(swapPart(3, 'xqka3'), BH2_KEYS)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });
  it('an unpublished kid, or a broken published key, is unknown_key', () => {
    expect(verifyBh2(BH2_TOKEN, [])).toEqual({ ok: false, reason: 'unknown_key' });
    expect(verifyBh2(BH2_TOKEN, [{ kid: 'u', publicKey: BH2_KEYS[0]?.publicKey ?? '' }])).toEqual(
      { ok: false, reason: 'unknown_key' },
    );
    expect(verifyBh2(BH2_TOKEN, [{ kid: 't', publicKey: 'nope' }])).toEqual({
      ok: false,
      reason: 'unknown_key',
    });
  });
  it.each([
    ['wrong prefix', BH2_TOKEN.replace('BH2.', 'BH3.')],
    ['four parts', BH2_TOKEN.split('.').slice(0, 4).join('.')],
    ['uppercase kid', swapPart(1, 'T')],
    ['leading-zero step', swapPart(3, '0xqka2')],
    ['short id', swapPart(2, 'PyUE4E-JEdOaDAMF6CwzA')],
    ['non-canonical signature tail', BH2_TOKEN.slice(0, -1) + 'x'],
  ])('%s is malformed', (_name, token) => {
    expect(verifyBh2(token, BH2_KEYS)).toEqual({ ok: false, reason: 'malformed' });
  });
  it('accepts the current step ±1 and nothing wider', () => {
    const s = stepAt(BH2_AT);
    expect(stepInWindow(s, BH2_AT)).toBe(true);
    expect(stepInWindow(s, BH2_AT + 30_000)).toBe(true);
    expect(stepInWindow(s, BH2_AT - 30_000)).toBe(true);
    expect(stepInWindow(s, BH2_AT + 60_000)).toBe(false);
    expect(stepInWindow(s, BH2_AT - 60_000)).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx jest src/features/gate/domain/__tests__/bh2.test.ts`
Expected: FAIL — cannot find module `@/features/gate/domain/bh2`.

- [ ] **Step 4: Implement `src/features/gate/domain/bh2.ts`**

```ts
import { ed25519 } from '@noble/curves/ed25519.js';

import { decodeBase64url } from '@/shared/lib/base64url';

// Mirrors web lib/ticket-signing.js (verified 2026-10-07). The phone only verifies; it never signs.
export const BH2_STEP_MS = 30_000;

export type TicketKey = { kid: string; publicKey: string };

export type Bh2Parsed = {
  kid: string;
  ticketId: string;
  step: number;
  signature: Uint8Array;
  message: Uint8Array;
};

export type Bh2Check =
  | { ok: true; ticketId: string; kid: string; step: number }
  | { ok: false; reason: 'malformed' | 'unknown_key' | 'bad_signature' };

const KID_RE = /^[a-z0-9]{1,8}$/;
const STEP_RE = /^[0-9a-z]{1,10}$/;

function uuidOf(b: Uint8Array): string {
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function parseBh2(token: string): Bh2Parsed | null {
  const parts = token.trim().split('.');
  if (parts.length !== 5 || parts[0] !== 'BH2') return null;
  const [, kid = '', id = '', stepRaw = '', sigRaw = ''] = parts;
  const idBytes = decodeBase64url(id, 16);
  const signature = decodeBase64url(sigRaw, 64);
  if (!KID_RE.test(kid) || idBytes === null || signature === null || !STEP_RE.test(stepRaw)) {
    return null;
  }
  const step = parseInt(stepRaw, 36);
  // One signature, one spelling: "0xqka2" and "xqka2" are the same number.
  if (step.toString(36) !== stepRaw) return null;
  const ticketId = uuidOf(idBytes);
  // The signed step is the decimal number, not the base36 text in the token.
  const message = new TextEncoder().encode(`bh2:${kid}:${ticketId}:${String(step)}`);
  return { kid, ticketId, step, signature, message };
}

export function verifyBh2(token: string, keys: readonly TicketKey[]): Bh2Check {
  const p = parseBh2(token);
  if (p === null) return { ok: false, reason: 'malformed' };
  const key = keys.find((k) => k.kid === p.kid);
  const publicKey = key === undefined ? null : decodeBase64url(key.publicKey, 32);
  if (publicKey === null) return { ok: false, reason: 'unknown_key' };
  let valid = false;
  try {
    // zip215: false = strict RFC 8032, matching the server's OpenSSL verify.
    valid = ed25519.verify(p.signature, p.message, publicKey, { zip215: false });
  } catch {
    valid = false;
  }
  return valid
    ? { ok: true, ticketId: p.ticketId, kid: p.kid, step: p.step }
    : { ok: false, reason: 'bad_signature' };
}

export const stepAt = (ms: number): number => Math.floor(ms / BH2_STEP_MS);

export const stepInWindow = (step: number, nowMs: number, tolerance = 1): boolean =>
  Math.abs(stepAt(nowMs) - step) <= tolerance;
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx jest src/features/gate/domain/__tests__/bh2.test.ts`
Expected: PASS (13 tests). If the import fails with "Cannot use import statement outside a module", the `transformIgnorePatterns` edit is missing or misspelt.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/features/gate/domain/bh2.ts src/features/gate/domain/__tests__/bh2.test.ts src/features/gate/domain/__tests__/bh2Vector.ts
git commit -m "feat(gate): verify BH2 ticket codes with Ed25519 on the phone"
```
(`package-lock.json` is changed by `npx expo install`; the edit-guard hook only blocks hand edits to it.)

---

### Task 3: Clock contact time and clock guard

**Files:**
- Modify: `src/shared/lib/clock.ts`
- Create: `src/shared/lib/clockGuard.ts`
- Test: `src/shared/lib/__tests__/clock.test.ts` (add cases), `src/shared/lib/__tests__/clockGuard.test.ts`

**Interfaces:**
- Produces: `Clock.lastContactMs(): number | null` (server ms of the last `Date` header recorded). `createClockGuard(deps: { wallNow: () => number; monoNow: () => number; serverNow: () => number; lastContactMs: () => number | null; maxJumpMs?: number })` → `{ state(): ClockState; rebase(): void }`; `type ClockState = { suspect: boolean; checkedAgoMs: number | null }`.

- [ ] **Step 1: Add failing clock tests** (append inside the existing `describe` in `clock.test.ts`, reusing its `DEVICE_NOW` constant):

```ts
  it('remembers when the server was last heard from, across reloads', async () => {
    const kv = memoryKv();
    const clock = createClock({ storage: kv, now: () => DEVICE_NOW });
    clock.recordServerDate('Wed, 07 Oct 2026 12:00:00 GMT');
    await Promise.resolve();
    expect(clock.lastContactMs()).toBe(Date.parse('Wed, 07 Oct 2026 12:00:00 GMT'));
    const reloaded = createClock({ storage: kv, now: () => DEVICE_NOW });
    await reloaded.load();
    expect(reloaded.lastContactMs()).toBe(Date.parse('Wed, 07 Oct 2026 12:00:00 GMT'));
    expect(reloaded.offsetMs()).toBe(clock.offsetMs());
  });

  it('loads an offset saved by Phase 1 (a bare number) with no contact time', async () => {
    const kv = memoryKv();
    await kv.set('bh.clock.offset', '1500');
    const clock = createClock({ storage: kv, now: () => DEVICE_NOW });
    await clock.load();
    expect(clock.offsetMs()).toBe(1500);
    expect(clock.lastContactMs()).toBeNull();
  });
```
If an existing test asserts the stored value equals `String(offset)`, change it to `JSON.stringify({ o: <offset>, c: <server ms> })`.

`src/shared/lib/__tests__/clockGuard.test.ts`:
```ts
import { createClockGuard } from '@/shared/lib/clockGuard';

function rig() {
  let wall = Date.parse('2026-10-07T18:00:00Z');
  let mono = 0;
  let contact: number | null = wall;
  const guard = createClockGuard({
    wallNow: () => wall,
    monoNow: () => mono,
    serverNow: () => wall,
    lastContactMs: () => contact,
  });
  return {
    guard,
    tick: (ms: number) => {
      wall += ms;
      mono += ms;
    },
    moveWall: (ms: number) => {
      wall += ms;
    },
    contactNow: () => {
      contact = wall;
    },
    noContact: () => {
      contact = null;
    },
  };
}

describe('clock guard', () => {
  it('a steady clock is trusted and reports how long since the server', () => {
    const r = rig();
    r.tick(90_000);
    expect(r.guard.state()).toEqual({ suspect: false, checkedAgoMs: 90_000 });
  });
  it('a wall-clock jump over 2 minutes is suspect until the server is heard again', () => {
    const r = rig();
    r.moveWall(3 * 60_000);
    expect(r.guard.state().suspect).toBe(true);
    r.tick(1_000);
    expect(r.guard.state().suspect).toBe(true);
    r.contactNow();
    expect(r.guard.state().suspect).toBe(false);
  });
  it('a small correction is not a jump', () => {
    const r = rig();
    r.moveWall(60_000);
    expect(r.guard.state().suspect).toBe(false);
  });
  it('a clock set behind the last server contact is suspect', () => {
    const r = rig();
    r.moveWall(-30_000);
    expect(r.guard.state().suspect).toBe(true);
  });
  it('after the phone slept (monotonic clock paused), rebase prevents a false alarm', () => {
    const r = rig();
    r.moveWall(10 * 60_000);
    r.guard.rebase();
    expect(r.guard.state().suspect).toBe(false);
  });
  it('no contact yet: nothing to compare, not suspect', () => {
    const r = rig();
    r.noContact();
    expect(r.guard.state()).toEqual({ suspect: false, checkedAgoMs: null });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/shared/lib/__tests__/clock.test.ts src/shared/lib/__tests__/clockGuard.test.ts`
Expected: FAIL — `lastContactMs is not a function`; cannot find `clockGuard`.

- [ ] **Step 3: Implement**

Replace `src/shared/lib/clock.ts` with:
```ts
import type { KeyValue } from './kv';

const KEY = 'bh.clock.offset';
const MAX_ABS_OFFSET_MS = 24 * 60 * 60 * 1000;

type Saved = { o: number; c: number };
const isSaved = (v: unknown): v is Saved =>
  typeof v === 'object' &&
  v !== null &&
  'o' in v &&
  typeof v.o === 'number' &&
  'c' in v &&
  typeof v.c === 'number';

export function createClock(deps: { storage: KeyValue; now: () => number }) {
  let offset = 0;
  // Server time of the last Date header we trusted: the clock guard compares against it.
  let lastContact: number | null = null;
  return {
    async load(): Promise<void> {
      const raw = await deps.storage.get(KEY);
      if (raw === null) return;
      const legacy = Number(raw);
      if (Number.isFinite(legacy)) {
        offset = legacy;
        return;
      }
      try {
        const v: unknown = JSON.parse(raw);
        if (isSaved(v)) {
          offset = v.o;
          lastContact = v.c;
        }
      } catch {
        // Unreadable: keep the defaults.
      }
    },
    // Synchronous in memory; persisted in the background so a slow or failing storage write is
    // never on the request path.
    recordServerDate(header: string | null): void {
      if (header === null) return;
      const server = Date.parse(header);
      if (!Number.isFinite(server)) return;
      const next = server - deps.now();
      if (Math.abs(next) > MAX_ABS_OFFSET_MS) return;
      offset = next;
      lastContact = server;
      void deps.storage.set(KEY, JSON.stringify({ o: next, c: server })).catch(() => undefined);
    },
    offsetMs: () => offset,
    serverNow: () => deps.now() + offset,
    lastContactMs: () => lastContact,
  };
}

export type Clock = ReturnType<typeof createClock>;
```

`src/shared/lib/clockGuard.ts`:
```ts
export type ClockState = { suspect: boolean; checkedAgoMs: number | null };

type Deps = {
  wallNow: () => number;
  // Monotonic and per-process (performance.now): it pauses in deep sleep, hence rebase().
  monoNow: () => number;
  serverNow: () => number;
  lastContactMs: () => number | null;
  maxJumpMs?: number;
};

// The Date header has 1 s resolution and requests take time; don't call that "behind".
const BEHIND_SLACK_MS = 5_000;

// Spec §5: suspect when the wall clock jumps > 2 min against the monotonic clock in this session,
// or the corrected time is earlier than the last server contact. A new server contact re-derives
// the offset, which clears a jump.
export function createClockGuard(deps: Deps) {
  const maxJump = deps.maxJumpMs ?? 120_000;
  let wall = deps.wallNow();
  let mono = deps.monoNow();
  let jump: { contact: number | null } | null = null;

  return {
    state(): ClockState {
      const w = deps.wallNow();
      const m = deps.monoNow();
      const drift = w - wall - (m - mono);
      wall = w;
      mono = m;
      const contact = deps.lastContactMs();
      if (Math.abs(drift) > maxJump) jump = { contact };
      else if (jump !== null && contact !== jump.contact) jump = null;
      const now = deps.serverNow();
      const behind = contact !== null && now < contact - BEHIND_SLACK_MS;
      return {
        suspect: jump !== null || behind,
        checkedAgoMs: contact === null ? null : Math.max(0, now - contact),
      };
    },
    /** Call when the app becomes active: time asleep is not a clock change. */
    rebase(): void {
      wall = deps.wallNow();
      mono = deps.monoNow();
    },
  };
}

export type ClockGuard = ReturnType<typeof createClockGuard>;
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/shared/lib/__tests__/clock.test.ts src/shared/lib/__tests__/clockGuard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/clock.ts src/shared/lib/clockGuard.ts src/shared/lib/__tests__/clock.test.ts src/shared/lib/__tests__/clockGuard.test.ts
git commit -m "feat(gate): remember server contact time and detect a changed phone clock"
```

---

### Task 4: Connectivity tracker and API client reach reporting

**Files:**
- Create: `src/shared/lib/connectivity.ts`
- Modify: `src/shared/api/client.ts`, `src/shared/api/instance.ts`
- Test: `src/shared/lib/__tests__/connectivity.test.ts`, `src/shared/api/__tests__/client.test.ts` (add cases)

**Interfaces:**
- Produces: `createConnectivity(opts?: { failuresToDegrade?: number })` → `{ reached(): void; unreachable(): void; networkLost(): void; isDegraded(): boolean; subscribe(l: (degraded: boolean) => void): () => void }`. Client `Deps.onReach?: (reached: boolean) => void`. `instance.ts` exports `connectivity` and `clockGuard`.

- [ ] **Step 1: Failing tests**

`src/shared/lib/__tests__/connectivity.test.ts`:
```ts
import { createConnectivity } from '@/shared/lib/connectivity';

describe('connectivity', () => {
  it('degrades after two consecutive failures, not one', () => {
    const c = createConnectivity();
    c.unreachable();
    expect(c.isDegraded()).toBe(false);
    c.unreachable();
    expect(c.isDegraded()).toBe(true);
  });
  it('any server answer resets the count and leaves degraded', () => {
    const c = createConnectivity();
    c.unreachable();
    c.reached();
    c.unreachable();
    expect(c.isDegraded()).toBe(false);
    c.unreachable();
    c.reached();
    expect(c.isDegraded()).toBe(false);
  });
  it('losing the network degrades at once; getting it back waits for a real answer', () => {
    const c = createConnectivity();
    c.networkLost();
    expect(c.isDegraded()).toBe(true);
  });
  it('notifies subscribers once per change, and a throwing subscriber is harmless', () => {
    const c = createConnectivity();
    const seen: boolean[] = [];
    c.subscribe(() => {
      throw new Error('boom');
    });
    const off = c.subscribe((d) => seen.push(d));
    c.networkLost();
    c.networkLost();
    c.reached();
    off();
    c.networkLost();
    expect(seen).toEqual([true, false]);
  });
});
```

Add to `src/shared/api/__tests__/client.test.ts` (uses the file's `make` and `res`):
```ts
  describe('reach reporting', () => {
    it.each([
      [200, true],
      [404, true],
      [429, true],
      [503, false],
    ])('status %i reports reached=%s', async (status, reached) => {
      const onReach = jest.fn();
      const { client } = make([res(status, { ok: true })], { onReach, maxRetries: 0 });
      await client.request('/x', { schema });
      expect(onReach).toHaveBeenCalledWith(reached);
    });
    it('a network error reports unreached', async () => {
      const onReach = jest.fn();
      const { client } = make([new TypeError('Network request failed')], { onReach });
      await client.request('/x', { method: 'POST', schema });
      expect(onReach).toHaveBeenCalledWith(false);
    });
    it('a caller abort reports nothing', async () => {
      const onReach = jest.fn();
      const controller = new AbortController();
      controller.abort();
      const { client } = make([], { onReach });
      await client.request('/x', { schema, signal: controller.signal });
      expect(onReach).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/shared/lib/__tests__/connectivity.test.ts src/shared/api/__tests__/client.test.ts`
Expected: FAIL — module not found; `onReach` never called.

- [ ] **Step 3: Implement**

`src/shared/lib/connectivity.ts`:
```ts
type Listener = (degraded: boolean) => void;

// Spec §2.2: two consecutive transient failures (or the OS reporting no network) mean
// "degraded": scans decide on the phone at once. Only a real server answer leaves it.
export function createConnectivity(opts: { failuresToDegrade?: number } = {}) {
  const limit = opts.failuresToDegrade ?? 2;
  let failures = 0;
  let degraded = false;
  const listeners = new Set<Listener>();

  function set(next: boolean) {
    if (next === degraded) return;
    degraded = next;
    for (const l of listeners) {
      try {
        l(next);
      } catch {
        // A failing listener must not stop the others.
      }
    }
  }

  return {
    /** The server answered (any status below 500, 429 included). */
    reached(): void {
      failures = 0;
      set(false);
    },
    /** Network error, timeout or 5xx. */
    unreachable(): void {
      failures += 1;
      if (failures >= limit) set(true);
    },
    networkLost(): void {
      set(true);
    },
    isDegraded: (): boolean => degraded,
    subscribe(l: Listener): () => void {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

export type Connectivity = ReturnType<typeof createConnectivity>;
```

In `src/shared/api/client.ts`:
1. Add to `Deps`: `onReach?: (reached: boolean) => void;`
2. Add next to `recordDate`:
```ts
  // Never fatal: connectivity tracking must not change a request's result.
  function reach(reached: boolean) {
    try {
      deps.onReach?.(reached);
    } catch {
      // Ignore.
    }
  }
```
3. In `once()`, after `recordDate(res);` add `reach(res.status < 500);`. In its `catch`, after the `outerSignal?.aborted` early return, add `reach(false);` before computing `aborted`.

In `src/shared/api/instance.ts`, add the imports `createClockGuard` from `@/shared/lib/clockGuard` and `createConnectivity` from `@/shared/lib/connectivity`, then:
```ts
export const connectivity = createConnectivity();

export const clockGuard = createClockGuard({
  wallNow: () => Date.now(),
  monoNow: () => performance.now(),
  serverNow: () => clock.serverNow(),
  lastContactMs: () => clock.lastContactMs(),
});
```
(declare `connectivity` above `api`) and pass to `createApiClient`:
```ts
  onReach: (reached) => {
    if (reached) connectivity.reached();
    else connectivity.unreachable();
  },
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/shared/lib/__tests__/connectivity.test.ts src/shared/api/__tests__/client.test.ts && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/connectivity.ts src/shared/lib/__tests__/connectivity.test.ts src/shared/api/client.ts src/shared/api/instance.ts src/shared/api/__tests__/client.test.ts
git commit -m "feat(gate): track a degraded connection from every API response"
```

---

### Task 5: Outcome and presentation for offline results

**Files:**
- Create: `src/features/gate/domain/ago.ts`
- Modify: `src/features/gate/domain/outcome.ts`, `src/features/gate/domain/present.ts`
- Test: `src/features/gate/domain/__tests__/ago.test.ts`, `src/features/gate/domain/__tests__/present.test.ts` (update + add)

**Interfaces:**
- Produces (outcome.ts):
  - admitted variant gains `offline?: true`
  - `RefusalReason` gains `'notInList'`; the refused variant gains `listUpdatedAt?: number` (server ms)
  - `CouldntCheckCause` gains `'keysOutdated' | 'clockChanged' | 'offlineUnverifiable' | 'noOfflineList'`
- Produces (present.ts): `Presentation` gains `tag: string | null` (`'Offline · will sync'` for an offline admission, else null).
- Produces (ago.ts): `ago(thenMs: number, nowMs: number): string` → `'just now' | 'N min ago' | 'N h ago' | 'N days ago'`.

- [ ] **Step 1: Failing tests**

`src/features/gate/domain/__tests__/ago.test.ts`:
```ts
import { ago } from '@/features/gate/domain/ago';

const NOW = Date.parse('2026-10-07T18:00:00Z');

describe('ago', () => {
  it.each([
    [10_000, 'just now'],
    [4 * 60_000, '4 min ago'],
    [3 * 3_600_000, '3 h ago'],
    [3 * 86_400_000, '3 days ago'],
    [-5_000, 'just now'],
  ])('%i ms ago → %s', (diff, text) => {
    expect(ago(NOW - diff, NOW)).toBe(text);
  });
});
```

In `present.test.ts`: add `tag: null` to every existing whole-object `toEqual` expectation, then add:
```ts
  it('offline admission carries the "will sync" tag', () => {
    expect(present({ ...admitted, offline: true }, NOW).tag).toBe('Offline · will sync');
    expect(present(admitted, NOW).tag).toBeNull();
  });
  it('not in offline list says how fresh the list is', () => {
    const p = present(
      { kind: 'refused', reason: 'notInList', fixable: false, listUpdatedAt: NOW - 4 * 60_000 },
      NOW,
    );
    expect(p).toMatchObject({
      tone: 'refused',
      title: 'Refused',
      detail: 'Not in offline list',
      secondary: 'Offline list updated 4 min ago',
      action: 'done',
    });
  });
  it.each<[CouldntCheckCause, string]>([
    ['keysOutdated', "This phone's ticket keys are out of date — connect to the internet, then scan again"],
    ['clockChanged', "This phone's time changed — connect to the internet once, then scan again"],
    ['offlineUnverifiable', "Can't check this code offline — ask them to reopen their ticket when online"],
    ['noOfflineList', "We couldn't reach the server and there's no offline list on this phone — scan again"],
  ])('couldnt check %s: neutral, never red', (cause, detail) => {
    const p = present({ kind: 'couldntCheck', cause }, NOW);
    expect(p).toMatchObject({ tone: 'retry', title: "Couldn't check", detail, action: 'tryAgain' });
  });
  it('reads microsecond timestamps from the roster', () => {
    const p = present(
      {
        kind: 'used',
        checkedInAt: '2026-10-05T17:04:00.123456+00:00',
        scannedBy: { kind: 'me' },
        ticketType: null,
        replayed: false,
      },
      NOW,
    );
    expect(p.detail).toMatch(/^Checked in at \d\d:\d\d by you$/);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/gate/domain/__tests__/ago.test.ts src/features/gate/domain/__tests__/present.test.ts`
Expected: FAIL (module missing; `tag` absent; unknown causes).

- [ ] **Step 3: Implement**

`src/features/gate/domain/ago.ts`:
```ts
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function ago(thenMs: number, nowMs: number): string {
  const d = Math.max(0, nowMs - thenMs);
  if (d < MIN) return 'just now';
  if (d < HOUR) return `${String(Math.floor(d / MIN))} min ago`;
  if (d < 2 * DAY) return `${String(Math.floor(d / HOUR))} h ago`;
  return `${String(Math.floor(d / DAY))} days ago`;
}
```

`outcome.ts` changes:
- `RefusalReason`: add `| 'notInList'` before `'other'`.
- `CouldntCheckCause`: replace with
```ts
export type CouldntCheckCause =
  | 'network'
  | 'timeout'
  | 'rateLimited'
  | 'server'
  | 'auth'
  | 'unreadable'
  | 'keysOutdated'
  | 'clockChanged'
  | 'offlineUnverifiable'
  | 'noOfflineList';
```
- admitted variant: add `offline?: true;` after `checkedInAt`.
- refused variant: `| { kind: 'refused'; reason: RefusalReason; fixable: boolean; listUpdatedAt?: number }`
- in `scannedByFrom`, replace `const t = at === null ? NaN : Date.parse(at);` with `const t = parseIsoMs(at) ?? NaN;` and import `parseIsoMs` from `@/shared/lib/isoTime`.

`present.ts` changes:
- `Presentation`: add `tag: string | null;`
- `REASON`: add `notInList: 'Not in offline list',`
- `COULDNT_CHECK`: add
```ts
  keysOutdated: "This phone's ticket keys are out of date — connect to the internet, then scan again",
  clockChanged: "This phone's time changed — connect to the internet once, then scan again",
  offlineUnverifiable: "Can't check this code offline — ask them to reopen their ticket when online",
  noOfflineList:
    "We couldn't reach the server and there's no offline list on this phone — scan again",
```
- `when()`: replace `const t = iso === null ? NaN : Date.parse(iso);` with `const t = parseIsoMs(iso) ?? NaN;` (import from `@/shared/lib/isoTime`).
- In `present()`: admitted returns `tag: o.offline === true ? 'Offline · will sync' : null`; every other branch returns `tag: null`; the refused branch's `secondary` becomes
```ts
        secondary:
          o.reason === 'notInList' && o.listUpdatedAt !== undefined
            ? `Offline list updated ${ago(o.listUpdatedAt, nowMs)}`
            : null,
```
(import `ago` from `./ago`).

Then run `npx tsc --noEmit` and fix every exhaustive switch or `Record<CouldntCheckCause | RefusalReason, …>` the compiler flags (e.g. tests that enumerate causes).

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/gate && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/domain/ago.ts src/features/gate/domain/outcome.ts src/features/gate/domain/present.ts src/features/gate/domain/__tests__/ago.test.ts src/features/gate/domain/__tests__/present.test.ts
git commit -m "feat(gate): outcomes and copy for offline decisions"
```
(Add any other test file you had to touch for exhaustiveness.)

---

### Task 6: Offline decision table

**Files:**
- Create: `src/features/gate/domain/offlineDecide.ts`
- Test: `src/features/gate/domain/__tests__/offlineDecide.test.ts`

**Interfaces:**
- Consumes: `verifyBh2`, `parseBh2`, `stepInWindow`, `TicketKey` (Task 2); `ScanOutcome` (Task 5); `TicketCode` from `parseTicketCode`.
- Produces:
```ts
export type RosterTicket = {
  id: string; ticketType: string | null; ticketIndex: number | null; bookingId: string;
  bookingStatus: string; checkedInAt: string | null; scannedBy: string | null; byMe: boolean | null;
};
export type OfflineFacts = {
  ticket: RosterTicket | null; isBookingId: boolean; requireDynamic: boolean;
  keys: readonly TicketKey[]; clockSuspect: boolean; nowMs: number; listUpdatedAt: number;
};
export type OfflineDecision =
  | { kind: 'outcome'; outcome: ScanOutcome }
  | { kind: 'admit'; ticketId: string; kid: string | null };
export function ticketIdOf(code: TicketCode): string | null;
export function decideOffline(code: TicketCode, f: OfflineFacts): OfflineDecision;
```

- [ ] **Step 1: Failing tests** — `src/features/gate/domain/__tests__/offlineDecide.test.ts`:
```ts
import {
  decideOffline,
  ticketIdOf,
  type OfflineFacts,
  type RosterTicket,
} from '@/features/gate/domain/offlineDecide';
import { parseTicketCode, type TicketCode } from '@/features/gate/domain/parseTicketCode';

import { BH2_AT, BH2_BAD_SIG, BH2_ID, BH2_KEYS, BH2_TOKEN } from './bh2Vector';

const code = (raw: string): TicketCode => {
  const p = parseTicketCode(raw);
  if (!p) throw new Error(`bad fixture ${raw}`);
  return p.value;
};
const STATIC = code(BH2_ID);
const LISTED_AT = BH2_AT - 4 * 60_000;
const ticket = (over: Partial<RosterTicket> = {}): RosterTicket => ({
  id: BH2_ID,
  ticketType: 'Regular',
  ticketIndex: 1,
  bookingId: '11111111-1111-4111-8111-111111111111',
  bookingStatus: 'confirmed',
  checkedInAt: null,
  scannedBy: null,
  byMe: null,
  ...over,
});
const facts = (over: Partial<OfflineFacts> = {}): OfflineFacts => ({
  ticket: ticket(),
  isBookingId: false,
  requireDynamic: false,
  keys: BH2_KEYS,
  clockSuspect: false,
  nowMs: BH2_AT,
  listUpdatedAt: LISTED_AT,
  ...over,
});
const outcomeOf = (c: TicketCode, f: OfflineFacts) => {
  const d = decideOffline(c, f);
  return d.kind === 'outcome' ? d.outcome : d;
};

describe('ticketIdOf', () => {
  it('reads the ticket id from BH2, BH1 and static codes', () => {
    expect(ticketIdOf(code(BH2_TOKEN))).toBe(BH2_ID);
    expect(ticketIdOf(code('BH1.3f2504e04f8911d39a0c0305e82c3301.abc.0123456789abcdefghijkl'))).toBe(
      BH2_ID,
    );
    expect(ticketIdOf(STATIC)).toBe(BH2_ID);
    expect(ticketIdOf(code('BH2.garbage'))).toBeNull();
  });
});

describe('decideOffline (spec §4)', () => {
  it('2: a bad signature is refused as invalid', () => {
    expect(outcomeOf(code(BH2_BAD_SIG), facts())).toEqual({
      kind: 'refused',
      reason: 'invalid',
      fixable: false,
    });
  });
  it('3: an unknown kid is couldnt-check, never a refusal', () => {
    expect(outcomeOf(code(BH2_TOKEN), facts({ keys: [] }))).toEqual({
      kind: 'couldntCheck',
      cause: 'keysOutdated',
    });
  });
  it('4: a valid BH2 with a suspect clock is couldnt-check', () => {
    expect(outcomeOf(code(BH2_TOKEN), facts({ clockSuspect: true }))).toEqual({
      kind: 'couldntCheck',
      cause: 'clockChanged',
    });
  });
  it('5: a step outside ±1 is refused as expired (fixable)', () => {
    expect(outcomeOf(code(BH2_TOKEN), facts({ nowMs: BH2_AT + 60_000 }))).toEqual({
      kind: 'refused',
      reason: 'expired',
      fixable: true,
    });
  });
  it('6: BH1 is never admitted offline', () => {
    const bh1 = code('BH1.3f2504e04f8911d39a0c0305e82c3301.abc.0123456789abcdefghijkl');
    expect(outcomeOf(bh1, facts())).toEqual({ kind: 'couldntCheck', cause: 'offlineUnverifiable' });
  });
  it('7: a static code on a live-ticket event is refused (fixable)', () => {
    expect(outcomeOf(STATIC, facts({ requireDynamic: true }))).toEqual({
      kind: 'refused',
      reason: 'staticNotAllowed',
      fixable: true,
    });
  });
  it('7: a BH2 code on a live-ticket event is fine', () => {
    expect(decideOffline(code(BH2_TOKEN), facts({ requireDynamic: true })).kind).toBe('admit');
  });
  it('8: a booking id is the booking-code refusal', () => {
    expect(outcomeOf(STATIC, facts({ ticket: null, isBookingId: true }))).toEqual({
      kind: 'refused',
      reason: 'oldFormat',
      fixable: false,
    });
  });
  it('9: not in the roster carries the list freshness', () => {
    expect(outcomeOf(STATIC, facts({ ticket: null }))).toEqual({
      kind: 'refused',
      reason: 'notInList',
      fixable: false,
      listUpdatedAt: LISTED_AT,
    });
  });
  it.each(['pending', 'cancelled', 'completed'])('10: booking %s is not confirmed', (status) => {
    expect(outcomeOf(STATIC, facts({ ticket: ticket({ bookingStatus: status }) }))).toEqual({
      kind: 'refused',
      reason: 'notConfirmed',
      fixable: false,
    });
  });
  it('11: already admitted shows when and by whom', () => {
    const at = '2026-10-07T18:00:00.000Z';
    expect(
      outcomeOf(STATIC, facts({ ticket: ticket({ checkedInAt: at, scannedBy: 'Ada', byMe: false }) })),
    ).toEqual({
      kind: 'used',
      checkedInAt: at,
      scannedBy: { kind: 'named', name: 'Ada' },
      ticketType: 'Regular',
      replayed: false,
    });
    expect(
      outcomeOf(STATIC, facts({ ticket: ticket({ checkedInAt: at, byMe: true }) })),
    ).toMatchObject({ kind: 'used', scannedBy: { kind: 'me' } });
  });
  it('12: admits with the kid for BH2 and null kid for static', () => {
    expect(decideOffline(code(BH2_TOKEN), facts())).toEqual({
      kind: 'admit',
      ticketId: BH2_ID,
      kid: 't',
    });
    expect(decideOffline(STATIC, facts())).toEqual({ kind: 'admit', ticketId: BH2_ID, kid: null });
  });
  it('the static rules never depend on the clock', () => {
    expect(decideOffline(STATIC, facts({ clockSuspect: true })).kind).toBe('admit');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/gate/domain/__tests__/offlineDecide.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/features/gate/domain/offlineDecide.ts`**

```ts
import { parseBh2, stepInWindow, verifyBh2, type TicketKey } from './bh2';
import type { ScanOutcome, ScannedBy } from './outcome';
import type { TicketCode } from './parseTicketCode';

export type RosterTicket = {
  id: string;
  ticketType: string | null;
  ticketIndex: number | null;
  bookingId: string;
  bookingStatus: string;
  checkedInAt: string | null;
  scannedBy: string | null;
  byMe: boolean | null;
};

export type OfflineFacts = {
  ticket: RosterTicket | null;
  isBookingId: boolean;
  requireDynamic: boolean;
  keys: readonly TicketKey[];
  clockSuspect: boolean;
  /** Offset-corrected (server) clock. */
  nowMs: number;
  /** Server ms the roster was last brought up to date. */
  listUpdatedAt: number;
};

export type OfflineDecision =
  | { kind: 'outcome'; outcome: ScanOutcome }
  | { kind: 'admit'; ticketId: string; kid: string | null };

const HEX32 = /^[0-9a-f]{32}$/i;
const dashed = (h: string) =>
  `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`.toLowerCase();

/** The ticket UUID a code names, without verifying anything (null when it names none). */
export function ticketIdOf(code: TicketCode): string | null {
  if (code.startsWith('BH2.')) return parseBh2(code)?.ticketId ?? null;
  if (code.startsWith('BH1.')) {
    const id = code.split('.')[1] ?? '';
    return HEX32.test(id) ? dashed(id) : null;
  }
  // parseTicketCode already reduced a static code to a lowercase UUID.
  return code;
}

const outcome = (o: ScanOutcome): OfflineDecision => ({ kind: 'outcome', outcome: o });

function scannedBy(t: RosterTicket): ScannedBy {
  if (t.byMe === true) return { kind: 'me' };
  const name = t.scannedBy?.trim() ?? '';
  return name === '' ? { kind: 'unknown' } : { kind: 'named', name };
}

// Requirements §8.4 / spec 2026-10-07 §4. The first matching rule wins. A code the phone cannot
// verify (BH1, unknown key, untrusted clock) is "couldn't check", never a refusal.
export function decideOffline(code: TicketCode, f: OfflineFacts): OfflineDecision {
  let kid: string | null = null;
  if (code.startsWith('BH1.')) return outcome({ kind: 'couldntCheck', cause: 'offlineUnverifiable' });
  if (code.startsWith('BH2.')) {
    const v = verifyBh2(code, f.keys);
    if (!v.ok) {
      return v.reason === 'unknown_key'
        ? outcome({ kind: 'couldntCheck', cause: 'keysOutdated' })
        : outcome({ kind: 'refused', reason: 'invalid', fixable: false });
    }
    if (f.clockSuspect) return outcome({ kind: 'couldntCheck', cause: 'clockChanged' });
    if (!stepInWindow(v.step, f.nowMs)) {
      return outcome({ kind: 'refused', reason: 'expired', fixable: true });
    }
    kid = v.kid;
  } else if (f.requireDynamic) {
    return outcome({ kind: 'refused', reason: 'staticNotAllowed', fixable: true });
  }

  const t = f.ticket;
  if (t === null) {
    return outcome(
      f.isBookingId
        ? { kind: 'refused', reason: 'oldFormat', fixable: false }
        : { kind: 'refused', reason: 'notInList', fixable: false, listUpdatedAt: f.listUpdatedAt },
    );
  }
  // Only confirmed admits on the server (admit_ticket); completed/pending/cancelled do not.
  if (t.bookingStatus !== 'confirmed') {
    return outcome({ kind: 'refused', reason: 'notConfirmed', fixable: false });
  }
  if (t.checkedInAt !== null) {
    return outcome({
      kind: 'used',
      checkedInAt: t.checkedInAt,
      scannedBy: scannedBy(t),
      ticketType: t.ticketType,
      replayed: false,
    });
  }
  return { kind: 'admit', ticketId: t.id, kid };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/gate/domain/__tests__/offlineDecide.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/domain/offlineDecide.ts src/features/gate/domain/__tests__/offlineDecide.test.ts
git commit -m "feat(gate): offline decision table"
```

---

### Task 7: Encrypted SQLite layer and schema

**Files:**
- Modify: `package.json` (via `npx expo install expo-sqlite expo-crypto`), `app.json`
- Create: `src/shared/db/sql.ts`, `src/shared/db/expoSql.ts`, `src/shared/db/__tests__/nodeSql.ts`, `src/shared/db/__tests__/node-sqlite.d.ts`, `src/features/gate/offline/schema.ts`
- Test: `src/shared/db/__tests__/migrate.test.ts`

**Interfaces:**
- Produces:
```ts
// src/shared/db/sql.ts
export type SqlValue = string | number | null;
export type Sql = {
  exec: (sql: string) => Promise<void>;
  run: (sql: string, params?: readonly SqlValue[]) => Promise<{ changes: number }>;
  get: <T>(sql: string, params?: readonly SqlValue[]) => Promise<T | null>;
  all: <T>(sql: string, params?: readonly SqlValue[]) => Promise<T[]>;
  tx: <T>(fn: (t: Sql) => Promise<T>) => Promise<T>;
};
export type DirectSql = Omit<Sql, 'tx'>;
export function serialSql(d: DirectSql): Sql;
export function migrate(db: Sql, migrations: readonly string[]): Promise<void>;
// src/shared/db/expoSql.ts
export function openEncrypted(name: string, keyHex: string): Promise<{ sql: Sql; close: () => Promise<void> }>;
export function deleteDatabase(name: string): Promise<void>;
export function isWrongKey(e: unknown): boolean;
// src/shared/db/__tests__/nodeSql.ts
export function nodeSql(): Sql;
// src/features/gate/offline/schema.ts
export const MIGRATIONS: readonly string[];
```

- [ ] **Step 1: Install and configure**

Run: `npx expo install expo-sqlite expo-crypto`
In `app.json` → `plugins`, add after the `expo-audio` entry:
```json
      [
        "expo-sqlite",
        {
          "useSQLCipher": true
        }
      ]
```
(If `npx expo install` already appended a bare `"expo-sqlite"` entry, replace it with this one; there must be only one.)

- [ ] **Step 2: Write the Jest adapter and the failing migration test**

`src/shared/db/__tests__/node-sqlite.d.ts` (minimal types so tsc needn't load all of `@types/node`):
```ts
declare module 'node:sqlite' {
  type Value = string | number | null;
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: Value[]): { changes: number | bigint };
      get(...params: Value[]): unknown;
      all(...params: Value[]): unknown[];
    };
  }
}
```
If `npx tsc --noEmit` reports a duplicate declaration of module `'node:sqlite'`, delete this file — `@types/node` already provides it.

`src/shared/db/__tests__/nodeSql.ts`:
```ts
import { DatabaseSync } from 'node:sqlite';

import { serialSql, type Sql, type SqlValue } from '@/shared/db/sql';

// Runs the app's real SQL under Jest on Node's built-in SQLite (not SQLCipher: encryption is
// verified on a device, Task 17). Same serial queue as the device adapter.
export function nodeSql(): Sql {
  const db = new DatabaseSync(':memory:');
  const later = <T>(f: () => T): Promise<T> =>
    new Promise<T>((resolve) => {
      resolve(f());
    });
  return serialSql({
    exec: (s) => later(() => db.exec(s)),
    run: (s, p: readonly SqlValue[] = []) =>
      later(() => ({ changes: Number(db.prepare(s).run(...p).changes) })),
    get: <T>(s: string, p: readonly SqlValue[] = []) =>
      later(() => (db.prepare(s).get(...p) as T | undefined) ?? null),
    all: <T>(s: string, p: readonly SqlValue[] = []) => later(() => db.prepare(s).all(...p) as T[]),
  });
}
```

`src/shared/db/__tests__/migrate.test.ts`:
```ts
import { migrate } from '@/shared/db/sql';
import { MIGRATIONS } from '@/features/gate/offline/schema';

import { nodeSql } from './nodeSql';

describe('migrate', () => {
  it('runs each migration once and records user_version', async () => {
    const db = nodeSql();
    await migrate(db, ['CREATE TABLE a (x)', 'CREATE TABLE b (y)']);
    await migrate(db, ['CREATE TABLE a (x)', 'CREATE TABLE b (y)']);
    expect(await db.get<{ user_version: number }>('PRAGMA user_version')).toEqual({
      user_version: 2,
    });
  });
  it('a failing migration leaves the version where it was', async () => {
    const db = nodeSql();
    await expect(migrate(db, ['CREATE TABLE a (x)', 'NOT SQL'])).rejects.toThrow();
    expect(await db.get<{ user_version: number }>('PRAGMA user_version')).toEqual({
      user_version: 1,
    });
  });
  it('concurrent transactions run one after another', async () => {
    const db = nodeSql();
    await db.exec('CREATE TABLE n (v INTEGER)');
    await Promise.all(
      [1, 2, 3].map((v) =>
        db.tx(async (t) => {
          await t.run('INSERT INTO n (v) VALUES (?)', [v]);
          await t.run('INSERT INTO n (v) VALUES (?)', [v]);
        }),
      ),
    );
    expect(await db.all<{ v: number }>('SELECT v FROM n')).toHaveLength(6);
  });
  it('the gate schema applies cleanly', async () => {
    const db = nodeSql();
    await migrate(db, MIGRATIONS);
    const tables = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['device', 'outbox', 'roster_meta', 'roster_staging', 'roster_ticket']),
    );
  });
});
```
(The gate-schema test imports from a feature in a `shared` test; that is allowed in tests only. If the lint rule objects, move this third test to `src/features/gate/offline/__tests__/schema.test.ts`.)

- [ ] **Step 3: Run to verify failure**

Run: `npx jest src/shared/db`
Expected: FAIL — cannot find `@/shared/db/sql` / `schema`.

- [ ] **Step 4: Implement**

`src/shared/db/sql.ts`:
```ts
export type SqlValue = string | number | null;

// The slice of a SQLite connection the app uses. expo-sqlite implements it on devices
// (expoSql.ts); node:sqlite implements it in tests, so the real SQL is unit-tested.
export type Sql = {
  exec: (sql: string) => Promise<void>;
  run: (sql: string, params?: readonly SqlValue[]) => Promise<{ changes: number }>;
  get: <T>(sql: string, params?: readonly SqlValue[]) => Promise<T | null>;
  all: <T>(sql: string, params?: readonly SqlValue[]) => Promise<T[]>;
  /**
   * One transaction, exclusive within the app. Inside `fn`, use only `t`: calling the outer
   * handle there waits for this very transaction and deadlocks.
   */
  tx: <T>(fn: (t: Sql) => Promise<T>) => Promise<T>;
};

export type DirectSql = Omit<Sql, 'tx'>;

// Every statement goes through one queue on one connection. expo-sqlite's
// withExclusiveTransactionAsync opens a second connection, which would not carry the SQLCipher
// key, and withTransactionAsync lets other callers' statements join; a queue avoids both.
export function serialSql(d: DirectSql): Sql {
  let tail: Promise<unknown> = Promise.resolve();
  const queued = <T>(f: () => Promise<T>): Promise<T> => {
    const p = tail.then(f, f);
    tail = p.catch(() => undefined);
    return p;
  };
  const inTx: Sql = {
    ...d,
    tx: () => Promise.reject(new Error('nested transactions are not supported')),
  };
  return {
    exec: (s) => queued(() => d.exec(s)),
    run: (s, p) => queued(() => d.run(s, p)),
    get: <T>(s: string, p?: readonly SqlValue[]) => queued(() => d.get<T>(s, p)),
    all: <T>(s: string, p?: readonly SqlValue[]) => queued(() => d.all<T>(s, p)),
    tx: <T>(fn: (t: Sql) => Promise<T>) =>
      queued(async () => {
        await d.exec('BEGIN IMMEDIATE');
        try {
          const v = await fn(inTx);
          await d.exec('COMMIT');
          return v;
        } catch (e) {
          await d.exec('ROLLBACK').catch(() => undefined);
          throw e;
        }
      }),
  };
}

/** migrations[i] moves the database from user_version i to i + 1, each in its own transaction. */
export async function migrate(db: Sql, migrations: readonly string[]): Promise<void> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  for (let v = row?.user_version ?? 0; v < migrations.length; v++) {
    const step = migrations[v];
    if (step === undefined) return;
    await db.tx(async (t) => {
      await t.exec(step);
      await t.exec(`PRAGMA user_version = ${String(v + 1)}`);
    });
  }
}
```

`src/shared/db/expoSql.ts`:
```ts
import * as SQLite from 'expo-sqlite';

import { serialSql, type Sql, type SqlValue } from './sql';

const HEX_KEY = /^[0-9a-f]{64}$/;

function wrap(db: SQLite.SQLiteDatabase): Sql {
  return serialSql({
    exec: (s) => db.execAsync(s),
    run: async (s, p: readonly SqlValue[] = []) => ({ changes: (await db.runAsync(s, [...p])).changes }),
    get: <T>(s: string, p: readonly SqlValue[] = []) => db.getFirstAsync<T>(s, [...p]),
    all: <T>(s: string, p: readonly SqlValue[] = []) => db.getAllAsync<T>(s, [...p]),
  });
}

/** SQLCipher: the raw 32-byte key must be the first statement on the connection. */
export async function openEncrypted(
  name: string,
  keyHex: string,
): Promise<{ sql: Sql; close: () => Promise<void> }> {
  if (!HEX_KEY.test(keyHex)) throw new Error('database key must be 64 lowercase hex characters');
  const db = await SQLite.openDatabaseAsync(name);
  try {
    await db.execAsync(`PRAGMA key = "x'${keyHex}'"`);
    // Throws "file is not a database" when the key doesn't open this file.
    await db.getFirstAsync('SELECT count(*) AS n FROM sqlite_master');
    await db.execAsync('PRAGMA journal_mode = WAL');
  } catch (e) {
    await db.closeAsync().catch(() => undefined);
    throw e;
  }
  return { sql: wrap(db), close: () => db.closeAsync() };
}

// Android throws if the database is still open: close it first.
export const deleteDatabase = (name: string): Promise<void> => SQLite.deleteDatabaseAsync(name);

export const isWrongKey = (e: unknown): boolean =>
  e instanceof Error && /not a database/i.test(e.message);
```

`src/features/gate/offline/schema.ts`:
```ts
// The gate's offline database (spec §3). PII columns are exactly what the roster endpoint
// returns: holder name and a masked phone, never email or a full number (DECISION-8).
const ROSTER_COLUMNS = `
  event_id TEXT NOT NULL,
  id TEXT NOT NULL,
  ticket_type TEXT,
  ticket_index INTEGER,
  booking_id TEXT NOT NULL,
  booking_status TEXT NOT NULL,
  checked_in_at TEXT,
  scanned_by TEXT,
  by_me INTEGER,
  holder_name TEXT,
  phone_masked TEXT,
  seat TEXT,
  PRIMARY KEY (event_id, id)`;

export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE roster_ticket (${ROSTER_COLUMNS}) WITHOUT ROWID;
  CREATE INDEX roster_ticket_booking ON roster_ticket (event_id, booking_id);
  CREATE TABLE roster_staging (${ROSTER_COLUMNS}) WITHOUT ROWID;
  CREATE TABLE roster_meta (
    event_id TEXT PRIMARY KEY,
    title TEXT,
    event_date TEXT,
    require_dynamic INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    keys TEXT NOT NULL DEFAULT '[]',
    ready INTEGER NOT NULL DEFAULT 0,
    sync_kind TEXT,
    cursor TEXT,
    pending_mark TEXT,
    since_mark TEXT,
    synced_at INTEGER,
    full_at INTEGER,
    ends_at INTEGER
  );
  CREATE TABLE outbox (
    client_seq INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    ticket_id TEXT NOT NULL,
    code TEXT NOT NULL,
    scanned_at TEXT NOT NULL,
    mode TEXT NOT NULL,
    kid TEXT,
    app_version TEXT NOT NULL,
    state TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_try_at INTEGER NOT NULL DEFAULT 0,
    result TEXT
  );
  CREATE INDEX outbox_event_state ON outbox (event_id, state, client_seq);
  CREATE TABLE device (k TEXT PRIMARY KEY, v TEXT NOT NULL);
  `,
];
```

- [ ] **Step 5: Run to verify pass**

Run: `npx jest src/shared/db && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app.json src/shared/db src/features/gate/offline/schema.ts
git commit -m "feat(gate): encrypted SQLite layer and offline schema"
```

---

### Task 8: Roster store

**Files:**
- Create: `src/features/gate/offline/rosterStore.ts`
- Test: `src/features/gate/offline/__tests__/rosterStore.test.ts`

**Interfaces:**
- Consumes: `Sql`, `migrate`, `MIGRATIONS` (Task 7); `RosterTicket` (Task 6); `TicketKey` (Task 2); `parseIsoMs` (Task 1).
- Produces:
```ts
export type RosterRow = RosterTicket & { holderName: string | null; phoneMasked: string | null; seat: string | null };
export type RosterEventInfo = { title: string | null; eventDate: string | null; requireDynamic: boolean; total: number };
export type SyncKind = 'full' | 'delta';
export type RosterMeta = {
  eventId: string; title: string | null; eventDate: string | null; requireDynamic: boolean; total: number;
  keys: TicketKey[]; ready: boolean; syncKind: SyncKind | null; cursor: string | null;
  pendingMark: string | null; sinceMark: string | null; syncedAt: number | null; fullAt: number | null; endsAt: number | null;
};
export function readTicket(db: Sql, eventId: string, id: string): Promise<RosterTicket | null>;
export function createRosterStore(db: Sql): {
  meta(eventId: string): Promise<RosterMeta | null>;
  beginSync(eventId: string, kind: SyncKind, mark: string, info: RosterEventInfo, keys: TicketKey[] | null): Promise<void>;
  writePage(eventId: string, kind: SyncKind, rows: RosterRow[], nextCursor: string | null): Promise<void>;
  finishSync(eventId: string, kind: SyncKind): Promise<void>;
  ticket(eventId: string, id: string): Promise<RosterTicket | null>;
  hasBooking(eventId: string, bookingId: string): Promise<boolean>;
  bookingProgress(eventId: string, bookingId: string): Promise<{ total: number; checkedIn: number }>;
  counts(eventId: string): Promise<{ admitted: number; total: number }>;
  markCheckedIn(eventId: string, id: string, at: string, byMe: boolean | null, scannedBy: string | null): Promise<void>;
  setKeys(eventId: string, keys: TicketKey[]): Promise<void>;
  setEndsAt(eventId: string, endsAt: number): Promise<void>;
  expired(nowMs: number): Promise<string[]>;
  drop(eventId: string): Promise<void>;
};
export type RosterStore = ReturnType<typeof createRosterStore>;
```
Store methods are arrow-function properties (the lint rule `unbound-method` forbids passing method references).

- [ ] **Step 1: Failing tests** — `src/features/gate/offline/__tests__/rosterStore.test.ts`:
```ts
import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { MIGRATIONS } from '@/features/gate/offline/schema';
import { createRosterStore, type RosterRow } from '@/features/gate/offline/rosterStore';

const EV = 'e0000000-0000-4000-8000-000000000001';
const INFO = { title: 'Gala', eventDate: '2026-10-10', requireDynamic: true, total: 3 };
const KEYS = [{ kid: 't', publicKey: 'abc' }];
const MARK1 = '2026-10-07T18:00:00.123456+00:00';
const MARK2 = '2026-10-07T18:03:00.000000+00:00';
const row = (n: number, over: Partial<RosterRow> = {}): RosterRow => ({
  id: `00000000-0000-4000-8000-00000000000${String(n)}`,
  ticketType: 'Regular',
  ticketIndex: n,
  bookingId: 'b0000000-0000-4000-8000-000000000001',
  bookingStatus: 'confirmed',
  checkedInAt: null,
  scannedBy: null,
  byMe: null,
  holderName: null,
  phoneMasked: '0803••••210',
  seat: null,
  ...over,
});

async function setup() {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  return { db, store: createRosterStore(db) };
}

async function fullSync(store: ReturnType<typeof createRosterStore>, rows: RosterRow[], mark = MARK1) {
  await store.beginSync(EV, 'full', mark, INFO, KEYS);
  await store.writePage(EV, 'full', rows, null);
  await store.finishSync(EV, 'full');
}

describe('roster store', () => {
  it('a full sync is invisible until it finishes, then ready with keys and freshness', async () => {
    const { store } = await setup();
    await store.beginSync(EV, 'full', MARK1, INFO, KEYS);
    await store.writePage(EV, 'full', [row(1), row(2)], 'cursor-2');
    expect(await store.ticket(EV, row(1).id)).toBeNull();
    expect(await store.meta(EV)).toMatchObject({ ready: false, syncKind: 'full', cursor: 'cursor-2' });
    await store.writePage(EV, 'full', [row(3)], null);
    await store.finishSync(EV, 'full');
    const m = await store.meta(EV);
    expect(m).toMatchObject({
      ready: true,
      requireDynamic: true,
      total: 3,
      keys: KEYS,
      syncKind: null,
      cursor: null,
      sinceMark: MARK1,
      syncedAt: Date.parse('2026-10-07T18:00:00.123Z'),
      fullAt: Date.parse('2026-10-07T18:00:00.123Z'),
    });
    expect(await store.counts(EV)).toEqual({ admitted: 0, total: 3 });
  });

  it('a later full sync replaces the list (a cancelled booking disappears)', async () => {
    const { store } = await setup();
    await fullSync(store, [row(1), row(2)]);
    await fullSync(store, [row(1)], MARK2);
    expect(await store.ticket(EV, row(2).id)).toBeNull();
  });

  it('decisions keep using the old list while a full refresh is staged', async () => {
    const { store } = await setup();
    await fullSync(store, [row(1)]);
    await store.beginSync(EV, 'full', MARK2, INFO, KEYS);
    await store.writePage(EV, 'full', [row(2)], 'c');
    expect(await store.ticket(EV, row(1).id)).not.toBeNull();
    expect(await store.ticket(EV, row(2).id)).toBeNull();
  });

  it('the swap re-applies admissions made on this phone that the server has not seen yet', async () => {
    const { db, store } = await setup();
    await fullSync(store, [row(1), row(2)]);
    await db.run(
      "INSERT INTO outbox (event_id, ticket_id, code, scanned_at, mode, app_version, state) VALUES (?, ?, ?, ?, 'offline', '1', 'pending')",
      [EV, row(2).id, row(2).id, '2026-10-07T18:01:00.000Z'],
    );
    await fullSync(store, [row(1), row(2)], MARK2);
    expect(await store.ticket(EV, row(2).id)).toMatchObject({
      checkedInAt: '2026-10-07T18:01:00.000Z',
      byMe: true,
    });
  });

  it('a delta merges server admissions but never erases a local one', async () => {
    const { store } = await setup();
    await fullSync(store, [row(1), row(2)]);
    await store.markCheckedIn(EV, row(1).id, '2026-10-07T18:01:00.000Z', true, null);
    await store.beginSync(EV, 'delta', MARK2, INFO, null);
    await store.writePage(
      EV,
      'delta',
      [row(1), row(2, { checkedInAt: '2026-10-07T18:02:00.000Z', scannedBy: 'Ada', byMe: false }), row(3)],
      null,
    );
    await store.finishSync(EV, 'delta');
    expect(await store.ticket(EV, row(1).id)).toMatchObject({ checkedInAt: '2026-10-07T18:01:00.000Z', byMe: true });
    expect(await store.ticket(EV, row(2).id)).toMatchObject({ scannedBy: 'Ada', byMe: false });
    expect(await store.ticket(EV, row(3).id)).not.toBeNull();
    expect(await store.meta(EV)).toMatchObject({ sinceMark: MARK2, keys: KEYS });
  });

  it('markCheckedIn only fills an empty admission', async () => {
    const { store } = await setup();
    await fullSync(store, [row(1)]);
    await store.markCheckedIn(EV, row(1).id, '2026-10-07T18:01:00.000Z', true, null);
    await store.markCheckedIn(EV, row(1).id, '2026-10-07T18:09:00.000Z', false, 'Ada');
    expect(await store.ticket(EV, row(1).id)).toMatchObject({ checkedInAt: '2026-10-07T18:01:00.000Z' });
  });

  it('booking lookups and progress', async () => {
    const { store } = await setup();
    await fullSync(store, [row(1), row(2, { checkedInAt: '2026-10-07T18:00:00Z' })]);
    expect(await store.hasBooking(EV, row(1).bookingId)).toBe(true);
    expect(await store.hasBooking(EV, row(1).id)).toBe(false);
    expect(await store.bookingProgress(EV, row(1).bookingId)).toEqual({ total: 2, checkedIn: 1 });
  });

  it('expiry and drop', async () => {
    const { store } = await setup();
    await fullSync(store, [row(1)]);
    await store.setEndsAt(EV, 1_000);
    expect(await store.expired(999)).toEqual([]);
    expect(await store.expired(1_001)).toEqual([EV]);
    await store.drop(EV);
    expect(await store.meta(EV)).toBeNull();
    expect(await store.ticket(EV, row(1).id)).toBeNull();
  });

  it('stores only the fields the endpoint returns (no email column exists)', async () => {
    const { db } = await setup();
    const cols = await db.all<{ name: string }>("SELECT name FROM pragma_table_info('roster_ticket')");
    expect(cols.map((c) => c.name).filter((n) => /mail|phone/.test(n))).toEqual(['phone_masked']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/gate/offline/__tests__/rosterStore.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/features/gate/offline/rosterStore.ts`**

```ts
import type { TicketKey } from '@/features/gate/domain/bh2';
import type { RosterTicket } from '@/features/gate/domain/offlineDecide';
import type { Sql, SqlValue } from '@/shared/db/sql';
import { parseIsoMs } from '@/shared/lib/isoTime';

export type RosterRow = RosterTicket & {
  holderName: string | null;
  phoneMasked: string | null;
  seat: string | null;
};
export type RosterEventInfo = {
  title: string | null;
  eventDate: string | null;
  requireDynamic: boolean;
  total: number;
};
export type SyncKind = 'full' | 'delta';
export type RosterMeta = {
  eventId: string;
  title: string | null;
  eventDate: string | null;
  requireDynamic: boolean;
  total: number;
  keys: TicketKey[];
  ready: boolean;
  syncKind: SyncKind | null;
  cursor: string | null;
  pendingMark: string | null;
  sinceMark: string | null;
  syncedAt: number | null;
  fullAt: number | null;
  endsAt: number | null;
};

const COLS = [
  'event_id',
  'id',
  'ticket_type',
  'ticket_index',
  'booking_id',
  'booking_status',
  'checked_in_at',
  'scanned_by',
  'by_me',
  'holder_name',
  'phone_masked',
  'seat',
] as const;
const COL_LIST = COLS.join(', ');
const ROW_PLACEHOLDERS = `(${COLS.map(() => '?').join(', ')})`;
// 50 rows × 12 columns = 600 parameters per statement: few bridge calls, under SQLite's limit.
const CHUNK = 50;

// A delta never erases an admission: a later server null keeps what this phone already knows.
const DELTA_MERGE = `ON CONFLICT (event_id, id) DO UPDATE SET
  ticket_type = excluded.ticket_type,
  ticket_index = excluded.ticket_index,
  booking_id = excluded.booking_id,
  booking_status = excluded.booking_status,
  checked_in_at = COALESCE(excluded.checked_in_at, roster_ticket.checked_in_at),
  scanned_by = CASE WHEN excluded.checked_in_at IS NULL THEN roster_ticket.scanned_by ELSE excluded.scanned_by END,
  by_me = CASE WHEN excluded.checked_in_at IS NULL THEN roster_ticket.by_me ELSE excluded.by_me END,
  holder_name = excluded.holder_name,
  phone_masked = excluded.phone_masked,
  seat = excluded.seat`;

// After a full swap, admissions this phone made (and may not have synced before the snapshot)
// are put back so a second presentation is still "already used".
const REAPPLY_OUTBOX = `UPDATE roster_ticket
  SET checked_in_at = o.scanned_at, by_me = 1, scanned_by = NULL
  FROM (
    SELECT ticket_id, MIN(scanned_at) AS scanned_at FROM outbox
    WHERE event_id = ? AND state IN ('pending', 'sending', 'synced')
    GROUP BY ticket_id
  ) AS o
  WHERE roster_ticket.event_id = ? AND roster_ticket.id = o.ticket_id
    AND roster_ticket.checked_in_at IS NULL`;

type TicketSqlRow = {
  id: string;
  ticket_type: string | null;
  ticket_index: number | null;
  booking_id: string;
  booking_status: string;
  checked_in_at: string | null;
  scanned_by: string | null;
  by_me: number | null;
};
type MetaSqlRow = {
  event_id: string;
  title: string | null;
  event_date: string | null;
  require_dynamic: number;
  total: number;
  keys: string;
  ready: number;
  sync_kind: string | null;
  cursor: string | null;
  pending_mark: string | null;
  since_mark: string | null;
  synced_at: number | null;
  full_at: number | null;
  ends_at: number | null;
};

const toTicket = (r: TicketSqlRow): RosterTicket => ({
  id: r.id,
  ticketType: r.ticket_type,
  ticketIndex: r.ticket_index,
  bookingId: r.booking_id,
  bookingStatus: r.booking_status,
  checkedInAt: r.checked_in_at,
  scannedBy: r.scanned_by,
  byMe: r.by_me === null ? null : r.by_me === 1,
});

function parseKeys(text: string): TicketKey[] {
  try {
    const v: unknown = JSON.parse(text);
    if (!Array.isArray(v)) return [];
    return v.flatMap((k: unknown) =>
      typeof k === 'object' &&
      k !== null &&
      'kid' in k &&
      typeof k.kid === 'string' &&
      'publicKey' in k &&
      typeof k.publicKey === 'string'
        ? [{ kid: k.kid, publicKey: k.publicKey }]
        : [],
    );
  } catch {
    return [];
  }
}

const toMeta = (r: MetaSqlRow): RosterMeta => ({
  eventId: r.event_id,
  title: r.title,
  eventDate: r.event_date,
  requireDynamic: r.require_dynamic === 1,
  total: r.total,
  keys: parseKeys(r.keys),
  ready: r.ready === 1,
  syncKind: r.sync_kind === 'full' || r.sync_kind === 'delta' ? r.sync_kind : null,
  cursor: r.cursor,
  pendingMark: r.pending_mark,
  sinceMark: r.since_mark,
  syncedAt: r.synced_at,
  fullAt: r.full_at,
  endsAt: r.ends_at,
});

const values = (eventId: string, r: RosterRow): SqlValue[] => [
  eventId,
  r.id,
  r.ticketType,
  r.ticketIndex,
  r.bookingId,
  r.bookingStatus,
  r.checkedInAt,
  r.scannedBy,
  r.byMe === null ? null : r.byMe ? 1 : 0,
  r.holderName,
  r.phoneMasked,
  r.seat,
];

async function insertRows(t: Sql, head: string, tail: string, eventId: string, rows: RosterRow[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    await t.run(
      `${head} (${COL_LIST}) VALUES ${part.map(() => ROW_PLACEHOLDERS).join(', ')} ${tail}`,
      part.flatMap((r) => values(eventId, r)),
    );
  }
}

const TICKET_SELECT =
  'SELECT id, ticket_type, ticket_index, booking_id, booking_status, checked_in_at, scanned_by, by_me FROM roster_ticket';

export async function readTicket(db: Sql, eventId: string, id: string): Promise<RosterTicket | null> {
  const r = await db.get<TicketSqlRow>(`${TICKET_SELECT} WHERE event_id = ? AND id = ?`, [eventId, id]);
  return r === null ? null : toTicket(r);
}

export function createRosterStore(db: Sql) {
  return {
    meta: async (eventId: string): Promise<RosterMeta | null> => {
      const r = await db.get<MetaSqlRow>('SELECT * FROM roster_meta WHERE event_id = ?', [eventId]);
      return r === null ? null : toMeta(r);
    },

    beginSync: (
      eventId: string,
      kind: SyncKind,
      mark: string,
      info: RosterEventInfo,
      keys: TicketKey[] | null,
    ): Promise<void> =>
      db.tx(async (t) => {
        await t.run('INSERT INTO roster_meta (event_id) VALUES (?) ON CONFLICT (event_id) DO NOTHING', [
          eventId,
        ]);
        await t.run(
          `UPDATE roster_meta SET sync_kind = ?, cursor = NULL, pending_mark = ?, title = ?,
             event_date = ?, require_dynamic = ?, total = ? WHERE event_id = ?`,
          [kind, mark, info.title, info.eventDate, info.requireDynamic ? 1 : 0, info.total, eventId],
        );
        if (keys !== null) {
          await t.run('UPDATE roster_meta SET keys = ? WHERE event_id = ?', [JSON.stringify(keys), eventId]);
        }
        if (kind === 'full') await t.run('DELETE FROM roster_staging WHERE event_id = ?', [eventId]);
      }),

    // The page and its cursor commit together, so a resumed sync never skips or repeats a page.
    writePage: (eventId: string, kind: SyncKind, rows: RosterRow[], nextCursor: string | null) =>
      db.tx(async (t) => {
        if (kind === 'full') await insertRows(t, 'INSERT OR REPLACE INTO roster_staging', '', eventId, rows);
        else await insertRows(t, 'INSERT INTO roster_ticket', DELTA_MERGE, eventId, rows);
        await t.run('UPDATE roster_meta SET cursor = ? WHERE event_id = ?', [nextCursor, eventId]);
      }),

    finishSync: (eventId: string, kind: SyncKind): Promise<void> =>
      db.tx(async (t) => {
        const m = await t.get<{ pending_mark: string | null }>(
          'SELECT pending_mark FROM roster_meta WHERE event_id = ?',
          [eventId],
        );
        const at = parseIsoMs(m?.pending_mark);
        if (kind === 'full') {
          await t.run('DELETE FROM roster_ticket WHERE event_id = ?', [eventId]);
          await t.run(
            `INSERT INTO roster_ticket (${COL_LIST}) SELECT ${COL_LIST} FROM roster_staging WHERE event_id = ?`,
            [eventId],
          );
          await t.run('DELETE FROM roster_staging WHERE event_id = ?', [eventId]);
          await t.run(REAPPLY_OUTBOX, [eventId, eventId]);
          await t.run('UPDATE roster_meta SET ready = 1, full_at = ? WHERE event_id = ?', [at, eventId]);
        }
        await t.run(
          `UPDATE roster_meta SET since_mark = pending_mark, synced_at = ?, sync_kind = NULL,
             cursor = NULL, pending_mark = NULL WHERE event_id = ?`,
          [at, eventId],
        );
      }),

    ticket: (eventId: string, id: string) => readTicket(db, eventId, id),

    hasBooking: async (eventId: string, bookingId: string): Promise<boolean> =>
      (await db.get<{ one: number }>(
        'SELECT 1 AS one FROM roster_ticket WHERE event_id = ? AND booking_id = ? LIMIT 1',
        [eventId, bookingId],
      )) !== null,

    bookingProgress: async (eventId: string, bookingId: string) => {
      const r = await db.get<{ total: number; checked_in: number }>(
        'SELECT count(*) AS total, count(checked_in_at) AS checked_in FROM roster_ticket WHERE event_id = ? AND booking_id = ?',
        [eventId, bookingId],
      );
      return { total: r?.total ?? 0, checkedIn: r?.checked_in ?? 0 };
    },

    counts: async (eventId: string) => {
      const r = await db.get<{ total: number; admitted: number }>(
        'SELECT count(*) AS total, count(checked_in_at) AS admitted FROM roster_ticket WHERE event_id = ?',
        [eventId],
      );
      return { admitted: r?.admitted ?? 0, total: r?.total ?? 0 };
    },

    markCheckedIn: async (
      eventId: string,
      id: string,
      at: string,
      byMe: boolean | null,
      scannedBy: string | null,
    ): Promise<void> => {
      await db.run(
        'UPDATE roster_ticket SET checked_in_at = ?, by_me = ?, scanned_by = ? WHERE event_id = ? AND id = ? AND checked_in_at IS NULL',
        [at, byMe === null ? null : byMe ? 1 : 0, scannedBy, eventId, id],
      );
    },

    setKeys: async (eventId: string, keys: TicketKey[]): Promise<void> => {
      await db.run('UPDATE roster_meta SET keys = ? WHERE event_id = ?', [JSON.stringify(keys), eventId]);
    },

    setEndsAt: async (eventId: string, endsAt: number): Promise<void> => {
      await db.run('UPDATE roster_meta SET ends_at = ? WHERE event_id = ?', [endsAt, eventId]);
    },

    expired: async (nowMs: number): Promise<string[]> =>
      (
        await db.all<{ event_id: string }>(
          'SELECT event_id FROM roster_meta WHERE ends_at IS NOT NULL AND ends_at < ?',
          [nowMs],
        )
      ).map((r) => r.event_id),

    drop: (eventId: string): Promise<void> =>
      db.tx(async (t) => {
        await t.run('DELETE FROM roster_ticket WHERE event_id = ?', [eventId]);
        await t.run('DELETE FROM roster_staging WHERE event_id = ?', [eventId]);
        await t.run('DELETE FROM roster_meta WHERE event_id = ?', [eventId]);
      }),
  };
}

export type RosterStore = ReturnType<typeof createRosterStore>;
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/gate/offline/__tests__/rosterStore.test.ts && npx tsc --noEmit`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/offline/rosterStore.ts src/features/gate/offline/__tests__/rosterStore.test.ts
git commit -m "feat(gate): roster store with staged full refresh and merge-only deltas"
```

---

### Task 9: Outbox store

**Files:**
- Create: `src/features/gate/offline/outboxStore.ts`
- Test: `src/features/gate/offline/__tests__/outboxStore.test.ts`

**Interfaces:**
- Consumes: `Sql` (Task 7); `readTicket` (Task 8); `RosterTicket` (Task 6).
- Produces:
```ts
export type OutboxState = 'pending' | 'sending' | 'synced' | 'duplicate' | 'suspect' | 'rejected' | 'blocked' | 'error';
export type OutboxItem = {
  seq: number; eventId: string; ticketId: string; code: string; scannedAt: string; mode: 'offline';
  kid: string | null; appVersion: string; state: OutboxState; attempts: number; nextTryAt: number;
  result: Record<string, unknown> | null;
};
export type AttentionItem = OutboxItem & { ticketType: string | null; ticketIndex: number | null };
export type AdmissionInput = { eventId: string; ticketId: string; code: string; scannedAt: string; kid: string | null; appVersion: string };
export type RecordResult = { recorded: true; seq: number } | { recorded: false; ticket: RosterTicket | null };
export function createOutboxStore(db: Sql, deps: { newDeviceId: () => string }): {
  recordAdmission(input: AdmissionInput): Promise<RecordResult>;
  deviceId(): Promise<string>;
  due(eventId: string, nowMs: number, limit: number): Promise<OutboxItem[]>;
  markSending(seqs: number[]): Promise<void>;
  settle(updates: { seq: number; state: OutboxState; result: Record<string, unknown> | null }[]): Promise<void>;
  retryLater(seqs: number[], nextTryAt: number): Promise<void>;
  resetSending(): Promise<void>;
  blockEvent(eventId: string): Promise<void>;
  status(eventId: string): Promise<{ pending: number; attention: number; blocked: boolean; nextTryAt: number | null }>;
  attention(eventId: string): Promise<AttentionItem[]>;
  totals(): Promise<{ unsynced: number; unsyncable: number }>;
  eventsWithUnsynced(): Promise<string[]>;
  hasUnsynced(eventId: string): Promise<boolean>;
};
export type OutboxStore = ReturnType<typeof createOutboxStore>;
```

- [ ] **Step 1: Failing tests** — `src/features/gate/offline/__tests__/outboxStore.test.ts`:
```ts
import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { createOutboxStore, type AdmissionInput } from '@/features/gate/offline/outboxStore';
import { createRosterStore, type RosterRow } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';

const EV = 'e0000000-0000-4000-8000-000000000001';
const T1 = '00000000-0000-4000-8000-000000000001';
const T2 = '00000000-0000-4000-8000-000000000002';
const row = (id: string): RosterRow => ({
  id,
  ticketType: 'Regular',
  ticketIndex: 1,
  bookingId: 'b0000000-0000-4000-8000-000000000001',
  bookingStatus: 'confirmed',
  checkedInAt: null,
  scannedBy: null,
  byMe: null,
  holderName: null,
  phoneMasked: null,
  seat: null,
});
const input = (ticketId: string, over: Partial<AdmissionInput> = {}): AdmissionInput => ({
  eventId: EV,
  ticketId,
  code: ticketId,
  scannedAt: '2026-10-07T18:00:00.000Z',
  kid: null,
  appVersion: '1.0.0 (7)',
  ...over,
});

async function setup() {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const roster = createRosterStore(db);
  await roster.beginSync(EV, 'full', '2026-10-07T17:00:00Z', { title: null, eventDate: null, requireDynamic: false, total: 2 }, []);
  await roster.writePage(EV, 'full', [row(T1), row(T2)], null);
  await roster.finishSync(EV, 'full');
  let n = 0;
  const outbox = createOutboxStore(db, { newDeviceId: () => `device-${String(++n)}-abcdef` });
  return { db, roster, outbox };
}

describe('outbox store', () => {
  it('records the roster admission and the outbox row together, with rising client_seq', async () => {
    const { roster, outbox } = await setup();
    expect(await outbox.recordAdmission(input(T1))).toEqual({ recorded: true, seq: 1 });
    expect(await outbox.recordAdmission(input(T2))).toEqual({ recorded: true, seq: 2 });
    expect(await roster.ticket(EV, T1)).toMatchObject({ checkedInAt: '2026-10-07T18:00:00.000Z', byMe: true });
    expect((await outbox.due(EV, 0, 10)).map((i) => i.seq)).toEqual([1, 2]);
  });

  it('a second admission of the same ticket is refused with the stored ticket', async () => {
    const { outbox } = await setup();
    await outbox.recordAdmission(input(T1));
    const again = await outbox.recordAdmission(input(T1, { code: 'BH2.other' }));
    expect(again).toMatchObject({ recorded: false, ticket: { id: T1, byMe: true } });
    expect(await outbox.due(EV, 0, 10)).toHaveLength(1);
  });

  it('nothing is written when the outbox insert fails (one transaction)', async () => {
    const { db, roster, outbox } = await setup();
    await db.exec('DROP TABLE outbox');
    await expect(outbox.recordAdmission(input(T1))).rejects.toThrow();
    expect(await roster.ticket(EV, T1)).toMatchObject({ checkedInAt: null });
  });

  it('the device id is generated once and kept', async () => {
    const { outbox } = await setup();
    const a = await outbox.deviceId();
    expect(await outbox.deviceId()).toBe(a);
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it('due respects order, state and next_try_at; sending items reset at startup', async () => {
    const { outbox } = await setup();
    await outbox.recordAdmission(input(T1));
    await outbox.recordAdmission(input(T2));
    await outbox.markSending([1]);
    expect((await outbox.due(EV, 0, 10)).map((i) => i.seq)).toEqual([2]);
    await outbox.retryLater([2], 5_000);
    expect(await outbox.due(EV, 4_999, 10)).toEqual([]);
    expect((await outbox.due(EV, 5_000, 10))[0]).toMatchObject({ seq: 2, attempts: 1 });
    await outbox.resetSending();
    expect((await outbox.due(EV, 5_000, 10)).map((i) => i.seq)).toEqual([1, 2]);
  });

  it('settle, attention, status and totals', async () => {
    const { outbox } = await setup();
    await outbox.recordAdmission(input(T1));
    await outbox.recordAdmission(input(T2));
    await outbox.settle([{ seq: 1, state: 'duplicate', result: { scanned_by: 'Ada' } }]);
    expect(await outbox.status(EV)).toEqual({ pending: 1, attention: 1, blocked: false, nextTryAt: 0 });
    expect(await outbox.attention(EV)).toEqual([
      expect.objectContaining({ seq: 1, state: 'duplicate', result: { scanned_by: 'Ada' }, ticketType: 'Regular' }),
    ]);
    await outbox.markSending([2]);
    expect(await outbox.totals()).toEqual({ unsynced: 1, unsyncable: 0 });
    expect(await outbox.eventsWithUnsynced()).toEqual([EV]);
  });

  it('a revoked assignment blocks the unsynced items; they count as unsyncable', async () => {
    const { outbox } = await setup();
    await outbox.recordAdmission(input(T1));
    await outbox.blockEvent(EV);
    expect(await outbox.status(EV)).toMatchObject({ pending: 0, blocked: true });
    expect(await outbox.totals()).toEqual({ unsynced: 0, unsyncable: 1 });
    expect(await outbox.hasUnsynced(EV)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/gate/offline/__tests__/outboxStore.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/features/gate/offline/outboxStore.ts`**

```ts
import type { RosterTicket } from '@/features/gate/domain/offlineDecide';
import type { Sql } from '@/shared/db/sql';

import { readTicket } from './rosterStore';

export type OutboxState =
  | 'pending'
  | 'sending'
  | 'synced'
  | 'duplicate'
  | 'suspect'
  | 'rejected'
  | 'blocked'
  | 'error';

export type OutboxItem = {
  seq: number;
  eventId: string;
  ticketId: string;
  code: string;
  scannedAt: string;
  mode: 'offline';
  kid: string | null;
  appVersion: string;
  state: OutboxState;
  attempts: number;
  nextTryAt: number;
  result: Record<string, unknown> | null;
};
export type AttentionItem = OutboxItem & { ticketType: string | null; ticketIndex: number | null };
export type AdmissionInput = {
  eventId: string;
  ticketId: string;
  code: string;
  scannedAt: string;
  kid: string | null;
  appVersion: string;
};
export type RecordResult =
  | { recorded: true; seq: number }
  | { recorded: false; ticket: RosterTicket | null };

const STATES: readonly OutboxState[] = [
  'pending',
  'sending',
  'synced',
  'duplicate',
  'suspect',
  'rejected',
  'blocked',
  'error',
];
const ATTENTION = "('duplicate', 'suspect', 'rejected', 'blocked', 'error')";
const UNSYNCED = "('pending', 'sending')";
const UNSYNCABLE = "('blocked', 'error')";

type ItemSqlRow = {
  client_seq: number;
  event_id: string;
  ticket_id: string;
  code: string;
  scanned_at: string;
  kid: string | null;
  app_version: string;
  state: string;
  attempts: number;
  next_try_at: number;
  result: string | null;
};

function parseResult(text: string | null): Record<string, unknown> | null {
  if (text === null) return null;
  try {
    const v: unknown = JSON.parse(text);
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const toItem = (r: ItemSqlRow): OutboxItem => ({
  seq: r.client_seq,
  eventId: r.event_id,
  ticketId: r.ticket_id,
  code: r.code,
  scannedAt: r.scanned_at,
  mode: 'offline',
  kid: r.kid,
  appVersion: r.app_version,
  state: STATES.find((s) => s === r.state) ?? 'error',
  attempts: r.attempts,
  nextTryAt: r.next_try_at,
  result: parseResult(r.result),
});

const marks = (n: number) => Array.from({ length: n }, () => '?').join(', ');

export function createOutboxStore(db: Sql, deps: { newDeviceId: () => string }) {
  return {
    // Write-ahead (FR-3.10): the admission and its outbox row commit together, and only then may
    // the caller show "Admitted". The conditional update makes a concurrent second scan lose.
    recordAdmission: (input: AdmissionInput): Promise<RecordResult> =>
      db.tx(async (t): Promise<RecordResult> => {
        const u = await t.run(
          'UPDATE roster_ticket SET checked_in_at = ?, by_me = 1, scanned_by = NULL WHERE event_id = ? AND id = ? AND checked_in_at IS NULL',
          [input.scannedAt, input.eventId, input.ticketId],
        );
        if (u.changes === 0) {
          return { recorded: false, ticket: await readTicket(t, input.eventId, input.ticketId) };
        }
        const r = await t.get<{ seq: number }>(
          `INSERT INTO outbox (event_id, ticket_id, code, scanned_at, mode, kid, app_version, state)
           VALUES (?, ?, ?, ?, 'offline', ?, ?, 'pending') RETURNING client_seq AS seq`,
          [input.eventId, input.ticketId, input.code, input.scannedAt, input.kid, input.appVersion],
        );
        if (r === null) throw new Error('outbox insert returned no row');
        return { recorded: true, seq: r.seq };
      }),

    deviceId: (): Promise<string> =>
      db.tx(async (t) => {
        const r = await t.get<{ v: string }>("SELECT v FROM device WHERE k = 'device_id'");
        if (r !== null) return r.v;
        const id = deps.newDeviceId();
        await t.run("INSERT INTO device (k, v) VALUES ('device_id', ?)", [id]);
        return id;
      }),

    due: async (eventId: string, nowMs: number, limit: number): Promise<OutboxItem[]> =>
      (
        await db.all<ItemSqlRow>(
          "SELECT * FROM outbox WHERE event_id = ? AND state = 'pending' AND next_try_at <= ? ORDER BY client_seq LIMIT ?",
          [eventId, nowMs, limit],
        )
      ).map(toItem),

    markSending: async (seqs: number[]): Promise<void> => {
      if (seqs.length === 0) return;
      await db.run(`UPDATE outbox SET state = 'sending' WHERE client_seq IN (${marks(seqs.length)})`, seqs);
    },

    settle: (
      updates: { seq: number; state: OutboxState; result: Record<string, unknown> | null }[],
    ): Promise<void> =>
      db.tx(async (t) => {
        for (const u of updates) {
          await t.run('UPDATE outbox SET state = ?, result = ? WHERE client_seq = ?', [
            u.state,
            u.result === null ? null : JSON.stringify(u.result),
            u.seq,
          ]);
        }
      }),

    retryLater: async (seqs: number[], nextTryAt: number): Promise<void> => {
      if (seqs.length === 0) return;
      await db.run(
        `UPDATE outbox SET state = 'pending', attempts = attempts + 1, next_try_at = ? WHERE client_seq IN (${marks(seqs.length)})`,
        [nextTryAt, ...seqs],
      );
    },

    // A crash mid-send leaves items "sending"; the batch endpoint is idempotent on client_seq.
    resetSending: async (): Promise<void> => {
      await db.run("UPDATE outbox SET state = 'pending' WHERE state = 'sending'");
    },

    blockEvent: async (eventId: string): Promise<void> => {
      await db.run(`UPDATE outbox SET state = 'blocked' WHERE event_id = ? AND state IN ${UNSYNCED}`, [eventId]);
    },

    status: async (eventId: string) => {
      const r = await db.get<{ pending: number | null; attention: number | null; blocked: number | null; next: number | null }>(
        `SELECT sum(state IN ${UNSYNCED}) AS pending, sum(state IN ${ATTENTION}) AS attention,
                sum(state = 'blocked') AS blocked,
                min(CASE WHEN state = 'pending' THEN next_try_at END) AS next
         FROM outbox WHERE event_id = ?`,
        [eventId],
      );
      return {
        pending: r?.pending ?? 0,
        attention: r?.attention ?? 0,
        blocked: (r?.blocked ?? 0) > 0,
        nextTryAt: r?.next ?? null,
      };
    },

    attention: async (eventId: string): Promise<AttentionItem[]> =>
      (
        await db.all<ItemSqlRow & { ticket_type: string | null; ticket_index: number | null }>(
          `SELECT o.*, r.ticket_type, r.ticket_index FROM outbox o
           LEFT JOIN roster_ticket r ON r.event_id = o.event_id AND r.id = o.ticket_id
           WHERE o.event_id = ? AND o.state IN ${ATTENTION} ORDER BY o.client_seq DESC`,
          [eventId],
        )
      ).map((r) => ({ ...toItem(r), ticketType: r.ticket_type, ticketIndex: r.ticket_index })),

    totals: async () => {
      const r = await db.get<{ unsynced: number | null; unsyncable: number | null }>(
        `SELECT sum(state IN ${UNSYNCED}) AS unsynced, sum(state IN ${UNSYNCABLE}) AS unsyncable FROM outbox`,
      );
      return { unsynced: r?.unsynced ?? 0, unsyncable: r?.unsyncable ?? 0 };
    },

    eventsWithUnsynced: async (): Promise<string[]> =>
      (await db.all<{ event_id: string }>(`SELECT DISTINCT event_id FROM outbox WHERE state IN ${UNSYNCED}`)).map(
        (r) => r.event_id,
      ),

    hasUnsynced: async (eventId: string): Promise<boolean> =>
      (await db.get<{ one: number }>(
        `SELECT 1 AS one FROM outbox WHERE event_id = ? AND state IN ${UNSYNCED} LIMIT 1`,
        [eventId],
      )) !== null,
  };
}

export type OutboxStore = ReturnType<typeof createOutboxStore>;
```
Note: `status()` returns `nextTryAt: 0` for the test's fresh pending item because `next_try_at` defaults to 0.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/gate/offline && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/offline/outboxStore.ts src/features/gate/offline/__tests__/outboxStore.test.ts
git commit -m "feat(gate): write-ahead outbox store"
```

---

### Task 10: Roster API and roster sync

**Files:**
- Create: `src/features/gate/schemas/roster.ts`, `src/features/gate/api/roster.ts`, `src/features/gate/offline/rosterSync.ts`
- Test: `src/features/gate/offline/__tests__/rosterSync.test.ts`

**Interfaces:**
- Consumes: `RosterStore`, `RosterRow`, `SyncKind` (Task 8); `ApiClient` request; `Result`, `ApiError`.
- Produces:
```ts
// schemas/roster.ts
export const rosterPage: z.ZodType<RosterPage>;  // via z.object
export type RosterPage = z.infer<typeof rosterPage>;
export function toRosterRows(tickets: unknown[]): { rows: RosterRow[]; dropped: number };
// api/roster.ts
export const ROSTER_TIMEOUT_MS = 30_000;
export function fetchRosterPage(client: Pick<ApiClient, 'request'>, eventId: string,
  p: { cursor: string | null; since: string | null; limit: number }): Promise<Result<RosterPage, ApiError>>;
// offline/rosterSync.ts
export type FetchRosterPage = (p: { cursor: string | null; since: string | null; limit: number }) => Promise<Result<RosterPage, ApiError>>;
export type RosterSyncResult = { ok: true; kind: SyncKind } | { ok: false; error: ApiError };
export function syncRoster(deps: { store: RosterStore; fetchPage: FetchRosterPage; eventId: string;
  onProgress?: (p: { done: number; total: number }) => void; pageSize?: number }, requested: SyncKind): Promise<RosterSyncResult>;
export function refreshKeys(deps: { store: RosterStore; fetchPage: FetchRosterPage; eventId: string }): Promise<boolean>;
```

Contract (web `origin/main` `c8fe25e8`): `GET /api/events/{id}/scan/roster?cursor&limit&since` → `{ok, event:{id,title,event_date,require_dynamic_ticket,total,admitted}, tickets:[{id,ticket_type,ticket_index,booking_id,booking_status,checked_in_at,scanned_by,by_me,holder_name,phone_masked,seat}], next_after, server_time}`; first page (no cursor) also `keys`, optional `keys_error`, `override`. Tickets of **every** booking status. `since` = created or checked in strictly after. Unknown event → 403.

- [ ] **Step 1: Failing tests** — `src/features/gate/offline/__tests__/rosterSync.test.ts`:
```ts
import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { createRosterStore } from '@/features/gate/offline/rosterStore';
import { refreshKeys, syncRoster, type FetchRosterPage } from '@/features/gate/offline/rosterSync';
import { MIGRATIONS } from '@/features/gate/offline/schema';
import type { RosterPage } from '@/features/gate/schemas/roster';
import { toRosterRows } from '@/features/gate/schemas/roster';
import { err, ok } from '@/shared/lib/result';

const EV = 'e0000000-0000-4000-8000-000000000001';
const t = (n: number) => ({
  id: `00000000-0000-4000-8000-00000000000${String(n)}`,
  ticket_type: 'Regular',
  ticket_index: n,
  booking_id: 'b0000000-0000-4000-8000-000000000001',
  booking_status: 'confirmed',
  checked_in_at: null,
  scanned_by: null,
  by_me: null,
  holder_name: null,
  phone_masked: '0803••••210',
  seat: null,
});
const event = { id: EV, title: 'Gala', event_date: '2026-10-10', require_dynamic_ticket: false, total: 3, admitted: 0 };
const page = (tickets: unknown[], next: string | null, over: Partial<RosterPage> = {}): RosterPage => ({
  event,
  tickets,
  next_after: next,
  server_time: '2026-10-07T18:00:00.000000+00:00',
  ...over,
});

async function setup(pages: Parameters<FetchRosterPage>[0][] = []) {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const store = createRosterStore(db);
  const calls = pages;
  return { store, calls };
}

describe('syncRoster', () => {
  it('downloads every page, then the list is ready', async () => {
    const { store, calls } = await setup();
    const responses = [
      ok(page([t(1), t(2)], t(2).id, { keys: [{ kid: 't', publicKey: 'k', signing: true }] })),
      ok(page([t(3)], null)),
    ];
    const fetchPage: FetchRosterPage = (p) => {
      calls.push(p);
      return Promise.resolve(responses.shift() ?? err({ kind: 'network' }));
    };
    const progress: number[] = [];
    const r = await syncRoster({ store, fetchPage, eventId: EV, onProgress: (p) => progress.push(p.done) }, 'delta');
    expect(r).toEqual({ ok: true, kind: 'full' });
    expect(calls.map((c) => c.cursor)).toEqual([null, t(2).id]);
    expect(calls[0]?.since).toBeNull();
    expect(progress).toEqual([2, 3]);
    expect(await store.meta(EV)).toMatchObject({ ready: true, keys: [{ kid: 't', publicKey: 'k' }] });
    expect(await store.counts(EV)).toEqual({ admitted: 0, total: 3 });
  });

  it('an interrupted download resumes from the saved cursor', async () => {
    const { store, calls } = await setup();
    const fetchPage: FetchRosterPage = (p) => {
      calls.push(p);
      return Promise.resolve(p.cursor === null ? ok(page([t(1)], t(1).id)) : err({ kind: 'timeout' }));
    };
    expect(await syncRoster({ store, fetchPage, eventId: EV }, 'full')).toEqual({ ok: false, error: { kind: 'timeout' } });
    const resumed: FetchRosterPage = (p) => {
      calls.push(p);
      return Promise.resolve(ok(page([t(2)], null)));
    };
    expect(await syncRoster({ store, fetchPage: resumed, eventId: EV }, 'delta')).toEqual({ ok: true, kind: 'full' });
    expect(calls.map((c) => c.cursor)).toEqual([null, t(1).id, t(1).id]);
    expect(await store.counts(EV)).toEqual({ admitted: 0, total: 2 });
  });

  it('a delta asks for changes since the last sync and keeps the keys when the server has a key error', async () => {
    const { store, calls } = await setup();
    const first: FetchRosterPage = () =>
      Promise.resolve(ok(page([t(1)], null, { keys: [{ kid: 't', publicKey: 'k', signing: true }] })));
    await syncRoster({ store, fetchPage: first, eventId: EV }, 'full');
    const delta: FetchRosterPage = (p) => {
      calls.push(p);
      return Promise.resolve(ok(page([t(2)], null, { keys: [], keys_error: true, server_time: '2026-10-07T18:03:00Z' })));
    };
    expect(await syncRoster({ store, fetchPage: delta, eventId: EV }, 'delta')).toEqual({ ok: true, kind: 'delta' });
    expect(calls[0]?.since).toBe('2026-10-07T18:00:00.000000+00:00');
    expect(await store.meta(EV)).toMatchObject({ keys: [{ kid: 't', publicKey: 'k' }], sinceMark: '2026-10-07T18:03:00Z' });
  });

  it('refreshKeys fetches one row and stores the key set', async () => {
    const { store } = await setup();
    const first: FetchRosterPage = () => Promise.resolve(ok(page([t(1)], null, { keys: [] })));
    await syncRoster({ store, fetchPage: first, eventId: EV }, 'full');
    const keysOnly: FetchRosterPage = (p) =>
      Promise.resolve(ok(page(p.limit === 1 ? [t(1)] : [], null, { keys: [{ kid: 'u', publicKey: 'n', signing: true }] })));
    expect(await refreshKeys({ store, fetchPage: keysOnly, eventId: EV })).toBe(true);
    expect((await store.meta(EV))?.keys).toEqual([{ kid: 'u', publicKey: 'n' }]);
  });
});

describe('toRosterRows', () => {
  it('maps fields and drops rows that are not tickets', () => {
    expect(toRosterRows([t(1), { id: 5 }])).toEqual({
      rows: [expect.objectContaining({ id: t(1).id, bookingStatus: 'confirmed', phoneMasked: '0803••••210' })],
      dropped: 1,
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/gate/offline/__tests__/rosterSync.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

`src/features/gate/schemas/roster.ts`:
```ts
import { z } from 'zod';

import type { RosterRow } from '@/features/gate/offline/rosterStore';

const nullString = z.string().nullable().catch(null);

// One bad row must not fail the page: it is dropped, and a dropped ticket is refused offline
// ("not in offline list"), which fails closed.
const rosterTicket = z.object({
  id: z.string().min(1),
  ticket_type: nullString,
  ticket_index: z.number().int().nullable().catch(null),
  booking_id: z.string().min(1),
  booking_status: z.string().min(1),
  checked_in_at: z.string().nullable(),
  scanned_by: nullString,
  by_me: z.boolean().nullable().catch(null),
  holder_name: nullString,
  phone_masked: nullString,
  seat: nullString,
});

export const rosterPage = z.object({
  event: z.object({
    id: z.string(),
    title: nullString,
    event_date: nullString,
    // Strict on purpose: guessing false would accept screenshots offline.
    require_dynamic_ticket: z.boolean(),
    total: z.number().int().nonnegative().catch(0),
  }),
  tickets: z.array(z.unknown()),
  next_after: z.string().nullable(),
  server_time: z.string(),
  keys: z
    .array(z.object({ kid: z.string(), publicKey: z.string(), signing: z.boolean().catch(false) }))
    .optional(),
  keys_error: z.boolean().optional(),
});
export type RosterPage = z.infer<typeof rosterPage>;

export function toRosterRows(tickets: unknown[]): { rows: RosterRow[]; dropped: number } {
  const rows: RosterRow[] = [];
  let dropped = 0;
  for (const raw of tickets) {
    const p = rosterTicket.safeParse(raw);
    if (!p.success) {
      dropped += 1;
      continue;
    }
    const r = p.data;
    rows.push({
      id: r.id.toLowerCase(),
      ticketType: r.ticket_type,
      ticketIndex: r.ticket_index,
      bookingId: r.booking_id.toLowerCase(),
      bookingStatus: r.booking_status,
      checkedInAt: r.checked_in_at,
      scannedBy: r.scanned_by,
      byMe: r.by_me,
      holderName: r.holder_name,
      phoneMasked: r.phone_masked,
      seat: r.seat,
    });
  }
  return { rows, dropped };
}
```
(`schemas` importing a type from `offline` is within the gate feature; fine.)

`src/features/gate/api/roster.ts`:
```ts
import { rosterPage, type RosterPage } from '@/features/gate/schemas/roster';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

// A 2,000-row page is a few hundred KB; give slow venue Wi-Fi room.
export const ROSTER_TIMEOUT_MS = 30_000;

export function fetchRosterPage(
  client: Pick<ApiClient, 'request'>,
  eventId: string,
  p: { cursor: string | null; since: string | null; limit: number },
): Promise<Result<RosterPage, ApiError>> {
  const q = [`limit=${String(p.limit)}`];
  if (p.cursor !== null) q.push(`cursor=${encodeURIComponent(p.cursor)}`);
  if (p.since !== null) q.push(`since=${encodeURIComponent(p.since)}`);
  return client.request(`/api/events/${encodeURIComponent(eventId)}/scan/roster?${q.join('&')}`, {
    schema: rosterPage,
    timeoutMs: ROSTER_TIMEOUT_MS,
  });
}
```

`src/features/gate/offline/rosterSync.ts`:
```ts
import type { RosterPage } from '@/features/gate/schemas/roster';
import { toRosterRows } from '@/features/gate/schemas/roster';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

import type { RosterStore, SyncKind } from './rosterStore';

export type FetchRosterPage = (p: {
  cursor: string | null;
  since: string | null;
  limit: number;
}) => Promise<Result<RosterPage, ApiError>>;
export type RosterSyncResult = { ok: true; kind: SyncKind } | { ok: false; error: ApiError };

type Deps = {
  store: RosterStore;
  fetchPage: FetchRosterPage;
  eventId: string;
  onProgress?: (p: { done: number; total: number }) => void;
  pageSize?: number;
};

const infoOf = (p: RosterPage) => ({
  title: p.event.title,
  eventDate: p.event.event_date,
  requireDynamic: p.event.require_dynamic_ticket,
  total: p.event.total,
});
// keys_error: the server's key config is broken; keep the keys we have rather than erase them.
const keysOf = (p: RosterPage) =>
  p.keys === undefined || p.keys_error === true
    ? null
    : p.keys.map((k) => ({ kid: k.kid, publicKey: k.publicKey }));

// Spec §3: pages of ≤ 2000, one transaction per page with its cursor, resumable. A full sync is
// staged and swapped in at the end; a delta merges into the live list.
export async function syncRoster(deps: Deps, requested: SyncKind): Promise<RosterSyncResult> {
  const { store, eventId } = deps;
  const meta = await store.meta(eventId);
  const interruptedFull = meta?.syncKind === 'full' && meta.cursor !== null;
  const kind: SyncKind =
    !interruptedFull && requested === 'delta' && meta?.ready === true && meta.sinceMark !== null
      ? 'delta'
      : 'full';
  let cursor = meta?.syncKind === kind ? meta.cursor : null;
  const since = kind === 'delta' ? (meta?.sinceMark ?? null) : null;
  let done = 0;
  for (;;) {
    const r = await deps.fetchPage({ cursor, since, limit: deps.pageSize ?? 2000 });
    if (!r.ok) return { ok: false, error: r.error };
    const page = r.value;
    if (cursor === null) await store.beginSync(eventId, kind, page.server_time, infoOf(page), keysOf(page));
    const { rows } = toRosterRows(page.tickets);
    await store.writePage(eventId, kind, rows, page.next_after);
    done += rows.length;
    deps.onProgress?.({ done, total: page.event.total });
    if (page.next_after === null) {
      await store.finishSync(eventId, kind);
      return { ok: true, kind };
    }
    cursor = page.next_after;
  }
}

/** Spec §4 rule 3: one small request refreshes the key set when a code names an unknown kid. */
export async function refreshKeys(deps: Omit<Deps, 'onProgress' | 'pageSize'>): Promise<boolean> {
  const r = await deps.fetchPage({ cursor: null, since: null, limit: 1 });
  if (!r.ok) return false;
  const keys = keysOf(r.value);
  if (keys === null) return false;
  await deps.store.setKeys(deps.eventId, keys);
  return true;
}
```
Prefer the roster's first page over `GET /api/ticket-keys` for keys: that route is on the `public` rate tier (60/min per IP), which every phone at a venue shares.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/gate/offline/__tests__/rosterSync.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/schemas/roster.ts src/features/gate/api/roster.ts src/features/gate/offline/rosterSync.ts src/features/gate/offline/__tests__/rosterSync.test.ts
git commit -m "feat(gate): resumable roster download with deltas and key refresh"
```

---

### Task 11: Batch API, reconciliation and outbox sync

**Files:**
- Create: `src/features/gate/schemas/batch.ts`, `src/features/gate/api/batch.ts`, `src/features/gate/domain/syncReconcile.ts`, `src/features/gate/offline/batchSync.ts`
- Test: `src/features/gate/domain/__tests__/syncReconcile.test.ts`, `src/features/gate/offline/__tests__/batchSync.test.ts`

**Interfaces:**
- Consumes: `OutboxStore`, `OutboxItem`, `OutboxState` (Task 9).
- Produces:
```ts
// schemas/batch.ts
export const batchBody; export type BatchBody = z.infer<typeof batchBody>;
export type BatchItemResult = { client_seq: number; ok: boolean; code: string; checked_in_at?: string | null; scanned_by?: string | null; by_me?: boolean | null };
export function batchResults(body: BatchBody): BatchItemResult[];
// api/batch.ts
export type BatchItem = { client_seq: number; ticket_id: string; scanned_at: string; mode: 'offline' };
export function postBatch(client, eventId: string, deviceId: string, items: BatchItem[]): Promise<Result<BatchBody, ApiError>>;
// domain/syncReconcile.ts
export function reconcile(r: BatchItemResult): { state: 'synced' | 'duplicate' | 'suspect' | 'rejected'; result: Record<string, unknown> };
export function backoffMs(attempts: number, random: () => number): number;
// offline/batchSync.ts
export type PostBatch = (deviceId: string, items: BatchItem[]) => Promise<Result<BatchBody, ApiError>>;
export type BatchSyncOutcome = 'idle' | 'retryLater' | 'blocked' | 'error';
export function syncOutbox(deps: { store: OutboxStore; eventId: string; post: PostBatch; now: () => number;
  random: () => number; report: (e: unknown) => void; batchSize?: number }): Promise<BatchSyncOutcome>;
```

Contract: `POST /api/events/{id}/scan/batch` `{device_id, items:[{client_seq, ticket_id, scanned_at, mode}]}`, 1–200 items; idempotent on `(user, device_id, listing, client_seq)` (a replay ignores the new content — never reuse a seq). 200 `{results:[{client_seq, ok, code, replayed, …}]}`; `already_checked_in` adds `checked_in_at, scanned_by (never null), by_me (boolean)`. Whole-request: 400 `bad_request`, 401, 403 `forbidden` (also unknown event), 404 (non-UUID id), 429, 503 `sync_failed`.

- [ ] **Step 1: Failing tests**

`src/features/gate/domain/__tests__/syncReconcile.test.ts`:
```ts
import { backoffMs, reconcile } from '@/features/gate/domain/syncReconcile';

describe('reconcile', () => {
  it('ok is synced', () => {
    expect(reconcile({ client_seq: 1, ok: true, code: 'ok', checked_in_at: 'x' })).toEqual({
      state: 'synced',
      result: { code: 'ok', checked_in_at: 'x' },
    });
  });
  it('already used by this account is a harmless retry', () => {
    expect(reconcile({ client_seq: 1, ok: false, code: 'already_checked_in', by_me: true }).state).toBe('synced');
  });
  it('already used by someone else is a duplicate with their name and time', () => {
    expect(
      reconcile({ client_seq: 1, ok: false, code: 'already_checked_in', by_me: false, scanned_by: 'Ada', checked_in_at: 't' }),
    ).toEqual({ state: 'duplicate', result: { code: 'already_checked_in', scanned_by: 'Ada', checked_in_at: 't' } });
  });
  it('an unknown by_me is surfaced as a duplicate, not guessed away', () => {
    expect(reconcile({ client_seq: 1, ok: false, code: 'already_checked_in', by_me: null }).state).toBe('duplicate');
  });
  it.each(['invalid_code', 'expired_code'])('%s on re-verify is suspect', (code) => {
    expect(reconcile({ client_seq: 1, ok: false, code }).state).toBe('suspect');
  });
  it.each(['not_found', 'wrong_event', 'not_confirmed', 'static_not_allowed', 'bad_timestamp', 'booking_qr', 'bad_item', 'forbidden', 'something_new'])(
    '%s is rejected with its code',
    (code) => {
      expect(reconcile({ client_seq: 1, ok: false, code })).toEqual({ state: 'rejected', result: { code } });
    },
  );
});

describe('backoffMs', () => {
  it('doubles from 2 s, caps at 60 s, jitters within the upper half', () => {
    expect(backoffMs(0, () => 1)).toBe(2_000);
    expect(backoffMs(0, () => 0)).toBe(1_000);
    expect(backoffMs(3, () => 1)).toBe(16_000);
    expect(backoffMs(10, () => 1)).toBe(60_000);
  });
});
```

`src/features/gate/offline/__tests__/batchSync.test.ts`:
```ts
import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import type { BatchItem } from '@/features/gate/api/batch';
import { syncOutbox, type PostBatch } from '@/features/gate/offline/batchSync';
import { createOutboxStore } from '@/features/gate/offline/outboxStore';
import { createRosterStore, type RosterRow } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

const EV = 'e0000000-0000-4000-8000-000000000001';
const id = (n: number) => `00000000-0000-4000-8000-00000000000${String(n)}`;
const row = (n: number): RosterRow => ({
  id: id(n), ticketType: 'Regular', ticketIndex: n, bookingId: 'b0000000-0000-4000-8000-000000000001',
  bookingStatus: 'confirmed', checkedInAt: null, scannedBy: null, byMe: null, holderName: null, phoneMasked: null, seat: null,
});

async function setup(n: number) {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const roster = createRosterStore(db);
  await roster.beginSync(EV, 'full', '2026-10-07T17:00:00Z', { title: null, eventDate: null, requireDynamic: false, total: n }, []);
  await roster.writePage(EV, 'full', Array.from({ length: n }, (_, i) => row(i + 1)), null);
  await roster.finishSync(EV, 'full');
  const store = createOutboxStore(db, { newDeviceId: () => 'device-abcdef12' });
  for (let i = 1; i <= n; i++) {
    await store.recordAdmission({ eventId: EV, ticketId: id(i), code: id(i), scannedAt: '2026-10-07T18:00:00.000Z', kid: null, appVersion: '1' });
  }
  const sent: BatchItem[][] = [];
  const deps = (post: PostBatch) => ({
    store, eventId: EV, now: () => 1_000, random: () => 1, report: jest.fn(), batchSize: 2,
    post: (d: string, items: BatchItem[]) => { sent.push(items); return post(d, items); },
  });
  return { store, sent, deps };
}

const echo = (code = 'ok'): PostBatch => (_d, items) =>
  Promise.resolve(ok({ results: items.map((i) => ({ client_seq: i.client_seq, ok: code === 'ok', code })) }));

describe('syncOutbox', () => {
  it('sends in order in batches and settles every item', async () => {
    const { store, sent, deps } = await setup(3);
    expect(await syncOutbox(deps(echo()))).toBe('idle');
    expect(sent.map((b) => b.map((i) => i.client_seq))).toEqual([[1, 2], [3]]);
    expect(sent[0]?.[0]).toEqual({ client_seq: 1, ticket_id: id(1), scanned_at: '2026-10-07T18:00:00.000Z', mode: 'offline' });
    expect(await store.status(EV)).toMatchObject({ pending: 0, attention: 0 });
  });

  it.each<[ApiError]>([[{ kind: 'network' }], [{ kind: 'timeout' }], [{ kind: 'unavailable', status: 503 }], [{ kind: 'rateLimited' }], [{ kind: 'auth' }], [{ kind: 'validation' }]])(
    'a transient %j keeps the items and backs off',
    async (e) => {
      const { store, deps } = await setup(1);
      expect(await syncOutbox(deps(() => Promise.resolve(err(e))))).toBe('retryLater');
      expect(await store.due(EV, 1_000, 10)).toEqual([]);
      expect((await store.due(EV, 1_000 + 2_000, 10))[0]).toMatchObject({ seq: 1, attempts: 1 });
    },
  );

  it('a whole-request 403 blocks the event', async () => {
    const { store, deps } = await setup(2);
    expect(await syncOutbox(deps(() => Promise.resolve(err({ kind: 'forbidden', code: 'forbidden' }))))).toBe('blocked');
    expect(await store.status(EV)).toMatchObject({ pending: 0, blocked: true });
  });

  it('a 400 parks the items as errors and reports, without looping', async () => {
    const { store, deps } = await setup(1);
    const d = deps(() => Promise.resolve(err({ kind: 'unknown', status: 400, code: 'bad_request' })));
    expect(await syncOutbox(d)).toBe('error');
    expect(d.report).toHaveBeenCalled();
    expect(await store.status(EV)).toMatchObject({ pending: 0, attention: 1 });
  });

  it('an item missing from the response stays queued', async () => {
    const { store, deps } = await setup(2);
    const partial: PostBatch = () => Promise.resolve(ok({ results: [{ client_seq: 1, ok: true, code: 'ok' }] }));
    expect(await syncOutbox(deps(partial))).toBe('retryLater');
    expect(await store.status(EV)).toMatchObject({ pending: 1 });
  });

  it('duplicates are kept for attention', async () => {
    const { store, deps } = await setup(1);
    const dup: PostBatch = () =>
      Promise.resolve(ok({ results: [{ client_seq: 1, ok: false, code: 'already_checked_in', by_me: false, scanned_by: 'Ada', checked_in_at: 't' }] }));
    await syncOutbox(deps(dup));
    expect(await store.attention(EV)).toEqual([expect.objectContaining({ state: 'duplicate' })]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/gate/domain/__tests__/syncReconcile.test.ts src/features/gate/offline/__tests__/batchSync.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

`src/features/gate/schemas/batch.ts`:
```ts
import { z } from 'zod';

const itemResult = z.object({
  client_seq: z.number().int(),
  ok: z.boolean(),
  code: z.string(),
  checked_in_at: z.string().nullable().optional(),
  scanned_by: z.string().nullable().optional(),
  by_me: z.boolean().nullable().optional(),
});
export type BatchItemResult = z.infer<typeof itemResult>;

export const batchBody = z.object({ results: z.array(z.unknown()) });
export type BatchBody = z.infer<typeof batchBody>;

/** Unreadable items are left out; batchSync keeps their outbox rows queued. */
export function batchResults(body: BatchBody): BatchItemResult[] {
  return body.results.flatMap((r) => {
    const p = itemResult.safeParse(r);
    return p.success ? [p.data] : [];
  });
}
```

`src/features/gate/api/batch.ts`:
```ts
import { batchBody, type BatchBody } from '@/features/gate/schemas/batch';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

export type BatchItem = { client_seq: number; ticket_id: string; scanned_at: string; mode: 'offline' };

// Idempotent on the server (device_id + client_seq), so the client may retry it.
export function postBatch(
  client: Pick<ApiClient, 'request'>,
  eventId: string,
  deviceId: string,
  items: BatchItem[],
): Promise<Result<BatchBody, ApiError>> {
  return client.request(`/api/events/${encodeURIComponent(eventId)}/scan/batch`, {
    method: 'POST',
    body: { device_id: deviceId, items },
    schema: batchBody,
    idempotent: true,
    timeoutMs: 30_000,
  });
}
```

`src/features/gate/domain/syncReconcile.ts`:
```ts
import type { BatchItemResult } from '@/features/gate/schemas/batch';

export type SettledState = 'synced' | 'duplicate' | 'suspect' | 'rejected';

// Requirements §8.5 table. Nothing here un-admits anyone: duplicates and suspects are surfaced
// for the organiser, never undone on the phone.
export function reconcile(r: BatchItemResult): { state: SettledState; result: Record<string, unknown> } {
  if (r.ok) return { state: 'synced', result: { code: r.code, checked_in_at: r.checked_in_at ?? null } };
  if (r.code === 'already_checked_in') {
    const result = { code: r.code, scanned_by: r.scanned_by ?? null, checked_in_at: r.checked_in_at ?? null };
    return { state: r.by_me === true ? 'synced' : 'duplicate', result };
  }
  if (r.code === 'invalid_code' || r.code === 'expired_code') return { state: 'suspect', result: { code: r.code } };
  return { state: 'rejected', result: { code: r.code } };
}

/** 2 s doubling to 60 s, jittered into the upper half so phones don't retry in lockstep. */
export function backoffMs(attempts: number, random: () => number): number {
  const base = Math.min(60_000, 2_000 * 2 ** attempts);
  return Math.round(base / 2 + (random() * base) / 2);
}
```
Note: `reconcile({ok:true,…})` returns `result: { code, checked_in_at }`; update the first test's expectation to match if you change the shape — keep test and code identical.

`src/features/gate/offline/batchSync.ts`:
```ts
import type { BatchItem } from '@/features/gate/api/batch';
import { backoffMs, reconcile } from '@/features/gate/domain/syncReconcile';
import { batchResults, type BatchBody } from '@/features/gate/schemas/batch';
import { isRetryable, type ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

import type { OutboxItem, OutboxState, OutboxStore } from './outboxStore';

export type PostBatch = (deviceId: string, items: BatchItem[]) => Promise<Result<BatchBody, ApiError>>;
export type BatchSyncOutcome = 'idle' | 'retryLater' | 'blocked' | 'error';

type Deps = {
  store: OutboxStore;
  eventId: string;
  post: PostBatch;
  /** Local wall clock: next_try_at is compared with it. */
  now: () => number;
  random: () => number;
  report: (e: unknown) => void;
  batchSize?: number;
};

const toBatchItem = (i: OutboxItem): BatchItem => ({
  client_seq: i.seq,
  ticket_id: i.code,
  scanned_at: i.scannedAt,
  mode: i.mode,
});

// auth: the client already refreshed once; validation: a 200 we couldn't read may have committed,
// and resending is safe because the endpoint is idempotent.
const keepAndRetry = (e: ApiError) =>
  isRetryable(e) || e.kind === 'auth' || e.kind === 'aborted' || e.kind === 'validation';

export async function syncOutbox(deps: Deps): Promise<BatchSyncOutcome> {
  const size = deps.batchSize ?? 200;
  for (;;) {
    const items = await deps.store.due(deps.eventId, deps.now(), size);
    if (items.length === 0) return 'idle';
    const seqs = items.map((i) => i.seq);
    const later = () => deps.now() + backoffMs(Math.max(...items.map((i) => i.attempts)), deps.random);
    await deps.store.markSending(seqs);
    const res = await deps.post(await deps.store.deviceId(), items.map(toBatchItem));
    if (!res.ok) {
      const e = res.error;
      if (e.kind === 'forbidden') {
        await deps.store.blockEvent(deps.eventId);
        return 'blocked';
      }
      if (keepAndRetry(e)) {
        await deps.store.retryLater(seqs, later());
        return 'retryLater';
      }
      // A 400/404 is our bug (bad request shape or event id): park the items, report, don't loop.
      await deps.store.settle(seqs.map((seq) => ({ seq, state: 'error' as OutboxState, result: { kind: e.kind } })));
      deps.report(new Error(`batch sync failed: ${e.kind}`));
      return 'error';
    }
    const bySeq = new Map(batchResults(res.value).map((r) => [r.client_seq, r] as const));
    const settled: { seq: number; state: OutboxState; result: Record<string, unknown> }[] = [];
    const missing: number[] = [];
    for (const i of items) {
      const r = bySeq.get(i.seq);
      if (r === undefined) missing.push(i.seq);
      else settled.push({ seq: i.seq, ...reconcile(r) });
    }
    await deps.store.settle(settled);
    if (missing.length > 0) {
      await deps.store.retryLater(missing, later());
      return 'retryLater';
    }
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/gate/domain/__tests__/syncReconcile.test.ts src/features/gate/offline/__tests__/batchSync.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/schemas/batch.ts src/features/gate/api/batch.ts src/features/gate/domain/syncReconcile.ts src/features/gate/offline/batchSync.ts src/features/gate/domain/__tests__/syncReconcile.test.ts src/features/gate/offline/__tests__/batchSync.test.ts
git commit -m "feat(gate): batch sync of offline admissions with reconciliation"
```

---

### Task 12: Offline gate (decide, write-ahead, learn from live scans)

**Files:**
- Create: `src/features/gate/offline/offlineGate.ts`
- Test: `src/features/gate/offline/__tests__/offlineGate.test.ts`

**Interfaces:**
- Consumes: `decideOffline`, `ticketIdOf` (Task 6); `RosterStore` (Task 8); `OutboxStore` (Task 9); `ClockState` (Task 3); `ScanOutcome`.
- Produces:
```ts
export type OfflineGateDeps = {
  eventId: string; roster: RosterStore; outbox: OutboxStore;
  serverNow: () => number; clockState: () => ClockState; appVersion: string;
  onKeysOutdated: () => void; onAdmitted: () => void;
};
export function createOfflineGate(deps: OfflineGateDeps): {
  decide: (code: TicketCode) => Promise<ScanOutcome>;
  noteLive: (code: TicketCode, outcome: ScanOutcome) => Promise<void>;
};
export type OfflineGate = ReturnType<typeof createOfflineGate>;
```

- [ ] **Step 1: Failing tests** — `src/features/gate/offline/__tests__/offlineGate.test.ts`:
```ts
import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { parseTicketCode, type TicketCode } from '@/features/gate/domain/parseTicketCode';
import { createOfflineGate } from '@/features/gate/offline/offlineGate';
import { createOutboxStore } from '@/features/gate/offline/outboxStore';
import { createRosterStore, type RosterRow } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';
import { BH2_AT, BH2_ID, BH2_KEYS, BH2_TOKEN } from '@/features/gate/domain/__tests__/bh2Vector';

const EV = 'e0000000-0000-4000-8000-000000000001';
const BOOKING = 'b0000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000009';
const code = (raw: string): TicketCode => {
  const p = parseTicketCode(raw);
  if (!p) throw new Error('bad fixture');
  return p.value;
};
const row = (id: string, index: number): RosterRow => ({
  id, ticketType: 'Regular', ticketIndex: index, bookingId: BOOKING, bookingStatus: 'confirmed',
  checkedInAt: null, scannedBy: null, byMe: null, holderName: null, phoneMasked: null, seat: null,
});

async function setup(opts: { ready?: boolean } = {}) {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const roster = createRosterStore(db);
  const outbox = createOutboxStore(db, { newDeviceId: () => 'device-abcdef12' });
  await roster.beginSync(EV, 'full', '2026-10-07T17:00:00Z', { title: null, eventDate: null, requireDynamic: false, total: 2 }, BH2_KEYS);
  await roster.writePage(EV, 'full', [row(BH2_ID, 1), row(OTHER, 2)], null);
  if (opts.ready !== false) await roster.finishSync(EV, 'full');
  const onKeysOutdated = jest.fn();
  const onAdmitted = jest.fn();
  const gate = createOfflineGate({
    eventId: EV, roster, outbox, serverNow: () => BH2_AT, clockState: () => ({ suspect: false, checkedAgoMs: 0 }),
    appVersion: '1.0.0 (7)', onKeysOutdated, onAdmitted,
  });
  return { roster, outbox, gate, onKeysOutdated, onAdmitted };
}

describe('offline gate', () => {
  it('admits a valid BH2, writing the outbox before answering', async () => {
    const { outbox, gate, onAdmitted } = await setup();
    const o = await gate.decide(code(BH2_TOKEN));
    expect(o).toEqual({
      kind: 'admitted', offline: true, ticketType: 'Regular', ticketIndex: 1, totalTickets: 2, checkedInCount: 1,
      checkedInAt: new Date(BH2_AT).toISOString(),
    });
    expect(await outbox.due(EV, 0, 10)).toEqual([
      expect.objectContaining({ ticketId: BH2_ID, code: BH2_TOKEN, kid: 't', scannedAt: new Date(BH2_AT).toISOString() }),
    ]);
    expect(onAdmitted).toHaveBeenCalledTimes(1);
  });

  it('the same ticket as a printed code right after is already used by you', async () => {
    const { gate } = await setup();
    await gate.decide(code(BH2_TOKEN));
    expect(await gate.decide(code(BH2_ID))).toMatchObject({ kind: 'used', scannedBy: { kind: 'me' } });
  });

  it('two presentations of one ticket at once admit exactly once', async () => {
    const { outbox, gate } = await setup();
    const [a, b] = await Promise.all([gate.decide(code(BH2_TOKEN)), gate.decide(code(BH2_ID))]);
    expect([a.kind, b.kind].sort()).toEqual(['admitted', 'used']);
    expect(await outbox.due(EV, 0, 10)).toHaveLength(1);
  });

  it('no finished list yet → couldnt check, nothing written', async () => {
    const { outbox, gate } = await setup({ ready: false });
    expect(await gate.decide(code(BH2_ID))).toEqual({ kind: 'couldntCheck', cause: 'noOfflineList' });
    expect(await outbox.due(EV, 0, 10)).toEqual([]);
  });

  it('a full refresh in progress does not hide the current list', async () => {
    const { roster, gate } = await setup();
    await roster.beginSync(EV, 'full', '2026-10-07T18:00:00Z', { title: null, eventDate: null, requireDynamic: false, total: 0 }, null);
    expect((await gate.decide(code(OTHER))).kind).toBe('admitted');
  });

  it('a booking code and an unknown ticket are refused differently', async () => {
    const { gate } = await setup();
    expect(await gate.decide(code(BOOKING))).toMatchObject({ kind: 'refused', reason: 'oldFormat' });
    expect(await gate.decide(code('00000000-0000-4000-8000-0000000000ff'))).toMatchObject({
      kind: 'refused', reason: 'notInList', listUpdatedAt: Date.parse('2026-10-07T17:00:00Z'),
    });
  });

  it('an unknown key asks for a key refresh', async () => {
    const { roster, gate, onKeysOutdated } = await setup();
    await roster.setKeys(EV, []);
    expect(await gate.decide(code(BH2_TOKEN))).toEqual({ kind: 'couldntCheck', cause: 'keysOutdated' });
    expect(onKeysOutdated).toHaveBeenCalled();
  });

  it('live answers teach the list', async () => {
    const { roster, gate } = await setup();
    await gate.noteLive(code(OTHER), {
      kind: 'used', checkedInAt: '2026-10-07T18:00:00Z', scannedBy: { kind: 'named', name: 'Ada' }, ticketType: null, replayed: false,
    });
    expect(await roster.ticket(EV, OTHER)).toMatchObject({ checkedInAt: '2026-10-07T18:00:00Z', scannedBy: 'Ada', byMe: false });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/gate/offline/__tests__/offlineGate.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/features/gate/offline/offlineGate.ts`**

```ts
import { decideOffline, ticketIdOf } from '@/features/gate/domain/offlineDecide';
import type { ScanOutcome, ScannedBy } from '@/features/gate/domain/outcome';
import type { TicketCode } from '@/features/gate/domain/parseTicketCode';
import type { ClockState } from '@/shared/lib/clockGuard';

import type { OutboxStore } from './outboxStore';
import type { RosterStore } from './rosterStore';

export type OfflineGateDeps = {
  eventId: string;
  roster: RosterStore;
  outbox: OutboxStore;
  serverNow: () => number;
  clockState: () => ClockState;
  appVersion: string;
  onKeysOutdated: () => void;
  onAdmitted: () => void;
};

const byOf = (byMe: boolean | null, name: string | null): ScannedBy => {
  if (byMe !== false) return { kind: 'me' };
  return name === null || name.trim() === '' ? { kind: 'unknown' } : { kind: 'named', name };
};

export function createOfflineGate(deps: OfflineGateDeps) {
  const { eventId } = deps;

  async function decide(code: TicketCode): Promise<ScanOutcome> {
    const meta = await deps.roster.meta(eventId);
    if (meta === null || !meta.ready) return { kind: 'couldntCheck', cause: 'noOfflineList' };
    const id = ticketIdOf(code);
    const ticket = id === null ? null : await deps.roster.ticket(eventId, id);
    const isBookingId =
      id !== null && ticket === null && !code.startsWith('BH') && (await deps.roster.hasBooking(eventId, id));
    const nowMs = deps.serverNow();
    const d = decideOffline(code, {
      ticket,
      isBookingId,
      requireDynamic: meta.requireDynamic,
      keys: meta.keys,
      clockSuspect: deps.clockState().suspect,
      nowMs,
      listUpdatedAt: meta.syncedAt ?? 0,
    });
    if (d.kind === 'outcome') {
      if (d.outcome.kind === 'couldntCheck' && d.outcome.cause === 'keysOutdated') deps.onKeysOutdated();
      return d.outcome;
    }

    const scannedAt = new Date(nowMs).toISOString();
    // Write-ahead: this resolves only after the outbox row has committed.
    const rec = await deps.outbox.recordAdmission({
      eventId,
      ticketId: d.ticketId,
      code,
      scannedAt,
      kid: d.kid,
      appVersion: deps.appVersion,
    });
    if (!rec.recorded) {
      // The same ticket, presented another way, won the race a moment ago.
      const t = rec.ticket;
      return {
        kind: 'used',
        checkedInAt: t?.checkedInAt ?? scannedAt,
        scannedBy: byOf(t?.byMe ?? null, t?.scannedBy ?? null),
        ticketType: t?.ticketType ?? null,
        replayed: false,
      };
    }
    deps.onAdmitted();
    // Group context is a nicety: a failed read must not turn a recorded admission into an error.
    let progress: { total: number; checkedIn: number } | null = null;
    try {
      if (ticket !== null) progress = await deps.roster.bookingProgress(eventId, ticket.bookingId);
    } catch {
      progress = null;
    }
    return {
      kind: 'admitted',
      offline: true,
      ticketType: ticket?.ticketType ?? null,
      ticketIndex: ticket?.ticketIndex ?? null,
      totalTickets: progress?.total ?? null,
      checkedInCount: progress?.checkedIn ?? null,
      checkedInAt: scannedAt,
    };
  }

  // Spec decision 7: what the server says online keeps the offline list true.
  async function noteLive(code: TicketCode, outcome: ScanOutcome): Promise<void> {
    if (outcome.kind !== 'admitted' && outcome.kind !== 'used') return;
    if (outcome.kind === 'admitted' && outcome.offline === true) return;
    const id = ticketIdOf(code);
    if (id === null) return;
    const at = outcome.checkedInAt ?? new Date(deps.serverNow()).toISOString();
    if (outcome.kind === 'admitted') {
      await deps.roster.markCheckedIn(eventId, id, at, true, null);
      return;
    }
    const by = outcome.scannedBy;
    await deps.roster.markCheckedIn(
      eventId,
      id,
      at,
      by.kind === 'me' ? true : by.kind === 'unknown' ? null : false,
      by.kind === 'named' ? by.name : null,
    );
  }

  return { decide, noteLive };
}

export type OfflineGate = ReturnType<typeof createOfflineGate>;
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/gate/offline/__tests__/offlineGate.test.ts && npx tsc --noEmit`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/offline/offlineGate.ts src/features/gate/offline/__tests__/offlineGate.test.ts
git commit -m "feat(gate): offline decisions with write-ahead admission"
```

---

### Task 13: Scan queue falls back to the offline decision

**Files:**
- Modify: `src/features/gate/domain/scanQueue.ts`
- Test: `src/features/gate/domain/__tests__/scanQueue.test.ts` (add a `describe`)

**Interfaces:**
- Produces: `ScanQueueDeps` gains
```ts
  fallback?: (code: TicketCode) => Promise<ScanOutcome>;
  skipOnline?: () => boolean;
  onLive?: (code: TicketCode, outcome: ScanOutcome) => void;
```
`ScanSessionDeps` inherits them unchanged (it is `Omit<ScanQueueDeps, 'onResult'> & …`).

Rules: fall back only when the final live result is `network`, `timeout` or `unavailable` (5xx) after retries — **not** 429, auth, or any server refusal. `skipOnline()` → decide locally first; if that says `noOfflineList`, try the server anyway. A throwing fallback = the live outcome stands. `onLive` fires for every non-transient live result.

- [ ] **Step 1: Failing tests** — append to `scanQueue.test.ts` (uses the file's `harness`, `code`, `ADMIT`, `NETWORK`, `TIMEOUT`, `fail`, `flush`; read the harness first and adapt names if they differ — e.g. how it resolves `pending` submissions and exposes `results`):
```ts
describe('offline fallback (Phase 2a)', () => {
  const OFFLINE_ADMIT: ScanOutcome = {
    kind: 'admitted', offline: true, ticketType: null, ticketIndex: null, totalTickets: null, checkedInCount: null, checkedInAt: null,
  };

  it('network failure after retries → the local decision is shown', async () => {
    const fallback = jest.fn(() => Promise.resolve(OFFLINE_ADMIT));
    const h = harness({ fallback, maxRetries: 0 });
    h.q.enqueue(code(1));
    h.resolveNext(NETWORK);
    await flush();
    expect(fallback).toHaveBeenCalledWith(code(1));
    expect(h.results).toEqual([{ code: code(1), outcome: OFFLINE_ADMIT }]);
  });

  it('a rate limit is not a reason to decide locally', async () => {
    const fallback = jest.fn(() => Promise.resolve(OFFLINE_ADMIT));
    const h = harness({ fallback, maxRetries: 0 });
    h.q.enqueue(code(1));
    h.resolveNext(fail({ status: 429, body: {} }));
    await flush();
    expect(fallback).not.toHaveBeenCalled();
    expect(h.results[0]?.outcome).toEqual({ kind: 'couldntCheck', cause: 'rateLimited' });
  });

  it('a server answer is final and teaches the list', async () => {
    const fallback = jest.fn(() => Promise.resolve(OFFLINE_ADMIT));
    const onLive = jest.fn();
    const h = harness({ fallback, onLive });
    h.q.enqueue(code(1));
    h.resolveNext(ADMIT);
    await flush();
    expect(fallback).not.toHaveBeenCalled();
    expect(onLive).toHaveBeenCalledWith(code(1), expect.objectContaining({ kind: 'admitted' }));
  });

  it('degraded: decides locally without calling the server', async () => {
    const fallback = jest.fn(() => Promise.resolve(OFFLINE_ADMIT));
    const h = harness({ fallback, skipOnline: () => true });
    h.q.enqueue(code(1));
    await flush();
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.results[0]?.outcome).toEqual(OFFLINE_ADMIT);
  });

  it('degraded but no offline list: tries the server anyway', async () => {
    const fallback = jest.fn(() => Promise.resolve<ScanOutcome>({ kind: 'couldntCheck', cause: 'noOfflineList' }));
    const h = harness({ fallback, skipOnline: () => true });
    h.q.enqueue(code(1));
    await flush();
    expect(h.submit).toHaveBeenCalled();
  });

  it('a failing local decision leaves the live "couldnt check"', async () => {
    const h = harness({ fallback: () => Promise.reject(new Error('disk')), maxRetries: 0 });
    h.q.enqueue(code(1));
    h.resolveNext(TIMEOUT);
    await flush();
    expect(h.results[0]?.outcome).toEqual({ kind: 'couldntCheck', cause: 'timeout' });
  });

  it('an offline admission replays as already used on this phone', async () => {
    const h = harness({ fallback: () => Promise.resolve(OFFLINE_ADMIT), skipOnline: () => true, cooldownMs: 0 });
    h.q.enqueue(code(1));
    await flush();
    h.q.enqueue(code(1));
    expect(h.results[1]?.outcome).toMatchObject({ kind: 'used', scannedBy: { kind: 'me' }, replayed: true });
  });
});
```
If the harness lacks `resolveNext`/`submit` exposure, add small helpers to it (resolve the oldest pending deferred; return the `submit` mock) without changing existing tests.

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/gate/domain/__tests__/scanQueue.test.ts`
Expected: FAIL — fallback never called.

- [ ] **Step 3: Implement** in `scanQueue.ts`

Add to `ScanQueueDeps`:
```ts
  /** Phase 2a: the phone's own decision when the server can't be reached. Throwing = none. */
  fallback?: (code: TicketCode) => Promise<ScanOutcome>;
  /** Degraded connection: decide locally first instead of waiting on the server. */
  skipOnline?: () => boolean;
  /** Every non-transient server answer; lets the offline list learn from live scans. */
  onLive?: (code: TicketCode, outcome: ScanOutcome) => void;
```
Add helpers inside `createScanQueue`, above `run`:
```ts
  async function local(code: TicketCode): Promise<ScanOutcome | null> {
    if (deps.fallback === undefined) return null;
    try {
      return await deps.fallback(code);
    } catch {
      return null;
    }
  }

  function live(code: TicketCode, outcome: ScanOutcome) {
    try {
      deps.onLive?.(code, outcome);
    } catch {
      // Learning is best effort.
    }
  }

  // Unreachable server only: a 429 means it is reachable, and a refusal is the server's answer.
  const unreachable = (res: ScanResponse) =>
    !res.ok && (res.error.kind === 'network' || res.error.kind === 'timeout' || res.error.kind === 'unavailable');
```
Change `run` to:
```ts
  async function run(code: TicketCode, gen: number): Promise<RunResult | null> {
    let uncertainSince = uncertain.get(code) ?? null;
    if (deps.skipOnline?.() === true) {
      const o = await local(code);
      if (gen !== generation) return null;
      // No offline list on this phone: the server is still the only one who can answer.
      if (o !== null && !(o.kind === 'couldntCheck' && o.cause === 'noOfflineList')) {
        return { outcome: o, uncertainSince };
      }
    }
    let timeouts = 0;
    for (let attempt = 0; ; attempt++) {
      if (gen !== generation) return null;
      const startedAt = deps.now();
      const res = await submitSafely(code);
      const outcome = classify(res, { uncertainSince });
      if (mayHaveCommitted(res)) uncertainSince ??= startedAt;
      if (!res.ok && res.error.kind === 'timeout') timeouts += 1;
      const retry = isTransient(res) && attempt < maxRetries && timeouts <= maxTimeoutRetries;
      if (!retry) {
        if (!isTransient(res)) live(code, outcome);
        if (unreachable(res)) {
          const o = await local(code);
          if (gen !== generation) return null;
          if (o !== null) return { outcome: o, uncertainSince };
        }
        return { outcome, uncertainSince };
      }
      await deps.sleep(400 * (attempt + 1) + Math.floor(deps.random() * 200));
      if (gen !== generation) return null;
    }
  }
```
Update the header comment: "Phase 2a: when the server can't be reached, `fallback` decides on the phone."
Also delete the line `// Phase 2 swaps \`submit\` for roster + outbox; nothing else here changes.` in `scanSession.ts` (now untrue).

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/gate/domain && npx tsc --noEmit`
Expected: PASS (old and new queue tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/domain/scanQueue.ts src/features/gate/domain/scanSession.ts src/features/gate/domain/__tests__/scanQueue.test.ts
git commit -m "feat(gate): fall back to the offline decision when the server is unreachable"
```

---

### Task 14: Per-user database, expiry and the sign-out guard

**Files:**
- Create: `src/features/gate/domain/listExpiry.ts`, `src/features/gate/offline/gateDb.ts`, `src/features/gate/offline/signOutGuard.ts`, `src/shared/lib/signOutGuard.ts`, `src/features/auth/domain/signOutPlan.ts`, `src/features/auth/hooks/useSignOut.ts`
- Modify: `src/features/auth/hooks/useAuth.ts`, `src/app/_layout.tsx`, `src/app/(gate)/gate/index.tsx`, `src/app/(gate)/gate/[eventId].tsx` (onSignIn only), `src/app/mode-error.tsx`, `src/app/web-only.tsx`, `src/app/(customer)/home.tsx`, `src/app/(receptionist)/front-desk.tsx`
- Test: `src/features/gate/domain/__tests__/listExpiry.test.ts`, `src/features/gate/offline/__tests__/sweep.test.ts`, `src/shared/lib/__tests__/signOutGuard.test.ts`, `src/features/auth/domain/__tests__/signOutPlan.test.ts`

**Interfaces:**
- Produces:
```ts
// domain/listExpiry.ts
export function listExpiry(startsAt: string | null): number | null; // start + 72 h (doors day + 48 h grace)
// offline/gateDb.ts
export type GateDb = { roster: RosterStore; outbox: OutboxStore; close: () => Promise<void> };
export function gateDb(userId: string): Promise<GateDb>;      // cached per user
export function hasGateDb(userId: string): Promise<boolean>;  // key exists
export function wipeGateDb(userId: string): Promise<void>;
export function sweepExpired(roster: RosterStore, outbox: OutboxStore, nowMs: number): Promise<void>;
// shared/lib/signOutGuard.ts
export type SignOutCheck = { unsynced: number; unsyncable: number };
export type SignOutGuard = { check(userId): Promise<SignOutCheck>; syncNow(userId): Promise<void>; wipe(userId): Promise<void> };
export function registerSignOutGuard(g: SignOutGuard): void;
export function checkSignOut(userId: string): Promise<SignOutCheck>;
export function syncBeforeSignOut(userId: string): Promise<void>;
export function wipeOnSignOut(userId: string): Promise<void>;
// auth/domain/signOutPlan.ts
export type SignOutOptions = { keepOfflineData?: boolean; discardUnsyncable?: boolean };
export function planSignOut(check: SignOutCheck | null, opts: SignOutOptions): 'wipe' | 'keep' | { blocked: SignOutCheck };
// auth: useAuth.signOut(opts?: SignOutOptions): Promise<{ blocked: SignOutCheck | null }>
// auth/hooks/useSignOut.ts
export function useSignOut(): () => void;
```

- [ ] **Step 1: Failing tests**

`src/features/gate/domain/__tests__/listExpiry.test.ts`:
```ts
import { listExpiry } from '@/features/gate/domain/listExpiry';

describe('listExpiry', () => {
  it('keeps a list for 72 hours after the event starts', () => {
    expect(listExpiry('2026-10-10T18:00:00Z')).toBe(Date.parse('2026-10-13T18:00:00Z'));
  });
  it('unknown start: never expires on its own', () => {
    expect(listExpiry(null)).toBeNull();
    expect(listExpiry('tbc')).toBeNull();
  });
});
```

`src/features/gate/offline/__tests__/sweep.test.ts`:
```ts
jest.mock('@/shared/db/expoSql', () => ({}));
jest.mock('@/shared/platform/secureStore', () => ({ secureKv: {} }));
jest.mock('expo-crypto', () => ({}));

import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { sweepExpired } from '@/features/gate/offline/gateDb';
import { createOutboxStore } from '@/features/gate/offline/outboxStore';
import { createRosterStore } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';

const EV = 'e0000000-0000-4000-8000-000000000001';
const T = '00000000-0000-4000-8000-000000000001';

it('drops expired lists only once their admissions have synced', async () => {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const roster = createRosterStore(db);
  const outbox = createOutboxStore(db, { newDeviceId: () => 'device-abcdef12' });
  await roster.beginSync(EV, 'full', '2026-10-07T17:00:00Z', { title: null, eventDate: null, requireDynamic: false, total: 1 }, []);
  await roster.writePage(EV, 'full', [{ id: T, ticketType: null, ticketIndex: 1, bookingId: 'b', bookingStatus: 'confirmed', checkedInAt: null, scannedBy: null, byMe: null, holderName: null, phoneMasked: null, seat: null }], null);
  await roster.finishSync(EV, 'full');
  await roster.setEndsAt(EV, 1_000);
  await outbox.recordAdmission({ eventId: EV, ticketId: T, code: T, scannedAt: 'x', kid: null, appVersion: '1' });
  await sweepExpired(roster, outbox, 2_000);
  expect(await roster.meta(EV)).not.toBeNull();
  await outbox.settle([{ seq: 1, state: 'synced', result: null }]);
  await sweepExpired(roster, outbox, 2_000);
  expect(await roster.meta(EV)).toBeNull();
});
```

`src/shared/lib/__tests__/signOutGuard.test.ts`:
```ts
import { checkSignOut, registerSignOutGuard, wipeOnSignOut } from '@/shared/lib/signOutGuard';

it('sums every registered guard and wipes through all of them', async () => {
  const wipe = jest.fn(() => Promise.resolve());
  registerSignOutGuard({ check: () => Promise.resolve({ unsynced: 2, unsyncable: 1 }), syncNow: () => Promise.resolve(), wipe });
  expect(await checkSignOut('u1')).toEqual({ unsynced: 2, unsyncable: 1 });
  await wipeOnSignOut('u1');
  expect(wipe).toHaveBeenCalledWith('u1');
});
```

`src/features/auth/domain/__tests__/signOutPlan.test.ts`:
```ts
import { planSignOut } from '@/features/auth/domain/signOutPlan';

describe('planSignOut', () => {
  it('nothing pending: wipe', () => {
    expect(planSignOut({ unsynced: 0, unsyncable: 0 }, {})).toBe('wipe');
  });
  it('unsynced admissions always block a normal sign-out', () => {
    expect(planSignOut({ unsynced: 3, unsyncable: 0 }, { discardUnsyncable: true })).toEqual({
      blocked: { unsynced: 3, unsyncable: 0 },
    });
  });
  it('unsyncable admissions need an explicit confirmation', () => {
    expect(planSignOut({ unsynced: 0, unsyncable: 2 }, {})).toEqual({ blocked: { unsynced: 0, unsyncable: 2 } });
    expect(planSignOut({ unsynced: 0, unsyncable: 2 }, { discardUnsyncable: true })).toBe('wipe');
  });
  it('a session-expiry sign-out keeps the data for the same account', () => {
    expect(planSignOut({ unsynced: 5, unsyncable: 0 }, { keepOfflineData: true })).toBe('keep');
  });
  it('a failed check keeps the data rather than risk losing admissions', () => {
    expect(planSignOut(null, {})).toBe('keep');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/gate/domain/__tests__/listExpiry.test.ts src/features/gate/offline/__tests__/sweep.test.ts src/shared/lib/__tests__/signOutGuard.test.ts src/features/auth/domain/__tests__/signOutPlan.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

`src/features/gate/domain/listExpiry.ts`:
```ts
// NFR-3.3: the roster (PII) leaves the phone after the event + grace. The scannable-events list
// only has a start time: keep it through the doors day plus 48 h.
const KEEP_MS = 72 * 60 * 60 * 1000;

export function listExpiry(startsAt: string | null): number | null {
  if (startsAt === null) return null;
  const t = Date.parse(startsAt);
  return Number.isFinite(t) ? t + KEEP_MS : null;
}
```

`src/shared/lib/signOutGuard.ts`:
```ts
export type SignOutCheck = { unsynced: number; unsyncable: number };
export type SignOutGuard = {
  check: (userId: string) => Promise<SignOutCheck>;
  syncNow: (userId: string) => Promise<void>;
  wipe: (userId: string) => Promise<void>;
};

// Auth asks "may this account's local data go?" without importing the gate feature (FR-3.11).
const guards: SignOutGuard[] = [];

export function registerSignOutGuard(g: SignOutGuard): void {
  if (!guards.includes(g)) guards.push(g);
}

export async function checkSignOut(userId: string): Promise<SignOutCheck> {
  let unsynced = 0;
  let unsyncable = 0;
  for (const g of guards) {
    const c = await g.check(userId);
    unsynced += c.unsynced;
    unsyncable += c.unsyncable;
  }
  return { unsynced, unsyncable };
}

export async function syncBeforeSignOut(userId: string): Promise<void> {
  for (const g of guards) await g.syncNow(userId);
}

export async function wipeOnSignOut(userId: string): Promise<void> {
  for (const g of guards) {
    try {
      await g.wipe(userId);
    } catch {
      // A failed wipe leaves encrypted data behind; it must not keep the user signed in.
    }
  }
}
```

`src/features/auth/domain/signOutPlan.ts`:
```ts
import type { SignOutCheck } from '@/shared/lib/signOutGuard';

export type SignOutOptions = { keepOfflineData?: boolean; discardUnsyncable?: boolean };

// FR-3.11: never wipe unsynced admissions. Items that can never sync (revoked, rejected request)
// may go only after staff confirm. A failed check keeps the (encrypted) data.
export function planSignOut(
  check: SignOutCheck | null,
  opts: SignOutOptions,
): 'wipe' | 'keep' | { blocked: SignOutCheck } {
  if (opts.keepOfflineData === true || check === null) return 'keep';
  if (check.unsynced > 0) return { blocked: check };
  if (check.unsyncable > 0 && opts.discardUnsyncable !== true) return { blocked: check };
  return 'wipe';
}
```

`src/features/gate/offline/gateDb.ts`:
```ts
import * as Crypto from 'expo-crypto';

import { deleteDatabase, isWrongKey, openEncrypted } from '@/shared/db/expoSql';
import { migrate } from '@/shared/db/sql';
import { captureException } from '@/shared/monitoring';
import { secureKv } from '@/shared/platform/secureStore';

import { createOutboxStore, type OutboxStore } from './outboxStore';
import { createRosterStore, type RosterStore } from './rosterStore';
import { MIGRATIONS } from './schema';

export type GateDb = { roster: RosterStore; outbox: OutboxStore; close: () => Promise<void> };

// One encrypted database per account: a different account on this phone never sees, or syncs,
// another's admissions; "Sign in again" after a session expiry finds its outbox intact.
const fileOf = (userId: string) => `gate-${userId}.db`;
const keyName = (userId: string) => `bh.gate.dbkey.${userId}`;
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

async function keyFor(userId: string): Promise<string> {
  const existing = await secureKv.get(keyName(userId));
  if (existing !== null) return existing;
  // The async variant: the sync one may fall back to Math.random in development.
  const key = hex(await Crypto.getRandomBytesAsync(32));
  await secureKv.set(keyName(userId), key);
  return key;
}

export async function sweepExpired(roster: RosterStore, outbox: OutboxStore, nowMs: number): Promise<void> {
  for (const eventId of await roster.expired(nowMs)) {
    if (!(await outbox.hasUnsynced(eventId))) await roster.drop(eventId);
  }
}

async function open(userId: string): Promise<GateDb> {
  const key = await keyFor(userId);
  let conn: Awaited<ReturnType<typeof openEncrypted>>;
  try {
    conn = await openEncrypted(fileOf(userId), key);
  } catch (e) {
    // Only a key that cannot open the file (e.g. restored storage) justifies starting over.
    if (!isWrongKey(e)) throw e;
    captureException(e);
    await deleteDatabase(fileOf(userId)).catch(() => undefined);
    conn = await openEncrypted(fileOf(userId), key);
  }
  await migrate(conn.sql, MIGRATIONS);
  const roster = createRosterStore(conn.sql);
  const outbox = createOutboxStore(conn.sql, { newDeviceId: () => Crypto.randomUUID() });
  await outbox.resetSending();
  await sweepExpired(roster, outbox, Date.now());
  return { roster, outbox, close: conn.close };
}

const opened = new Map<string, Promise<GateDb>>();

export function gateDb(userId: string): Promise<GateDb> {
  const cached = opened.get(userId);
  if (cached !== undefined) return cached;
  const p = open(userId);
  opened.set(userId, p);
  p.catch(() => {
    opened.delete(userId);
  });
  return p;
}

export async function hasGateDb(userId: string): Promise<boolean> {
  return (await secureKv.get(keyName(userId))) !== null;
}

export async function wipeGateDb(userId: string): Promise<void> {
  const p = opened.get(userId);
  opened.delete(userId);
  if (p !== undefined) {
    const db = await p.catch(() => null);
    await db?.close().catch(() => undefined);
  }
  await deleteDatabase(fileOf(userId)).catch(() => undefined);
  await secureKv.delete(keyName(userId));
}
```

`src/features/gate/offline/signOutGuard.ts`:
```ts
import { postBatch } from '@/features/gate/api/batch';
import { api } from '@/shared/api/instance';
import { captureException } from '@/shared/monitoring';
import { registerSignOutGuard, type SignOutGuard } from '@/shared/lib/signOutGuard';

import { syncOutbox } from './batchSync';
import { gateDb, hasGateDb, wipeGateDb } from './gateDb';

const gateGuard: SignOutGuard = {
  async check(userId) {
    if (!(await hasGateDb(userId))) return { unsynced: 0, unsyncable: 0 };
    return (await gateDb(userId)).outbox.totals();
  },
  async syncNow(userId) {
    if (!(await hasGateDb(userId))) return;
    const { outbox } = await gateDb(userId);
    for (const eventId of await outbox.eventsWithUnsynced()) {
      await syncOutbox({
        store: outbox,
        eventId,
        post: (deviceId, items) => postBatch(api, eventId, deviceId, items),
        now: () => Date.now(),
        random: Math.random,
        report: captureException,
      });
    }
  },
  wipe: wipeGateDb,
};

// Imported once for its side effect from src/app/_layout.tsx.
registerSignOutGuard(gateGuard);
```
Note: `syncOutbox` only sends items whose `next_try_at` has passed; that's fine — a backed-off item retries on the next tap.

`src/features/auth/hooks/useAuth.ts` — change the store type and `signOut`:
```ts
import { planSignOut, type SignOutOptions } from '@/features/auth/domain/signOutPlan';
import { checkSignOut, wipeOnSignOut, type SignOutCheck } from '@/shared/lib/signOutGuard';
…
  signOut: (opts?: SignOutOptions) => Promise<{ blocked: SignOutCheck | null }>;
…
  async signOut(opts = {}) {
    const s = get().state;
    const userId = s.status === 'signedIn' ? s.userId : null;
    if (userId !== null && opts.keepOfflineData !== true) {
      let check: SignOutCheck | null = null;
      try {
        check = await checkSignOut(userId);
      } catch {
        check = null;
      }
      const plan = planSignOut(check, opts);
      if (typeof plan === 'object') return { blocked: plan.blocked };
      if (plan === 'wipe') await wipeOnSignOut(userId);
    }
    await performSignOut({
      remote: () => supabase.auth.signOut(),
      removeLocal: () => sessionStore.removeItem(STORAGE_KEY),
      onSignedOut: () => {
        queryClient.clear();
        get().dispatch({ type: 'SIGNED_OUT' });
      },
    });
    return { blocked: null };
  },
```
(Keep the field names the store already uses; only the `signOut` signature and body change.)

`src/features/auth/hooks/useSignOut.ts`:
```ts
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { syncBeforeSignOut } from '@/shared/lib/signOutGuard';

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

// FR-3.11: a voluntary sign-out never silently drops gate admissions.
export function useSignOut(): () => void {
  const signOut = useAuth((s) => s.signOut);
  const userId = useAuth((s) => (s.state.status === 'signedIn' ? s.state.userId : null));
  return useCallback(() => {
    void (async () => {
      const r = await signOut();
      if (r.blocked === null) return;
      const { unsynced, unsyncable } = r.blocked;
      if (unsynced > 0) {
        Alert.alert(
          `${plural(unsynced, 'admission hasn’t', 'admissions haven’t')} synced`,
          'Connect to the internet and sync before signing out, so no admission is lost.',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Sync now',
              onPress: () => {
                if (userId !== null) void syncBeforeSignOut(userId);
              },
            },
          ],
        );
        return;
      }
      Alert.alert(
        `${plural(unsyncable, 'admission', 'admissions')} can’t be sent`,
        'You were removed from the event, or the server refused them. Tell the organiser. Signing out deletes them from this phone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign out',
            style: 'destructive',
            onPress: () => {
              void signOut({ discardUnsyncable: true });
            },
          },
        ],
      );
    })();
  }, [signOut, userId]);
}
```

Call sites:
- `src/app/_layout.tsx`: add `import '@/features/gate/offline/signOutGuard';` with the other imports.
- `src/app/(gate)/gate/index.tsx`, `src/app/mode-error.tsx`, `src/app/web-only.tsx`, `src/app/(customer)/home.tsx`, `src/app/(receptionist)/front-desk.tsx`: replace `const signOut = useAuth((s) => s.signOut);` with `const signOut = useSignOut();` (import from `@/features/auth/hooks/useSignOut`) and each `void signOut();` with `signOut();`. Remove a now-unused `useAuth` import only if nothing else in the file uses it.
- `src/app/(gate)/gate/[eventId].tsx`: `onSignIn={() => { void signOut({ keepOfflineData: true }); }}` (session expired: the same account will sign back in and sync).

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/gate src/features/auth src/shared/lib && npx tsc --noEmit && npx expo lint`
Expected: PASS. Existing screen tests that render a sign-out button may need `jest.mock('@/features/auth/hooks/useSignOut', () => ({ useSignOut: () => jest.fn() }))` if they import a route file; screens take `onSignOut` as a prop, so most won't.

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/domain/listExpiry.ts src/features/gate/offline/gateDb.ts src/features/gate/offline/signOutGuard.ts src/shared/lib/signOutGuard.ts src/features/auth/domain/signOutPlan.ts src/features/auth/hooks/useSignOut.ts src/features/auth/hooks/useAuth.ts src/app/_layout.tsx "src/app/(gate)/gate/index.tsx" "src/app/(gate)/gate/[eventId].tsx" src/app/mode-error.tsx src/app/web-only.tsx "src/app/(customer)/home.tsx" "src/app/(receptionist)/front-desk.tsx" src/features/gate/domain/__tests__/listExpiry.test.ts src/features/gate/offline/__tests__/sweep.test.ts src/shared/lib/__tests__/signOutGuard.test.ts src/features/auth/domain/__tests__/signOutPlan.test.ts
git commit -m "feat(gate): per-account encrypted store; sign-out waits for unsynced admissions"
```

---

### Task 15: Offline controller, hook and scanner wiring

**Files:**
- Create: `src/features/gate/domain/syncLine.ts` (types only in this task: `SyncStatus`), `src/features/gate/state/syncView.ts`, `src/features/gate/offline/controller.ts`, `src/features/gate/hooks/useOfflineGate.ts`
- Modify: `src/features/gate/hooks/useScanSession.ts`, `src/app/(gate)/gate/[eventId].tsx`
- Test: `src/features/gate/offline/__tests__/controller.test.ts`

**Interfaces:**
- Produces:
```ts
// domain/syncLine.ts (types now; wording functions in Task 16)
export type SyncStatus = {
  mode: 'online' | 'offline';
  list: { count: number; syncedAt: number } | null;
  download: { done: number; total: number } | null;
  pending: number; syncing: boolean; attention: number; blocked: boolean;
  clock: ClockState;
  localCounts: { admitted: number; total: number } | null;
};
export const EMPTY_SYNC: SyncStatus;
// state/syncView.ts
export const useSyncView: UseBoundStore<{ status: SyncStatus; set: (p: Partial<SyncStatus>) => void; reset: () => void }>;
// offline/controller.ts
export type OfflineController = {
  start: () => void; stop: () => void;
  decide: (code: TicketCode) => Promise<ScanOutcome>;
  noteLive: (code: TicketCode, outcome: ScanOutcome) => void;
  refreshList: () => void; syncNow: () => void;
  attention: () => Promise<AttentionItem[]>; dropList: () => Promise<void>;
};
export function createOfflineController(deps: ControllerDeps): OfflineController;
// hooks/useOfflineGate.ts
export type OfflineScanHooks = Pick<ScanQueueDeps, 'fallback' | 'skipOnline' | 'onLive'>;
export function useOfflineGate(p: { eventId: string; userId: string | null; focused: boolean; startsAt: string | null }):
  { scan: OfflineScanHooks; controller: OfflineController | null };
// useScanSession(eventId: string, offline?: OfflineScanHooks)
```

- [ ] **Step 1: Failing controller tests** — `src/features/gate/offline/__tests__/controller.test.ts`:
```ts
import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { createOfflineController, type ControllerDeps } from '@/features/gate/offline/controller';
import { createOutboxStore } from '@/features/gate/offline/outboxStore';
import { createRosterStore } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';
import type { SyncStatus } from '@/features/gate/domain/syncLine';
import { createConnectivity } from '@/shared/lib/connectivity';
import { ok } from '@/shared/lib/result';

const EV = 'e0000000-0000-4000-8000-000000000001';
const T = '00000000-0000-4000-8000-000000000001';
const flush = () => new Promise<void>((r) => setImmediate(r));
const page = {
  event: { id: EV, title: 'Gala', event_date: '2026-10-10', require_dynamic_ticket: false, total: 1 },
  tickets: [{ id: T, ticket_type: 'Regular', ticket_index: 1, booking_id: 'b', booking_status: 'confirmed', checked_in_at: null, scanned_by: null, by_me: null, holder_name: null, phone_masked: null, seat: null }],
  next_after: null,
  server_time: '2026-10-07T18:00:00Z',
  keys: [],
};

async function setup(over: Partial<ControllerDeps> = {}) {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const stores = { roster: createRosterStore(db), outbox: createOutboxStore(db, { newDeviceId: () => 'device-abcdef12' }), close: () => Promise.resolve() };
  const status: Partial<SyncStatus>[] = [];
  const connectivity = createConnectivity();
  const fetchPage = jest.fn(() => Promise.resolve(ok(page)));
  const post = jest.fn(() => Promise.resolve(ok({ results: [{ client_seq: 1, ok: true, code: 'ok' }] })));
  const ctl = createOfflineController({
    eventId: EV,
    db: () => Promise.resolve(stores),
    fetchPage,
    post,
    serverNow: () => Date.parse('2026-10-07T18:00:10Z'),
    clockState: () => ({ suspect: false, checkedAgoMs: 0 }),
    connectivity,
    endsAt: () => null,
    appVersion: '1',
    random: () => 1,
    publish: (s) => status.push(s),
    report: jest.fn(),
    ...over,
  });
  return { ctl, stores, status, fetchPage, post, connectivity };
}

describe('offline controller', () => {
  it('start downloads the list and publishes it', async () => {
    const { ctl, fetchPage, status } = await setup();
    ctl.start();
    await flush();
    await flush();
    expect(fetchPage).toHaveBeenCalledWith({ cursor: null, since: null, limit: 2000 });
    expect(status).toContainEqual(expect.objectContaining({ list: { count: 1, syncedAt: Date.parse('2026-10-07T18:00:00Z') } }));
    ctl.stop();
  });

  it('an offline admission is synced when the server is back', async () => {
    const { ctl, post, connectivity } = await setup();
    ctl.start();
    await flush();
    await flush();
    connectivity.networkLost();
    const o = await ctl.decide(T as never);
    expect(o).toMatchObject({ kind: 'admitted', offline: true });
    post.mockClear();
    connectivity.reached();
    await flush();
    await flush();
    expect(post).toHaveBeenCalled();
    ctl.stop();
  });

  it('asks for keys at most once a minute', async () => {
    const { ctl, fetchPage } = await setup();
    ctl.start();
    await flush();
    await flush();
    fetchPage.mockClear();
    ctl.keysOutdated();
    ctl.keysOutdated();
    await flush();
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith({ cursor: null, since: null, limit: 1 });
    ctl.stop();
  });
});
```
(`T as never` is a test shortcut for a `TicketCode`; prefer `parseTicketCode(T)?.value` if your lint config rejects it.) `keysOutdated` is exposed on the controller for this test and for the gate's `onKeysOutdated`.

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/gate/offline/__tests__/controller.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`src/features/gate/domain/syncLine.ts` (types for now):
```ts
import type { ClockState } from '@/shared/lib/clockGuard';

export type SyncStatus = {
  mode: 'online' | 'offline';
  list: { count: number; syncedAt: number } | null;
  download: { done: number; total: number } | null;
  pending: number;
  syncing: boolean;
  attention: number;
  blocked: boolean;
  clock: ClockState;
  localCounts: { admitted: number; total: number } | null;
};

export const EMPTY_SYNC: SyncStatus = {
  mode: 'online',
  list: null,
  download: null,
  pending: 0,
  syncing: false,
  attention: 0,
  blocked: false,
  clock: { suspect: false, checkedAgoMs: null },
  localCounts: null,
};
```

`src/features/gate/state/syncView.ts`:
```ts
import { create } from 'zustand';

import { EMPTY_SYNC, type SyncStatus } from '@/features/gate/domain/syncLine';

// Only the sync bar and the door counter subscribe.
export const useSyncView = create<{
  status: SyncStatus;
  set: (p: Partial<SyncStatus>) => void;
  reset: () => void;
}>((set) => ({
  status: EMPTY_SYNC,
  set: (p) => {
    set((s) => ({ status: { ...s.status, ...p } }));
  },
  reset: () => {
    set({ status: EMPTY_SYNC });
  },
}));
```

`src/features/gate/offline/controller.ts`:
```ts
import { listExpiry } from '@/features/gate/domain/listExpiry';
import type { ScanOutcome } from '@/features/gate/domain/outcome';
import type { TicketCode } from '@/features/gate/domain/parseTicketCode';
import type { SyncStatus } from '@/features/gate/domain/syncLine';
import type { ClockState } from '@/shared/lib/clockGuard';
import type { Connectivity } from '@/shared/lib/connectivity';

import { syncOutbox, type PostBatch } from './batchSync';
import type { GateDb } from './gateDb';
import { createOfflineGate, type OfflineGate } from './offlineGate';
import type { AttentionItem } from './outboxStore';
import { refreshKeys, syncRoster, type FetchRosterPage } from './rosterSync';
import type { SyncKind } from './rosterStore';

export type ControllerDeps = {
  eventId: string;
  db: () => Promise<GateDb>;
  fetchPage: FetchRosterPage;
  post: PostBatch;
  serverNow: () => number;
  clockState: () => ClockState;
  connectivity: Pick<Connectivity, 'isDegraded' | 'subscribe'>;
  /** Event start from the scannable list, read when a sync finishes. */
  endsAt: () => number | null;
  appVersion: string;
  random: () => number;
  publish: (s: Partial<SyncStatus>) => void;
  report: (e: unknown) => void;
};

export const DELTA_EVERY_MS = 3 * 60_000;
export const FULL_EVERY_MS = 30 * 60_000;
const TICK_MS = 30_000;
const STATUS_MS = 15_000;
const KEYS_GAP_MS = 60_000;

// Foreground only (spec decision 4): started while the scanner is focused, stopped otherwise.
export function createOfflineController(deps: ControllerDeps) {
  const { eventId } = deps;
  let running = false;
  let listBusy = false;
  let outboxBusy = false;
  let lastKeysAt = -Infinity;
  let timers: ReturnType<typeof setInterval>[] = [];
  let unsubscribe: (() => void) | null = null;
  let gatePromise: Promise<OfflineGate> | null = null;

  const fail = (e: unknown) => {
    deps.report(e);
  };

  function gate(): Promise<OfflineGate> {
    gatePromise ??= deps.db().then((d) =>
      createOfflineGate({
        eventId,
        roster: d.roster,
        outbox: d.outbox,
        serverNow: deps.serverNow,
        clockState: deps.clockState,
        appVersion: deps.appVersion,
        onKeysOutdated: () => {
          keysOutdated();
        },
        onAdmitted: () => {
          void refreshStatus();
        },
      }),
    );
    return gatePromise;
  }

  async function refreshStatus(): Promise<void> {
    try {
      const d = await deps.db();
      const meta = await d.roster.meta(eventId);
      const counts = await d.roster.counts(eventId);
      const s = await d.outbox.status(eventId);
      deps.publish({
        mode: deps.connectivity.isDegraded() ? 'offline' : 'online',
        list: meta?.ready === true ? { count: counts.total, syncedAt: meta.syncedAt ?? 0 } : null,
        localCounts: meta?.ready === true ? counts : null,
        pending: s.pending,
        attention: s.attention,
        blocked: s.blocked,
        clock: deps.clockState(),
      });
    } catch (e) {
      fail(e);
    }
  }

  async function syncList(kind: SyncKind): Promise<void> {
    if (listBusy) return;
    listBusy = true;
    try {
      const d = await deps.db();
      const r = await syncRoster(
        {
          store: d.roster,
          fetchPage: deps.fetchPage,
          eventId,
          onProgress: (p) => {
            deps.publish({ download: p });
          },
        },
        kind,
      );
      if (r.ok) {
        const meta = await d.roster.meta(eventId);
        const ends = deps.endsAt() ?? listExpiry(meta?.eventDate ?? null);
        if (ends !== null) await d.roster.setEndsAt(eventId, ends);
      }
    } catch (e) {
      fail(e);
    } finally {
      listBusy = false;
      deps.publish({ download: null });
      await refreshStatus();
    }
  }

  async function syncPending(): Promise<void> {
    if (outboxBusy) return;
    outboxBusy = true;
    deps.publish({ syncing: true });
    try {
      const d = await deps.db();
      await syncOutbox({
        store: d.outbox,
        eventId,
        post: deps.post,
        now: () => Date.now(),
        random: deps.random,
        report: deps.report,
      });
    } catch (e) {
      fail(e);
    } finally {
      outboxBusy = false;
      deps.publish({ syncing: false });
      await refreshStatus();
    }
  }

  // Every 30 s: send what is due, then bring the list up to date (full every 30 min).
  async function tick(): Promise<void> {
    if (deps.connectivity.isDegraded()) {
      await refreshStatus();
      return;
    }
    await syncPending();
    try {
      const meta = await (await deps.db()).roster.meta(eventId);
      const now = deps.serverNow();
      if (meta?.ready !== true || now - (meta.fullAt ?? 0) > FULL_EVERY_MS) await syncList('full');
      else if (now - (meta.syncedAt ?? 0) > DELTA_EVERY_MS) await syncList('delta');
    } catch (e) {
      fail(e);
    }
  }

  function keysOutdated(): void {
    const now = Date.now();
    if (now - lastKeysAt < KEYS_GAP_MS) return;
    lastKeysAt = now;
    void (async () => {
      try {
        const d = await deps.db();
        await refreshKeys({ store: d.roster, fetchPage: deps.fetchPage, eventId });
      } catch (e) {
        fail(e);
      }
    })();
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      void tick();
      timers = [
        setInterval(() => void tick(), TICK_MS),
        setInterval(() => void refreshStatus(), STATUS_MS),
      ];
      unsubscribe = deps.connectivity.subscribe((degraded) => {
        deps.publish({ mode: degraded ? 'offline' : 'online' });
        if (!degraded) void tick();
      });
    },
    stop(): void {
      running = false;
      for (const t of timers) clearInterval(t);
      timers = [];
      unsubscribe?.();
      unsubscribe = null;
    },
    decide: async (code: TicketCode): Promise<ScanOutcome> => (await gate()).decide(code),
    noteLive: (code: TicketCode, outcome: ScanOutcome): void => {
      void gate()
        .then((g) => g.noteLive(code, outcome))
        .catch(fail);
    },
    keysOutdated,
    refreshList: (): void => {
      void syncList('full');
    },
    syncNow: (): void => {
      void syncPending();
    },
    attention: async (): Promise<AttentionItem[]> => (await deps.db()).outbox.attention(eventId),
    dropList: async (): Promise<void> => {
      await (await deps.db()).roster.drop(eventId);
    },
  };
}

export type OfflineController = ReturnType<typeof createOfflineController>;
```

`src/features/gate/hooks/useOfflineGate.ts`:
```ts
import * as Network from 'expo-network';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { postBatch } from '@/features/gate/api/batch';
import { fetchRosterPage } from '@/features/gate/api/roster';
import { listExpiry } from '@/features/gate/domain/listExpiry';
import type { ScanQueueDeps } from '@/features/gate/domain/scanQueue';
import { createOfflineController, type OfflineController } from '@/features/gate/offline/controller';
import { gateDb } from '@/features/gate/offline/gateDb';
import { useSyncView } from '@/features/gate/state/syncView';
import { api, APP_VERSION, clock, clockGuard, connectivity } from '@/shared/api/instance';
import { captureException } from '@/shared/monitoring';

export type OfflineScanHooks = Pick<ScanQueueDeps, 'fallback' | 'skipOnline' | 'onLive'>;

export function useOfflineGate(p: {
  eventId: string;
  userId: string | null;
  focused: boolean;
  startsAt: string | null;
}): { scan: OfflineScanHooks; controller: OfflineController | null } {
  const { eventId, userId, focused } = p;
  const setSync = useSyncView((s) => s.set);
  const startsAt = useRef(p.startsAt);
  useEffect(() => {
    startsAt.current = p.startsAt;
  }, [p.startsAt]);

  const [controller] = useState(() =>
    userId === null
      ? null
      : createOfflineController({
          eventId,
          db: () => gateDb(userId),
          fetchPage: (q) => fetchRosterPage(api, eventId, q),
          post: (deviceId, items) => postBatch(api, eventId, deviceId, items),
          serverNow: () => clock.serverNow(),
          clockState: () => clockGuard.state(),
          connectivity,
          endsAt: () => listExpiry(startsAt.current),
          appVersion: APP_VERSION,
          random: Math.random,
          publish: setSync,
          report: captureException,
        }),
  );

  useEffect(() => {
    if (controller === null || !focused) return;
    controller.start();
    return () => {
      controller.stop();
    };
  }, [controller, focused]);

  // The OS saying "no network" degrades at once; the server answering is what restores.
  useEffect(() => {
    const sub = Network.addNetworkStateListener((s) => {
      if (s.isConnected === false) connectivity.networkLost();
    });
    return () => {
      sub.remove();
    };
  }, []);

  // Time asleep is not a clock change (Review Focus 1).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') clockGuard.rebase();
    });
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(
    () => () => {
      useSyncView.getState().reset();
    },
    [],
  );

  const scan = useMemo<OfflineScanHooks>(
    () =>
      controller === null
        ? {}
        : { fallback: controller.decide, skipOnline: connectivity.isDegraded, onLive: controller.noteLive },
    [controller],
  );
  return { scan, controller };
}
```

`useScanSession.ts`: change the signature to `useScanSession(eventId: string, offline: OfflineScanHooks = {})` (import the type from `@/features/gate/hooks/useOfflineGate`) and spread `...offline,` into the `createScanSession({ … })` deps object (before `onChange`). The session is created once; `offline` is stable from `useOfflineGate`'s `useState`/`useMemo`.

`src/app/(gate)/gate/[eventId].tsx` in `Scanner`:
1. Move `const listed = …` and `const event = …` above the hooks that need them.
2. Add `const offline = useOfflineGate({ eventId, userId, focused, startsAt: event?.startsAt ?? null });` (import from `@/features/gate/hooks/useOfflineGate`).
3. `const { session, muted, toggleMute } = useScanSession(eventId, offline.scan);`
4. In `leaveLostAssignment`, inside `leaveOnce`, add `void offline.controller?.dropList();` (spec §8: a confirmed lost assignment drops the roster; the outbox stays).
5. Pass `onRefreshList={() => offline.controller?.refreshList()}`, `onSyncNow={() => offline.controller?.syncNow()}`, `loadAttention={() => offline.controller?.attention() ?? Promise.resolve([])}` to `ScannerScreen` (props added in Task 16 — do this step there if you are executing strictly in order; tsc will tell you).

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/gate && npx tsc --noEmit`
Expected: PASS (controller tests included). If Task 16's props aren't there yet, leave step 5's prop passing for Task 16.

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/domain/syncLine.ts src/features/gate/state/syncView.ts src/features/gate/offline/controller.ts src/features/gate/hooks/useOfflineGate.ts src/features/gate/hooks/useScanSession.ts "src/app/(gate)/gate/[eventId].tsx" src/features/gate/offline/__tests__/controller.test.ts
git commit -m "feat(gate): run roster and outbox sync while the scanner is open"
```

---

### Task 16: Sync bar, attention sheet, offline tag and offline counter

**Files:**
- Modify: `src/features/gate/domain/syncLine.ts` (add wording), `src/features/gate/ui/OutcomeOverlay.tsx`, `src/features/gate/screens/ScannerScreen.tsx`, `src/app/(gate)/gate/[eventId].tsx`
- Create: `src/features/gate/ui/SyncBar.tsx`, `src/features/gate/ui/AttentionSheet.tsx`
- Test: `src/features/gate/domain/__tests__/syncLine.test.ts`, `src/features/gate/ui/__tests__/SyncBar.test.tsx`, `src/features/gate/ui/__tests__/AttentionSheet.test.tsx`, `src/features/gate/ui/__tests__/OutcomeOverlay.test.tsx` (add), `src/features/gate/screens/__tests__/ScannerScreen.test.tsx` (update props)

**Interfaces:**
- Produces:
```ts
// domain/syncLine.ts
export type SyncLine = { text: string; warning: string | null; tone: 'normal' | 'offline' | 'problem' };
export function syncLine(s: SyncStatus, nowMs: number): SyncLine;
export function attentionLine(item: { state: OutboxState; result: Record<string, unknown> | null }, nowMs: number): string;
export function groupDigits(n: number): string; // 12500 → "12,500"
// ui
export function SyncBar(p: { onRefreshList: () => void; onSyncNow: () => void; onOpenAttention: () => void; nowMs?: number }): JSX.Element;
export function AttentionSheet(p: { visible: boolean; load: () => Promise<AttentionItem[]>; onClose: () => void }): JSX.Element;
// ScannerScreen new props: onRefreshList, onSyncNow, loadAttention
```
`OutboxState` is imported as a type from `@/features/gate/offline/outboxStore` (domain → offline type import within the gate feature is allowed; it is type-only).

- [ ] **Step 1: Failing tests**

`src/features/gate/domain/__tests__/syncLine.test.ts`:
```ts
import { attentionLine, EMPTY_SYNC, groupDigits, syncLine, type SyncStatus } from '@/features/gate/domain/syncLine';

const NOW = Date.parse('2026-10-07T18:10:00Z');
const s = (over: Partial<SyncStatus>): SyncStatus => ({ ...EMPTY_SYNC, ...over });
const LIST = { count: 1240, syncedAt: NOW - 2 * 60_000 };

describe('syncLine', () => {
  it('online with a list', () => {
    expect(syncLine(s({ list: LIST }), NOW)).toEqual({ text: 'Online · offline list 1,240 · 2 min ago', warning: null, tone: 'normal' });
  });
  it('online with admissions waiting', () => {
    expect(syncLine(s({ list: LIST, pending: 3 }), NOW).text).toBe('Online · offline list 1,240 · 2 min ago · 3 to sync');
  });
  it('syncing', () => {
    expect(syncLine(s({ list: LIST, pending: 3, syncing: true }), NOW).text).toBe('Syncing 3…');
  });
  it('offline, deciding on this phone', () => {
    expect(syncLine(s({ mode: 'offline', list: LIST, pending: 3 }), NOW)).toEqual({
      text: 'Offline · deciding on this phone · 3 to sync', warning: null, tone: 'offline',
    });
  });
  it('offline with no list', () => {
    expect(syncLine(s({ mode: 'offline' }), NOW)).toMatchObject({ text: 'Offline · no offline list on this phone', tone: 'problem' });
  });
  it('first download progress', () => {
    expect(syncLine(s({ download: { done: 4000, total: 12500 } }), NOW).text).toBe('Downloading offline list 4,000 of 12,500');
  });
  it('removed from the event', () => {
    expect(syncLine(s({ list: LIST, blocked: true }), NOW)).toMatchObject({ text: 'Removed from this event — offline admissions can’t be sent', tone: 'problem' });
  });
  it('clock warnings', () => {
    expect(syncLine(s({ list: LIST, clock: { suspect: true, checkedAgoMs: 0 } }), NOW).warning).toBe('Phone time changed — connect to re-check');
    expect(syncLine(s({ list: LIST, clock: { suspect: false, checkedAgoMs: 14 * 3_600_000 } }), NOW).warning).toBe('Time last checked 14 h ago');
    expect(syncLine(s({ list: LIST, clock: { suspect: false, checkedAgoMs: 3_600_000 } }), NOW).warning).toBeNull();
  });
});

describe('attentionLine', () => {
  it.each([
    [{ state: 'duplicate', result: { scanned_by: 'Ada', checked_in_at: '2026-10-07T17:55:00Z' } }, /^Also admitted by Ada at \d\d:\d\d$/],
    [{ state: 'suspect', result: { code: 'invalid_code' } }, /^The server says this code was not valid$/],
    [{ state: 'rejected', result: { code: 'not_confirmed' } }, /^Not accepted — booking not confirmed$/],
    [{ state: 'rejected', result: { code: 'bad_timestamp' } }, /^Not accepted — the phone’s time was wrong$/],
    [{ state: 'blocked', result: null }, /^Not sent — you were removed from this event$/],
    [{ state: 'error', result: null }, /^Not sent — the server refused the request$/],
  ] as const)('%j', (item, re) => {
    expect(attentionLine(item, NOW)).toMatch(re);
  });
});

it('groups digits', () => {
  expect(groupDigits(999)).toBe('999');
  expect(groupDigits(12500)).toBe('12,500');
  expect(groupDigits(1234567)).toBe('1,234,567');
});
```

`src/features/gate/ui/__tests__/SyncBar.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { EMPTY_SYNC } from '@/features/gate/domain/syncLine';
import { useSyncView } from '@/features/gate/state/syncView';
import { SyncBar } from '@/features/gate/ui/SyncBar';

const NOW = Date.parse('2026-10-07T18:10:00Z');

describe('SyncBar', () => {
  beforeEach(() => {
    useSyncView.setState({ status: { ...EMPTY_SYNC, list: { count: 3, syncedAt: NOW }, pending: 2, attention: 1 } });
  });
  it('shows the status and the actions', async () => {
    const onSyncNow = jest.fn();
    const onOpenAttention = jest.fn();
    await render(<SyncBar nowMs={NOW} onRefreshList={jest.fn()} onSyncNow={onSyncNow} onOpenAttention={onOpenAttention} />);
    expect(screen.getByText('Online · offline list 3 · just now · 2 to sync')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
    expect(onSyncNow).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: '1 needs attention' }));
    expect(onOpenAttention).toHaveBeenCalled();
  });
});
```

`src/features/gate/ui/__tests__/AttentionSheet.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native';

import { AttentionSheet } from '@/features/gate/ui/AttentionSheet';
import type { AttentionItem } from '@/features/gate/offline/outboxStore';

const item: AttentionItem = {
  seq: 1, eventId: 'e', ticketId: 't', code: 't', scannedAt: '2026-10-07T18:00:00Z', mode: 'offline', kid: null,
  appVersion: '1', state: 'duplicate', attempts: 0, nextTryAt: 0, result: { scanned_by: 'Ada', checked_in_at: '2026-10-07T17:55:00Z' },
  ticketType: 'VIP', ticketIndex: 2,
};

it('lists items that need attention, read-only', async () => {
  await render(<AttentionSheet visible load={() => Promise.resolve([item])} onClose={jest.fn()} />);
  expect(await screen.findByText('VIP · ticket 2')).toBeTruthy();
  expect(screen.getByText(/^Also admitted by Ada/)).toBeTruthy();
  expect(screen.getByText('The organiser sees these on the web. Nothing to undo here.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
});
```

Add to `OutcomeOverlay.test.tsx` (follow the file's existing render helper):
```tsx
  it('an offline admission shows the will-sync tag', async () => {
    // render with view.outcome = { ...admitted outcome used in this file, offline: true }
    expect(screen.getByText('Offline · will sync')).toBeTruthy();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/gate/domain/__tests__/syncLine.test.ts src/features/gate/ui`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `src/features/gate/domain/syncLine.ts`:
```ts
import type { OutboxState } from '@/features/gate/offline/outboxStore';
import { parseIsoMs } from '@/shared/lib/isoTime';

import { ago } from './ago';

export type SyncLine = { text: string; warning: string | null; tone: 'normal' | 'offline' | 'problem' };

const STALE_CLOCK_MS = 12 * 3_600_000;

export function groupDigits(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function clockWarning(s: SyncStatus): string | null {
  if (s.clock.suspect) return 'Phone time changed — connect to re-check';
  const a = s.clock.checkedAgoMs;
  if (a !== null && a > STALE_CLOCK_MS) return `Time last checked ${String(Math.floor(a / 3_600_000))} h ago`;
  return null;
}

// FR-3.9: the sync state is always visible and never hides unsynced admissions.
export function syncLine(s: SyncStatus, nowMs: number): SyncLine {
  const warning = clockWarning(s);
  const toSync = s.pending > 0 ? ` · ${String(s.pending)} to sync` : '';
  if (s.blocked) return { text: 'Removed from this event — offline admissions can’t be sent', warning, tone: 'problem' };
  if (s.download !== null && s.list === null) {
    return {
      text: `Downloading offline list ${groupDigits(s.download.done)} of ${groupDigits(s.download.total)}`,
      warning,
      tone: 'normal',
    };
  }
  if (s.mode === 'offline') {
    return s.list === null
      ? { text: 'Offline · no offline list on this phone', warning, tone: 'problem' }
      : { text: `Offline · deciding on this phone${toSync}`, warning, tone: 'offline' };
  }
  if (s.syncing && s.pending > 0) return { text: `Syncing ${String(s.pending)}…`, warning, tone: 'normal' };
  if (s.list === null) return { text: 'Online · offline list not downloaded yet', warning, tone: 'normal' };
  return {
    text: `Online · offline list ${groupDigits(s.list.count)} · ${ago(s.list.syncedAt, nowMs)}${toSync}`,
    warning,
    tone: 'normal',
  };
}

const REJECTED: Record<string, string> = {
  not_found: 'ticket not found',
  wrong_event: 'ticket is for a different event',
  not_confirmed: 'booking not confirmed',
  static_not_allowed: 'printed QR not accepted for this event',
  bad_timestamp: 'the phone’s time was wrong',
  booking_qr: 'booking code, not a ticket',
  forbidden: 'not assigned to this event',
};

const pad = (n: number) => String(n).padStart(2, '0');
const clockTime = (iso: unknown) => {
  const t = typeof iso === 'string' ? parseIsoMs(iso) : null;
  if (t === null) return '';
  const d = new Date(t);
  return ` at ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function attentionLine(
  item: { state: OutboxState; result: Record<string, unknown> | null },
  _nowMs: number,
): string {
  const r = item.result ?? {};
  switch (item.state) {
    case 'duplicate': {
      const by = typeof r.scanned_by === 'string' && r.scanned_by !== '' ? r.scanned_by : 'another scanner';
      return `Also admitted by ${by}${clockTime(r.checked_in_at)}`;
    }
    case 'suspect':
      return 'The server says this code was not valid';
    case 'rejected': {
      const code = typeof r.code === 'string' ? r.code : '';
      return `Not accepted — ${REJECTED[code] ?? 'the server refused it'}`;
    }
    case 'blocked':
      return 'Not sent — you were removed from this event';
    case 'error':
      return 'Not sent — the server refused the request';
    case 'pending':
    case 'sending':
    case 'synced':
      return '';
  }
}
```
(Move the new imports to the top of the file.)

`src/features/gate/ui/SyncBar.tsx`:
```tsx
import { TriangleAlert, Wifi, WifiOff } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { syncLine } from '@/features/gate/domain/syncLine';
import { useSyncView } from '@/features/gate/state/syncView';
import { color, density, space } from '@/shared/theme';
import { Icon, Text } from '@/shared/ui';

type Props = { onRefreshList: () => void; onSyncNow: () => void; onOpenAttention: () => void; nowMs?: number };

function Small({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: density.gate.minTarget, justifyContent: 'center', paddingHorizontal: space.s2 }}
    >
      <Text variant="labelSm" tone="linkText">
        {label}
      </Text>
    </Pressable>
  );
}

// Always visible on the scanner (FR-3.9). Re-renders on sync status only, never the camera.
export function SyncBar({ onRefreshList, onSyncNow, onOpenAttention, nowMs }: Props) {
  const status = useSyncView((s) => s.status);
  const line = syncLine(status, nowMs ?? Date.now());
  const glyph = status.mode === 'offline' ? WifiOff : Wifi;
  const attention = status.attention;
  return (
    <View
      testID="sync-bar"
      style={{
        backgroundColor: line.tone === 'normal' ? color.surface : color.status.warning.bg,
        borderBottomWidth: 1,
        borderBottomColor: color.border,
        paddingHorizontal: space.s4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
        <Icon as={glyph} color={color.textPrimary} size={16} />
        <Text variant="labelSm" style={{ flex: 1 }} accessibilityLiveRegion="polite" numberOfLines={2}>
          {line.text}
        </Text>
        {status.pending > 0 ? <Small label="Sync now" onPress={onSyncNow} /> : <Small label="Refresh list" onPress={onRefreshList} />}
      </View>
      {line.warning !== null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2, paddingBottom: space.s2 }}>
          <Icon as={TriangleAlert} color={color.status.warning.fg} size={16} />
          <Text variant="labelSm" style={{ color: color.status.warning.fg }}>
            {line.warning}
          </Text>
        </View>
      ) : null}
      {attention > 0 ? (
        <Small label={`${String(attention)} ${attention === 1 ? 'needs' : 'need'} attention`} onPress={onOpenAttention} />
      ) : null}
    </View>
  );
}
```
Check `Icon` accepts `size` (read `src/shared/ui/Icon.tsx`); if not, drop the prop. Check the lucide names exist: `ls node_modules/lucide-react-native/dist/esm/icons | grep -E '^(wifi|wifi-off|triangle-alert)\.js'` (they do in the installed version as of 2026-10-07).

`src/features/gate/ui/AttentionSheet.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { FlatList, Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { attentionLine } from '@/features/gate/domain/syncLine';
import type { AttentionItem } from '@/features/gate/offline/outboxStore';
import { color, density, space } from '@/shared/theme';
import { Button, Text } from '@/shared/ui';

type Props = { visible: boolean; load: () => Promise<AttentionItem[]>; onClose: () => void };

const label = (i: AttentionItem) =>
  `${i.ticketType ?? 'Ticket'}${i.ticketIndex === null ? '' : ` · ticket ${String(i.ticketIndex)}`}`;

// Read-only (FR-3.13: no undo). Duplicates and suspects surface to the organiser on the web.
export function AttentionSheet({ visible, load, onClose }: Props) {
  const [items, setItems] = useState<AttentionItem[] | null>(null);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    void load()
      .then((v) => {
        if (live) setItems(v);
      })
      .catch(() => {
        if (live) setItems([]);
      });
    return () => {
      live = false;
    };
  }, [visible, load]);

  const now = Date.now();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }}>
        <View style={{ padding: space.s5, gap: space.s4, flex: 1 }}>
          <Text variant="title" accessibilityRole="header">
            Needs attention
          </Text>
          <Text variant="bodySm" tone="textSecondary">
            The organiser sees these on the web. Nothing to undo here.
          </Text>
          <FlatList
            data={items ?? []}
            keyExtractor={(i) => String(i.seq)}
            renderItem={({ item }) => (
              <View
                style={{
                  minHeight: density.work.rowMin,
                  justifyContent: 'center',
                  gap: space.s1,
                  borderBottomWidth: 1,
                  borderBottomColor: color.border,
                }}
              >
                <Text variant="bodyStrong">{label(item)}</Text>
                <Text variant="bodySm" tone="textSecondary">
                  {attentionLine(item, now)}
                </Text>
              </View>
            )}
          />
          <Button variant="secondary" label="Close" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
```

`OutcomeOverlay.tsx`: add `p.tag` to `announced` (after `p.secondary`) and render it after the secondary line:
```tsx
            {p.tag !== null ? (
              <Text variant="label" maxScale={SCALE} style={{ color: fg }}>
                {p.tag}
              </Text>
            ) : null}
```

`ScannerScreen.tsx`:
1. Props: add `onRefreshList: () => void; onSyncNow: () => void; loadAttention: () => Promise<AttentionItem[]>;`.
2. Render `<SyncBar onRefreshList={p.onRefreshList} onSyncNow={p.onSyncNow} onOpenAttention={() => { setShowAttention(true); }} />` directly under the header `View`, and `<AttentionSheet visible={showAttention} load={p.loadAttention} onClose={() => { setShowAttention(false); }} />` next to `RecentSheet`; add `const [showAttention, setShowAttention] = useState(false);` and include `showAttention` in the camera's `paused` condition.
3. `DoorCounter`: read `useSyncView((s) => s.status)`; when `status.mode === 'offline' && status.localCounts !== null`, show `localCounts.admitted / localCounts.total` with the caption `offline` instead of `not updated`; otherwise keep the current behaviour.
Update `ScannerScreen.test.tsx`'s props builder with `onRefreshList: jest.fn(), onSyncNow: jest.fn(), loadAttention: () => Promise.resolve([])`.

`[eventId].tsx`: pass the three props (see Task 15 step 3.5).

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/gate && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/domain/syncLine.ts src/features/gate/ui/SyncBar.tsx src/features/gate/ui/AttentionSheet.tsx src/features/gate/ui/OutcomeOverlay.tsx src/features/gate/screens/ScannerScreen.tsx "src/app/(gate)/gate/[eventId].tsx" src/features/gate/domain/__tests__/syncLine.test.ts src/features/gate/ui/__tests__/SyncBar.test.tsx src/features/gate/ui/__tests__/AttentionSheet.test.tsx src/features/gate/ui/__tests__/OutcomeOverlay.test.tsx src/features/gate/screens/__tests__/ScannerScreen.test.tsx
git commit -m "feat(gate): sync bar, attention list and offline markers on the scanner"
```

---

### Task 17: Contract docs, full verification and device checks

**Files:**
- Modify: `docs/BACKEND_STATUS.md`

- [ ] **Step 1: Update `docs/BACKEND_STATUS.md`** with the 2026-10-07 contract check (web `origin/main` `c8fe25e8`):
  - §2.1 BH2: signed message is `bh2:<kid>:<uuid lowercase dashed>:<step as a DECIMAL integer>`; all base64url unpadded and canonical (re-encode must match, else `malformed`); step 1–10 base36 chars, no leading zeros; server checks expiry before key and signature; any published kid verifies regardless of `signing`; server uses Node crypto (OpenSSL); mobile uses `@noble/curves` with `{ zip215: false }`.
  - §3 roster: add `ok: true`; `scanned_by` = name or null; `by_me` null when not checked in; tickets of **every** booking status (`pending|confirmed|completed|cancelled`, refunds → `cancelled`), only `confirmed` admits; `event.total/admitted` include non-confirmed; `since` = `created_at > since OR checked_in_at > since`; unknown event → 403; non-UUID id → 404 no code; timestamps carry microseconds.
  - §3 batch: only `ok`/`already_checked_in` carry extra fields (`ok` ticket = `{id,ticket_type,ticket_index,seat}`; `already_checked_in` `scanned_by` never null, `by_me` boolean); a replay ignores the new item content; ≤ 5 min future is clamped to now; `ticket_id` must be a UUID or BH1/BH2 code (not a URL); `static_not_allowed` only for mode `offline` with a bare UUID; 401 and malformed-id 404 have no code.
  - §3: `/api/ticket-keys` is on the `public` tier (60/min per IP) — mobile refreshes keys from the roster's first page instead.
  - §3 live scan / summary / scannable: PR #192 and #205 are on web `main`; production probe 2026-10-07 (signed out): `/api/events/scannable`, `…/scan/roster`, `…/scan/batch` return 401, `/api/ticket-keys` returns one signing key `kid "1"`. Whether customers are issued BH2 (`TICKET_TOKEN_FORMAT=2`) is unverified until a real ticket is checked.
  - Mark the "Gap (historical, before PR #192)" paragraph as superseded.

- [ ] **Step 2: Full local verification**

Run: `npx tsc --noEmit && npx expo lint && npx jest`
Expected: all pass. Report any failure verbatim; don't commit over it.

- [ ] **Step 3: Commit the docs**

```bash
git add docs/BACKEND_STATUS.md
git commit -m "docs: offline scan contracts verified 2026-10-07"
```
(`docs/BACKEND_STATUS.md` also has an uncommitted owner edit from 2026-10-05 in §9 — it is included in this commit; mention that in the hand-off.)

- [ ] **Step 4: Reviews** — dispatch in parallel: `offline-scan-reviewer`, `mobile-security-reviewer`, `rn-code-reviewer`, `perf-auditor`, `ux-design-reviewer` on the branch diff. Fix confirmed findings in follow-up commits.

- [ ] **Step 5: Build** (ask the owner before starting it): `npx eas-cli@latest build --profile preview --platform android --non-interactive --no-wait`. SQLCipher is a native change, so the existing preview build cannot run this branch.

- [ ] **Step 6: Device checks on the Moto G06** (owner provides the test event + scanner, as in Phase 1); record results in `BACKEND_STATUS.md` §10:
  1. The DB file is encrypted: with a dev build, `adb shell run-as com.bookhushly.app head -c 16 databases/gate-<userId>.db` (or the path expo-sqlite uses) must **not** print `SQLite format 3`. If the `x'…'` key form fails to open, switch `openEncrypted` to `PRAGMA key = '<hex>'` (passphrase form, slower open) and note it.
  2. Download time and size for the test roster; then kill the app mid-download and confirm it resumes (scenario: resumable).
  3. Airplane mode: scan a valid BH2 → Admitted (offline) in < 150 ms (scenario 9); second scan → Already used by you; static on a live-ticket event → refused; BH1 → can't check offline (15b); tampered BH2 → invalid (15a).
  4. Reconnect → the sync bar counts down to 0; the web scan log shows the admission at the **scan** time.
  5. Two phones admit the same ticket offline → one shows it under "needs attention" as a duplicate (scenario 12).
  6. Set the phone clock +10 min while the scanner is open → clock warning; BH2 couldn't check; static still works (scenario 14). Lock the phone 10 min, unlock → no false warning.
  7. Sign out with pending admissions → blocked with "Sync now" (scenario 15).
  8. Inspect the DB (dev build): no email or full phone columns or values (15e).
  9. Kill the app right after an offline Admitted → reopen → the item is still pending and syncs.

---

## Self-review notes

- Spec coverage: §2.1 → Task 13; §2.2 → Tasks 4, 13, 15; §2.3 → Task 13 (`unreachable`); §2.4 → Tasks 10, 15; §2.5 → Task 6; §2.6 → Task 9; §2.7 → Tasks 12, 13; §3 units → Tasks 2, 3, 6–12; §4 → Task 6 (+12 for booking/list lookups); §5 → Task 3, 15 (rebase); §6 → Tasks 9, 11; §7 → Task 16; §8 → Task 14 (+15 dropList); §9 → done during planning (results folded in); §10 → every task + Task 17.
- Known limits carried from the spec: a clock changed while the app was closed is caught only at sync (`expired_code` → suspect); a 50k full swap holds an exclusive transaction for a moment every 30 min (measure in Task 17).
