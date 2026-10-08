# Phase 2b — Gate lookup, override, activity and shift summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff can find a guest by name or phone digits and admit them, admit an unlisted ticket with the supervisor PIN, see and export everything the phone recorded, and see a shift summary at sign-out — all on top of the Phase 2a offline store.

**Architecture:** Pure domain units (PIN verify, lockout, lookup parsing, CSV) under Jest; store changes in the encrypted SQLite layer from 2a (migration 2); the offline gate and controller gain lookup/override/activity/tally entry points; the scan session gains `show(outcome)` so non-scan admissions reuse the overlay; new sheets for PIN, find-guest and activity.

**Tech Stack:** Expo SDK 57, expo-sqlite (SQLCipher), `@noble/hashes` scrypt, `expo-sharing`, `expo-file-system` (new API: `File`, `Paths`), Zustand, RNTL v14 (async), Jest on `node:sqlite`.

**Spec:** `docs/superpowers/specs/2026-10-07-phase-2b-gate-lookup-override-design.md` (read with this plan). Builds on Phase 2a code in `src/features/gate/{domain,offline,ui}`.

## Global Constraints

- Branch `feat/phase-2b-gate-lookup-override`. Commit only the task's paths (`git add <paths>`, never `-A`). **No `Co-Authored-By` or any trailer.** Don't touch `CLAUDE.md` or `.claude/` (owner's uncommitted edits).
- Install only with `npx expo install <pkg>`.
- TS strict + `noUncheckedIndexedAccess`; ESLint strictTypeChecked: no `any`, no `@ts-ignore`, no non-null `!`, numbers in templates via `String()`, no floating promises, `require-await`, store/controller methods as arrow-function properties (`unbound-method`).
- `src/features/*/domain/**` and `src/shared/lib/**` import no `react`/`react-native`/`expo*`. No cross-feature imports (auth ↔ gate only through `src/shared/lib/signOutGuard.ts`).
- Tokens only (no raw hex, no `fontWeight`), `Text` from `@/shared/ui`, touch targets ≥ 44 pt (`density.gate.minTarget`), sentence-case copy, no `console.*`.
- DB rules from 2a: everything through the serial queue; **inside `db.tx(async (t) => …)` use only `t`**; write-ahead (the outbox row commits before any success UI).
- Gate outcomes only Admitted / Already used / Refused / Couldn't check; no undo anywhere.
- PIN: 6 digits; reason 3–200 chars (required for override, optional for lookup); approver 1–80 chars (required whenever the PIN is asked). Lockout: 5 failures → 15 min, stored in the encrypted DB. Verifier bounds: `N ≤ 32768` and a power of two, `r ≤ 16`, `p ≤ 4`, `dk_len = 32`, salt and hash canonical base64url (16 and 32 bytes).
- CSV export: **no holder names, no phone numbers**. Columns exactly: `ticket_ref, ticket_type, ticket_number, scanned_at, mode, state, server_note, reason, approved_by`.
- Lookup on a `require_dynamic_ticket` event needs PIN + approver. Lookup admissions sync as `manual_lookup` with `code` = ticket UUID; overrides as `offline_override` with the scanned code.
- Test command: `npx jest <path>`; before each commit `npx tsc --noEmit` and `npx expo lint`.

## Review Focus

1. **Override after the list caught up:** the "Not in offline list" overlay is still up, but a delta has since added the ticket. The override must then behave like a normal admission (conditional update; "Already used — by you" if already in), never a second outbox row. Pinned in Task 5 (`recordOverride` when the roster has the row).
2. **Typing during the scrypt check:** a second "Confirm" tap while "Checking…" must not run two checks or count two failures. Pinned in Task 9 (PinSheet disables submit while checking).
3. **The device clock jumps back during a lockout:** a lock must not end early because the phone clock moved. Lock times use the server-corrected clock and are compared with `>=`; pinned in Task 2 (lock with a clock earlier than the lock start stays locked for at most the full 15 min from the stored time).
4. **Search input with SQL wildcards** (`%`, `_`, `\`) must match literally, not everything. Pinned in Task 4 (search escapes LIKE wildcards).
5. **Export with an approver name containing a comma, quote, newline or a leading `=`** must produce a valid, safe CSV row. Pinned in Task 3.

---

### Task 1: PIN verifier (scrypt) and dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`, `app.json` (if `npx expo install` adds plugins) via `npx expo install @noble/hashes expo-sharing expo-file-system`
- Create: `src/features/gate/domain/overridePin.ts`
- Test: `src/features/gate/domain/__tests__/overridePin.test.ts`

**Interfaces:**
- Produces:
```ts
export type PinVerifier = { N: number; r: number; p: number; dkLen: 32; salt: Uint8Array; hash: Uint8Array };
export function parseVerifier(raw: unknown): PinVerifier | null;   // bounds-checked; null = no usable override
export function isPinShape(pin: string): boolean;                   // exactly 6 ASCII digits
export function verifyPin(pin: string, v: PinVerifier): Promise<boolean>;
```

Facts: `@noble/hashes` 2.4.0 — `import { scryptAsync } from '@noble/hashes/scrypt.js'`, `scryptAsync(password: string | Uint8Array, salt: Uint8Array, { N, r, p, dkLen, asyncTick? })` → `Promise<Uint8Array>`; strings are UTF-8; default maxmem 1 GiB (N=8192 r=8 needs ~8 MiB). `@noble/hashes` has no constant-time compare — write an XOR-accumulate compare. Roster `override` object (web): `{ enabled: true, alg: "scrypt", N, r, p, dk_len, salt (base64url), hash (base64url), set_at }`. `jest` already transforms `@noble`.

- [ ] **Step 1: Install**

Run: `npx expo install @noble/hashes expo-sharing expo-file-system`
(`@noble/hashes` and `expo-file-system` are already in `node_modules` transitively; this makes them direct, pinned dependencies. `expo-sharing` needs no config plugin for sending files; if the installer adds an `expo-sharing` plugin entry anyway, keep it.)

- [ ] **Step 2: Failing test** — `src/features/gate/domain/__tests__/overridePin.test.ts`:
```ts
import { isPinShape, parseVerifier, verifyPin } from '@/features/gate/domain/overridePin';

// Known-answer vector published by the web (docs/superpowers/specs/2026-10-03-scan-override-pin-design.md).
const KAT = {
  enabled: true,
  alg: 'scrypt',
  N: 8192,
  r: 8,
  p: 1,
  dk_len: 32,
  salt: 'ABEiM0RVZneImaq7zN3u_w',
  hash: 'L8yIIos_9EAoJkqiN2s2Qv6pNMzKe65LM05K0fZtgeA',
  set_at: '2026-10-03T12:00:00Z',
};

describe('override PIN', () => {
  it('accepts the published known-answer vector', async () => {
    const v = parseVerifier(KAT);
    expect(v).not.toBeNull();
    if (v === null) return;
    await expect(verifyPin('123456', v)).resolves.toBe(true);
  });
  it('rejects a wrong PIN', async () => {
    const v = parseVerifier(KAT);
    if (v === null) throw new Error('fixture');
    await expect(verifyPin('123457', v)).resolves.toBe(false);
  });
  it.each([
    ['null', null],
    ['not scrypt', { ...KAT, alg: 'pbkdf2' }],
    ['N too large', { ...KAT, N: 65536 }],
    ['N not a power of two', { ...KAT, N: 8000 }],
    ['r too large', { ...KAT, r: 32 }],
    ['p too large', { ...KAT, p: 8 }],
    ['dk_len not 32', { ...KAT, dk_len: 64 }],
    ['short salt', { ...KAT, salt: 'ABEiM0RVZneImaq7' }],
    ['bad hash', { ...KAT, hash: 'nope' }],
    ['disabled', { ...KAT, enabled: false }],
  ])('treats %s as no usable override', (_n, raw) => {
    expect(parseVerifier(raw)).toBeNull();
  });
  it('a PIN must be exactly six digits', () => {
    expect(isPinShape('123456')).toBe(true);
    expect(isPinShape('12345')).toBe(false);
    expect(isPinShape('1234567')).toBe(false);
    expect(isPinShape('12345a')).toBe(false);
    expect(isPinShape('١٢٣٤٥٦')).toBe(false);
  });
});
```

- [ ] **Step 3: Run** `npx jest src/features/gate/domain/__tests__/overridePin.test.ts` → FAIL (module missing).

- [ ] **Step 4: Implement `src/features/gate/domain/overridePin.ts`**
```ts
import { scryptAsync } from '@noble/hashes/scrypt.js';

import { decodeBase64url } from '@/shared/lib/base64url';

export type PinVerifier = {
  N: number;
  r: number;
  p: number;
  dkLen: 32;
  salt: Uint8Array;
  hash: Uint8Array;
};

const PIN_RE = /^[0-9]{6}$/;
const isPow2 = (n: number) => Number.isInteger(n) && n >= 2 && (n & (n - 1)) === 0;
const num = (o: object, k: string): number | null =>
  k in o && typeof (o as Record<string, unknown>)[k] === 'number'
    ? ((o as Record<string, unknown>)[k] as number)
    : null;
const str = (o: object, k: string): string | null =>
  k in o && typeof (o as Record<string, unknown>)[k] === 'string'
    ? ((o as Record<string, unknown>)[k] as string)
    : null;

/**
 * The roster's `override` object → a verifier, or null when there is no usable override.
 * Bounds stop a tampered or broken roster from making the phone hash for minutes or run out of
 * memory (web spec: N=8192 r=8 p=1 dk_len=32 today).
 */
export function parseVerifier(raw: unknown): PinVerifier | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.enabled !== true || o.alg !== 'scrypt') return null;
  const N = num(raw, 'N');
  const r = num(raw, 'r');
  const p = num(raw, 'p');
  const dk = num(raw, 'dk_len');
  if (N === null || r === null || p === null || dk !== 32) return null;
  if (!isPow2(N) || N > 32_768 || !Number.isInteger(r) || r < 1 || r > 16) return null;
  if (!Number.isInteger(p) || p < 1 || p > 4) return null;
  const saltText = str(raw, 'salt');
  const hashText = str(raw, 'hash');
  const salt = saltText === null ? null : decodeBase64url(saltText, 16);
  const hash = hashText === null ? null : decodeBase64url(hashText, 32);
  if (salt === null || hash === null) return null;
  return { N, r, p, dkLen: 32, salt, hash };
}

export const isPinShape = (pin: string): boolean => PIN_RE.test(pin);

// Compare every byte so the time taken doesn't depend on where the first difference is.
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** FR-3.15: checked on the phone; the server can't check it (web spec decision 5). */
export async function verifyPin(pin: string, v: PinVerifier): Promise<boolean> {
  if (!isPinShape(pin)) return false;
  const derived = await scryptAsync(pin, v.salt, { N: v.N, r: v.r, p: v.p, dkLen: v.dkLen });
  return sameBytes(derived, v.hash);
}
```
If ESLint objects to the `as` casts in `num`/`str`, replace them with a small `get(o, k): unknown` helper that uses `Object.getOwnPropertyDescriptor(o, k)?.value` — keep behaviour identical.

- [ ] **Step 5: Run** the test → PASS (the KAT may take ~1 s under Jest). Then `npx tsc --noEmit`, `npx expo lint`.

- [ ] **Step 6: Commit**
```bash
git add package.json package-lock.json src/features/gate/domain/overridePin.ts src/features/gate/domain/__tests__/overridePin.test.ts
git commit -m "feat(gate): verify the supervisor override PIN on the phone"
```
(Also add `app.json` if the installer changed it.)

---

### Task 2: Override lockout and lookup query parsing

**Files:**
- Create: `src/features/gate/domain/overrideLock.ts`, `src/features/gate/domain/lookupQuery.ts`
- Test: `src/features/gate/domain/__tests__/overrideLock.test.ts`, `src/features/gate/domain/__tests__/lookupQuery.test.ts`

**Interfaces:**
- Produces:
```ts
// overrideLock.ts
export const MAX_FAILURES = 5;
export const LOCK_MS = 15 * 60_000;
export type LockRecord = { failures: number; lockedUntil: number | null };
export const NO_LOCK: LockRecord;
export type LockState = { kind: 'open'; triesLeft: number } | { kind: 'locked'; minutesLeft: number };
export function lockState(rec: LockRecord, nowMs: number): LockState;
export function afterFailure(rec: LockRecord, nowMs: number): LockRecord;
export function afterSuccess(): LockRecord;
// lookupQuery.ts
export type LookupQuery = { kind: 'phoneTail' | 'phoneHead' | 'name'; value: string };
export function parseLookup(input: string): LookupQuery | null;
```

- [ ] **Step 1: Failing tests**

`overrideLock.test.ts`:
```ts
import { afterFailure, afterSuccess, LOCK_MS, lockState, NO_LOCK } from '@/features/gate/domain/overrideLock';

const T = Date.parse('2026-10-07T18:00:00Z');

describe('override lockout', () => {
  it('starts open with 5 tries', () => {
    expect(lockState(NO_LOCK, T)).toEqual({ kind: 'open', triesLeft: 5 });
  });
  it('counts down and locks on the 5th failure', () => {
    let rec = NO_LOCK;
    for (let i = 0; i < 4; i++) rec = afterFailure(rec, T);
    expect(lockState(rec, T)).toEqual({ kind: 'open', triesLeft: 1 });
    rec = afterFailure(rec, T);
    expect(rec).toEqual({ failures: 5, lockedUntil: T + LOCK_MS });
    expect(lockState(rec, T)).toEqual({ kind: 'locked', minutesLeft: 15 });
    expect(lockState(rec, T + LOCK_MS - 61_000)).toEqual({ kind: 'locked', minutesLeft: 2 });
  });
  it('unlocks when the time is up, with a fresh count', () => {
    const rec = { failures: 5, lockedUntil: T + LOCK_MS };
    expect(lockState(rec, T + LOCK_MS)).toEqual({ kind: 'open', triesLeft: 5 });
    expect(afterFailure(rec, T + LOCK_MS)).toEqual({ failures: 1, lockedUntil: null });
  });
  it('a clock that moved back never shortens the lock beyond its stored end', () => {
    const rec = { failures: 5, lockedUntil: T + LOCK_MS };
    expect(lockState(rec, T - 60 * 60_000)).toEqual({ kind: 'locked', minutesLeft: 15 });
  });
  it('a correct PIN resets the count', () => {
    expect(afterSuccess()).toEqual(NO_LOCK);
  });
});
```

`lookupQuery.test.ts`:
```ts
import { parseLookup } from '@/features/gate/domain/lookupQuery';

describe('parseLookup', () => {
  it.each([
    ['21', { kind: 'phoneTail', value: '21' }],
    ['210', { kind: 'phoneTail', value: '210' }],
    [' 0803 ', { kind: 'phoneHead', value: '0803' }],
    ['ada', { kind: 'name', value: 'ada' }],
    ['  Ada Obi ', { kind: 'name', value: 'Ada Obi' }],
    ['Ọlá', { kind: 'name', value: 'Ọlá' }],
  ] as const)('%s', (input, out) => {
    expect(parseLookup(input)).toEqual(out);
  });
  it.each(['', '1', 'a', '12345', '08031234567', '%%'])('ignores %j', (input) => {
    expect(parseLookup(input)).toBeNull();
  });
});
```

- [ ] **Step 2: Run** both → FAIL.

- [ ] **Step 3: Implement**

`overrideLock.ts`:
```ts
// FR-3.15: lock the override for 15 minutes after 5 wrong PINs, persisted across restarts (the
// caller stores the record in the encrypted DB). Times are the server-corrected clock.
export const MAX_FAILURES = 5;
export const LOCK_MS = 15 * 60_000;

export type LockRecord = { failures: number; lockedUntil: number | null };
export const NO_LOCK: LockRecord = { failures: 0, lockedUntil: null };
export type LockState = { kind: 'open'; triesLeft: number } | { kind: 'locked'; minutesLeft: number };

const isLocked = (rec: LockRecord, nowMs: number) => rec.lockedUntil !== null && nowMs < rec.lockedUntil;

export function lockState(rec: LockRecord, nowMs: number): LockState {
  if (rec.lockedUntil !== null) {
    if (isLocked(rec, nowMs)) {
      // A clock moved back can't stretch the lock beyond its full length.
      const left = Math.min(rec.lockedUntil - nowMs, LOCK_MS);
      return { kind: 'locked', minutesLeft: Math.ceil(left / 60_000) };
    }
    return { kind: 'open', triesLeft: MAX_FAILURES };
  }
  return { kind: 'open', triesLeft: Math.max(0, MAX_FAILURES - rec.failures) };
}

export function afterFailure(rec: LockRecord, nowMs: number): LockRecord {
  const base = rec.lockedUntil !== null && !isLocked(rec, nowMs) ? NO_LOCK : rec;
  const failures = base.failures + 1;
  return failures >= MAX_FAILURES
    ? { failures, lockedUntil: nowMs + LOCK_MS }
    : { failures, lockedUntil: null };
}

export const afterSuccess = (): LockRecord => NO_LOCK;
```

`lookupQuery.ts`:
```ts
export type LookupQuery = { kind: 'phoneTail' | 'phoneHead' | 'name'; value: string };

const DIGITS = /^[0-9]+$/;
const LETTER = /\p{L}/u;

// FR-3.7. The roster holds masked phones like "0803••••210": only the first 4 and the last 3 digits
// are visible, so 2–3 digits search the tail and 4 digits the head.
export function parseLookup(input: string): LookupQuery | null {
  const value = input.trim().replace(/\s+/g, ' ');
  if (DIGITS.test(value)) {
    if (value.length === 2 || value.length === 3) return { kind: 'phoneTail', value };
    if (value.length === 4) return { kind: 'phoneHead', value };
    return null;
  }
  const letters = [...value].filter((c) => LETTER.test(c)).length;
  return letters >= 2 ? { kind: 'name', value } : null;
}
```

- [ ] **Step 4: Run** → PASS; `npx tsc --noEmit`; `npx expo lint`.

- [ ] **Step 5: Commit**
```bash
git add src/features/gate/domain/overrideLock.ts src/features/gate/domain/lookupQuery.ts src/features/gate/domain/__tests__/overrideLock.test.ts src/features/gate/domain/__tests__/lookupQuery.test.ts
git commit -m "feat(gate): override lockout and guest lookup parsing"
```

---

### Task 3: CSV and activity rows

**Files:**
- Create: `src/shared/lib/csv.ts`, `src/features/gate/domain/activityCsv.ts`
- Test: `src/shared/lib/__tests__/csv.test.ts`, `src/features/gate/domain/__tests__/activityCsv.test.ts`

**Interfaces:**
- Consumes: `OutboxState` (type, `@/features/gate/offline/outboxStore`), `attentionLine(item)` from `domain/syncLine.ts` (returns '' for pending/sending/synced).
- Produces:
```ts
// csv.ts
export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null)[])[]): string;
// activityCsv.ts
export type ActivityRow = {
  ticketId: string; ticketType: string | null; ticketIndex: number | null; scannedAt: string;
  mode: 'offline' | 'manual_lookup' | 'offline_override'; state: OutboxState;
  result: Record<string, unknown> | null; reason: string | null; approvedBy: string | null;
};
export const ACTIVITY_HEADER: readonly string[];
export function activityCsv(items: readonly ActivityRow[]): string;
```

- [ ] **Step 1: Failing tests**

`csv.test.ts`:
```ts
import { toCsv } from '@/shared/lib/csv';

describe('toCsv', () => {
  it('joins with commas and CRLF, quoting only when needed', () => {
    expect(toCsv(['a', 'b'], [['x', 1], [null, 'y']])).toBe('a,b\r\nx,1\r\n,y\r\n');
  });
  it('quotes commas, quotes and newlines (RFC 4180)', () => {
    expect(toCsv(['a'], [['O, "Ada"\nObi']])).toBe('a\r\n"O, ""Ada""\nObi"\r\n');
  });
  it('neutralises spreadsheet formulas', () => {
    expect(toCsv(['a'], [['=HYPERLINK("x")'], ['+1'], ['-2'], ['@SUM'], ['\tx']])).toBe(
      'a\r\n"\'=HYPERLINK(""x"")"\r\n\'+1\r\n\'-2\r\n\'@SUM\r\n\'\tx\r\n',
    );
  });
});
```

`activityCsv.test.ts`:
```ts
import { ACTIVITY_HEADER, activityCsv, type ActivityRow } from '@/features/gate/domain/activityCsv';

const row = (over: Partial<ActivityRow> = {}): ActivityRow => ({
  ticketId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  ticketType: 'VIP',
  ticketIndex: 2,
  scannedAt: '2026-10-07T18:00:00.000Z',
  mode: 'offline_override',
  state: 'duplicate',
  result: { scanned_by: 'Ada', checked_in_at: '2026-10-07T17:55:00Z' },
  reason: 'Bought at the door',
  approvedBy: 'Tunde',
  ...over,
});

describe('activityCsv', () => {
  it('has exactly the agreed columns', () => {
    expect(ACTIVITY_HEADER).toEqual([
      'ticket_ref', 'ticket_type', 'ticket_number', 'scanned_at', 'mode', 'state', 'server_note', 'reason', 'approved_by',
    ]);
  });
  it('writes one row per item with a short ticket reference', () => {
    const lines = activityCsv([row()]).split('\r\n');
    expect(lines[1]).toBe(
      '3f2504e0,VIP,2,2026-10-07T18:00:00.000Z,offline_override,duplicate,Also admitted by Ada at ' +
        lines[1]?.split(',')[6]?.slice('Also admitted by Ada at '.length) +
        ',Bought at the door,Tunde',
    );
  });
  it('never contains a full ticket id', () => {
    expect(activityCsv([row()])).not.toContain('3f2504e0-4f89');
  });
  it('a synced item has an empty server note', () => {
    const line = activityCsv([row({ state: 'synced', result: null, reason: null, approvedBy: null, mode: 'offline' })]).split('\r\n')[1];
    expect(line).toBe('3f2504e0,VIP,2,2026-10-07T18:00:00.000Z,offline,synced,,,');
  });
});
```
(The server-note time is local `HH:MM`, so the test reads it back rather than hard-coding a timezone.)

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`src/shared/lib/csv.ts`:
```ts
type Cell = string | number | null;

// Spreadsheet apps run cells starting with these as formulas (CSV injection).
const FORMULA = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

function cell(v: Cell): string {
  if (v === null) return '';
  let s = typeof v === 'number' ? String(v) : v;
  if (typeof v === 'string' && FORMULA.test(s)) s = `'${s}`;
  return NEEDS_QUOTES.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with CRLF line ends, safe to open in a spreadsheet. */
export function toCsv(header: readonly string[], rows: readonly (readonly Cell[])[]): string {
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
```
Note: numbers are never prefixed (a negative number column doesn't exist here); only strings are guarded.

`src/features/gate/domain/activityCsv.ts`:
```ts
import type { OutboxState } from '@/features/gate/offline/outboxStore';
import { toCsv } from '@/shared/lib/csv';

import { attentionLine } from './syncLine';

export type ActivityRow = {
  ticketId: string;
  ticketType: string | null;
  ticketIndex: number | null;
  scannedAt: string;
  mode: 'offline' | 'manual_lookup' | 'offline_override';
  state: OutboxState;
  result: Record<string, unknown> | null;
  reason: string | null;
  approvedBy: string | null;
};

export const ACTIVITY_HEADER: readonly string[] = [
  'ticket_ref',
  'ticket_type',
  'ticket_number',
  'scanned_at',
  'mode',
  'state',
  'server_note',
  'reason',
  'approved_by',
];

// Spec decision 3: no holder names or phone numbers leave the phone in an export; the organiser
// has full details on the web. A short ticket reference is enough to find the row there.
export function activityCsv(items: readonly ActivityRow[]): string {
  return toCsv(
    ACTIVITY_HEADER,
    items.map((i) => [
      i.ticketId.replace(/-/g, '').slice(0, 8),
      i.ticketType,
      i.ticketIndex,
      i.scannedAt,
      i.mode,
      i.state,
      attentionLine({ state: i.state, result: i.result }),
      i.reason,
      i.approvedBy,
    ]),
  );
}
```

- [ ] **Step 4: Run** → PASS; tsc; lint.

- [ ] **Step 5: Commit**
```bash
git add src/shared/lib/csv.ts src/shared/lib/__tests__/csv.test.ts src/features/gate/domain/activityCsv.ts src/features/gate/domain/__tests__/activityCsv.test.ts
git commit -m "feat(gate): safe CSV for the activity export, without guest details"
```

---

### Task 4: Migration 2, the stored verifier, and roster search

**Files:**
- Modify: `src/features/gate/offline/schema.ts`, `src/features/gate/schemas/roster.ts`, `src/features/gate/offline/rosterStore.ts`, `src/features/gate/offline/rosterSync.ts`
- Test: `src/features/gate/offline/__tests__/migration2.test.ts`, `src/features/gate/offline/__tests__/rosterSearch.test.ts`, `src/features/gate/offline/__tests__/rosterSync.test.ts` (add one case)

**Interfaces:**
- Consumes: `LookupQuery` (Task 2); existing `RosterStore`, `RosterTicket`, `beginSync(eventId, kind, mark, info, keys)`.
- Produces:
  - `MIGRATIONS[1]`: `ALTER TABLE roster_meta ADD COLUMN override TEXT; ALTER TABLE outbox ADD COLUMN reason TEXT; ALTER TABLE outbox ADD COLUMN approved_by TEXT;`
  - `rosterPage` gains `override: z.unknown().optional()` (first page only; `null` = no PIN).
  - `RosterMeta` gains `override: unknown` (the parsed JSON object, or `null`).
  - `beginSync(eventId, kind, mark, info, keys, override?: unknown)` — `undefined` keeps the stored verifier, `null` clears it, an object stores `JSON.stringify(object)`.
  - `export type GuestRow = RosterTicket & { holderName: string | null; phoneMasked: string | null };`
  - `rosterStore.search(eventId: string, q: LookupQuery): Promise<GuestRow[]>` (≤ 50 rows).
  - `rosterStore.bookingTickets(eventId: string, bookingId: string): Promise<GuestRow[]>` (ordered by ticket_index).
  - `syncRoster` passes the first page's `override` to `beginSync` (only when `cursor === null`).

- [ ] **Step 1: Failing tests**

`migration2.test.ts`:
```ts
import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { MIGRATIONS } from '@/features/gate/offline/schema';

it('migration 2 keeps existing rows and adds the new columns', async () => {
  const db = nodeSql();
  await migrate(db, MIGRATIONS.slice(0, 1));
  await db.run(
    "INSERT INTO outbox (event_id, ticket_id, code, scanned_at, mode, app_version, state) VALUES ('e', 't', 't', 'x', 'offline', '1', 'pending')",
  );
  await migrate(db, MIGRATIONS);
  expect(await db.get<{ user_version: number }>('PRAGMA user_version')).toEqual({ user_version: 2 });
  expect(await db.get('SELECT ticket_id, reason, approved_by FROM outbox')).toEqual({ ticket_id: 't', reason: null, approved_by: null });
  const cols = await db.all<{ name: string }>("SELECT name FROM pragma_table_info('roster_meta')");
  expect(cols.map((c) => c.name)).toContain('override');
});
```

`rosterSearch.test.ts`:
```ts
import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { createRosterStore, type RosterRow } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';

const EV = 'e0000000-0000-4000-8000-000000000001';
const row = (n: number, over: Partial<RosterRow> = {}): RosterRow => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  ticketType: 'Regular',
  ticketIndex: 1,
  bookingId: `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  bookingStatus: 'confirmed',
  checkedInAt: null,
  scannedBy: null,
  byMe: null,
  holderName: null,
  phoneMasked: null,
  seat: null,
  ...over,
});

async function setup(rows: RosterRow[]) {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const store = createRosterStore(db);
  await store.beginSync(EV, 'full', '2026-10-07T17:00:00Z', { title: null, eventDate: null, requireDynamic: false, total: rows.length }, [], null);
  await store.writePage(EV, 'full', rows, null);
  await store.finishSync(EV, 'full');
  return store;
}

describe('roster search', () => {
  it('finds by name, case-insensitively, anywhere in the name', async () => {
    const s = await setup([row(1, { holderName: 'Ada Obi' }), row(2, { holderName: 'Tunde' })]);
    expect((await s.search(EV, { kind: 'name', value: 'obi' })).map((r) => r.holderName)).toEqual(['Ada Obi']);
  });
  it('finds by the visible head or tail of a masked phone', async () => {
    const s = await setup([row(1, { phoneMasked: '0803••••210' }), row(2, { phoneMasked: '0812••••555' })]);
    expect((await s.search(EV, { kind: 'phoneTail', value: '210' })).length).toBe(1);
    expect((await s.search(EV, { kind: 'phoneTail', value: '10' })).length).toBe(1);
    expect((await s.search(EV, { kind: 'phoneHead', value: '0812' })).length).toBe(1);
  });
  it('matches SQL wildcards literally', async () => {
    const s = await setup([row(1, { holderName: 'Ada' }), row(2, { holderName: '50%_off\\' })]);
    expect((await s.search(EV, { kind: 'name', value: '%_' })).map((r) => r.holderName)).toEqual(['50%_off\\']);
  });
  it('caps results at 50, not-yet-in first', async () => {
    const rows = Array.from({ length: 60 }, (_, i) => row(i + 1, { holderName: `Guest ${String(i)}`, checkedInAt: i < 30 ? 'x' : null }));
    const res = await setup(rows).then((s) => s.search(EV, { kind: 'name', value: 'guest' }));
    expect(res).toHaveLength(50);
    expect(res[0]?.checkedInAt).toBeNull();
  });
  it('lists a booking’s tickets in order', async () => {
    const b = 'b0000000-0000-4000-8000-00000000000b';
    const s = await setup([row(1, { bookingId: b, ticketIndex: 2 }), row(2, { bookingId: b, ticketIndex: 1 })]);
    expect((await s.bookingTickets(EV, b)).map((r) => r.ticketIndex)).toEqual([1, 2]);
  });
  it('stores, keeps and clears the override verifier', async () => {
    const s = await setup([row(1)]);
    const v = { enabled: true, alg: 'scrypt' };
    await s.beginSync(EV, 'delta', '2026-10-07T17:05:00Z', { title: null, eventDate: null, requireDynamic: false, total: 1 }, null, v);
    await s.finishSync(EV, 'delta');
    expect((await s.meta(EV))?.override).toEqual(v);
    await s.beginSync(EV, 'delta', '2026-10-07T17:06:00Z', { title: null, eventDate: null, requireDynamic: false, total: 1 }, null, undefined);
    await s.finishSync(EV, 'delta');
    expect((await s.meta(EV))?.override).toEqual(v);
    await s.beginSync(EV, 'delta', '2026-10-07T17:07:00Z', { title: null, eventDate: null, requireDynamic: false, total: 1 }, null, null);
    await s.finishSync(EV, 'delta');
    expect((await s.meta(EV))?.override).toBeNull();
  });
});
```
Add to `rosterSync.test.ts` (inside its `describe('syncRoster')`, reusing its helpers): a first page with `override: { enabled: true, alg: 'scrypt' }` stores it (`(await store.meta(EV))?.override` equals that object), and a resumed page without `override` leaves it.

Also update every existing `beginSync(…)` call site in tests/code that passes 5 arguments — the 6th is optional, so they keep compiling.

- [ ] **Step 2: Run** `npx jest src/features/gate/offline` → the new tests FAIL.

- [ ] **Step 3: Implement**

`schema.ts` — append to `MIGRATIONS`:
```ts
  // 2b: the supervisor-override verifier (first roster page), and reason / approver on outbox items.
  `
  ALTER TABLE roster_meta ADD COLUMN override TEXT;
  ALTER TABLE outbox ADD COLUMN reason TEXT;
  ALTER TABLE outbox ADD COLUMN approved_by TEXT;
  `,
```

`schemas/roster.ts` — in `rosterPage` add `override: z.unknown().optional(),` (parsed and bounds-checked later by `parseVerifier`).

`rosterSync.ts` — in the `cursor === null` branch pass the override:
```ts
    if (cursor === null) {
      await store.beginSync(eventId, kind, page.server_time, infoOf(page), keysOf(page), page.override);
    }
```

`rosterStore.ts`:
- `RosterMeta`: add `override: unknown;`. `MetaSqlRow`: add `override: string | null;`. In `toMeta`: `override: parseJson(r.override)` where
```ts
const parseJson = (text: string | null): unknown => {
  if (text === null) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};
```
- `beginSync` signature gains `override?: unknown` and, inside the same `tx` after the keys update:
```ts
        // undefined: this page didn't say (keep); null: the organiser removed the PIN (clear).
        if (override !== undefined) {
          await t.run('UPDATE roster_meta SET override = ? WHERE event_id = ?', [
            override === null ? null : JSON.stringify(override),
            eventId,
          ]);
        }
```
- Add `GuestRow`, a `GUEST_SELECT` and the two queries:
```ts
export type GuestRow = RosterTicket & { holderName: string | null; phoneMasked: string | null };

type GuestSqlRow = TicketSqlRow & { holder_name: string | null; phone_masked: string | null };
const toGuest = (r: GuestSqlRow): GuestRow => ({
  ...toTicket(r),
  holderName: r.holder_name,
  phoneMasked: r.phone_masked,
});
const GUEST_SELECT =
  'SELECT id, ticket_type, ticket_index, booking_id, booking_status, checked_in_at, scanned_by, by_me, holder_name, phone_masked FROM roster_ticket';
const SEARCH_LIMIT = 50;
// LIKE wildcards in what staff type must match literally.
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
```
and in the returned object:
```ts
    search: async (eventId: string, q: LookupQuery): Promise<GuestRow[]> => {
      const v = likeEscape(q.value);
      const [where, param] =
        q.kind === 'name'
          ? ["holder_name LIKE ? ESCAPE '\\' COLLATE NOCASE", `%${v}%`]
          : q.kind === 'phoneTail'
            ? ["phone_masked LIKE ? ESCAPE '\\'", `%${v}`]
            : ["phone_masked LIKE ? ESCAPE '\\'", `${v}%`];
      return (
        await db.all<GuestSqlRow>(
          `${GUEST_SELECT} WHERE event_id = ? AND ${where}
           ORDER BY checked_in_at IS NOT NULL, holder_name, booking_id, ticket_index LIMIT ?`,
          [eventId, param, SEARCH_LIMIT],
        )
      ).map(toGuest);
    },

    bookingTickets: async (eventId: string, bookingId: string): Promise<GuestRow[]> =>
      (
        await db.all<GuestSqlRow>(`${GUEST_SELECT} WHERE event_id = ? AND booking_id = ? ORDER BY ticket_index`, [
          eventId,
          bookingId,
        ])
      ).map(toGuest),
```
(import `LookupQuery` as a type from `@/features/gate/domain/lookupQuery`). SQLite's `LIKE` is case-insensitive for ASCII only; `COLLATE NOCASE` doesn't change that for `LIKE`. Accented names still match their own case; that is accepted (device check covers real names).

- [ ] **Step 4: Run** `npx jest src/features/gate src/shared/db` → PASS; tsc; lint.

- [ ] **Step 5: Commit**
```bash
git add src/features/gate/offline/schema.ts src/features/gate/schemas/roster.ts src/features/gate/offline/rosterStore.ts src/features/gate/offline/rosterSync.ts src/features/gate/offline/__tests__/migration2.test.ts src/features/gate/offline/__tests__/rosterSearch.test.ts src/features/gate/offline/__tests__/rosterSync.test.ts
git commit -m "feat(gate): store the override verifier and search the roster by name or phone digits"
```

---

### Task 5: Outbox modes, override records, activity listing, device store, batch payload

**Files:**
- Modify: `src/features/gate/offline/outboxStore.ts`, `src/features/gate/api/batch.ts`, `src/features/gate/offline/batchSync.ts`, `src/features/gate/offline/gateDb.ts`
- Create: `src/features/gate/offline/deviceStore.ts`
- Test: `src/features/gate/offline/__tests__/outboxModes.test.ts`, `src/features/gate/offline/__tests__/deviceStore.test.ts`, `src/features/gate/offline/__tests__/batchSync.test.ts` (add one case)

**Interfaces:**
- Consumes: `LockRecord`, `NO_LOCK` (Task 2); `ActivityRow` (Task 3).
- Produces:
```ts
// outboxStore.ts
export type OutboxMode = 'offline' | 'manual_lookup' | 'offline_override';
export type Approval = { approvedBy: string; reason: string | null };
// OutboxItem.mode: OutboxMode; OutboxItem gains reason: string | null; approvedBy: string | null
// AdmissionInput gains: mode?: OutboxMode (default 'offline'); approval?: Approval
export type OverrideInput = { eventId: string; ticketId: string; code: string; scannedAt: string; appVersion: string; approval: Approval };
recordOverride: (input: OverrideInput) => Promise<RecordResult>;
export type ActivityTab = 'toSync' | 'attention' | 'synced';
list: (eventId: string, tab: ActivityTab, beforeSeq: number | null, limit: number) => Promise<AttentionItem[]>;
exportRows: (eventId: string) => Promise<ActivityRow[]>;
// deviceStore.ts
export type ShiftTally = { admitted: number; used: number; refused: number; couldntCheck: number };
export const EMPTY_TALLY: ShiftTally;
export function createDeviceStore(db: Sql): {
  lock: () => Promise<LockRecord>; setLock: (r: LockRecord) => Promise<void>;
  tally: () => Promise<ShiftTally>; addToTally: (k: keyof ShiftTally) => Promise<void>; resetTally: () => Promise<void>;
};
export type DeviceStore = ReturnType<typeof createDeviceStore>;
// gateDb.ts: GateDb gains `device: DeviceStore`
// api/batch.ts
export type BatchItem = { client_seq: number; ticket_id: string; scanned_at: string; mode: OutboxMode; reason?: string; approved_by?: string };
```

- [ ] **Step 1: Failing tests**

`outboxModes.test.ts`:
```ts
import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { createOutboxStore } from '@/features/gate/offline/outboxStore';
import { createRosterStore, type RosterRow } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';

const EV = 'e0000000-0000-4000-8000-000000000001';
const IN = '00000000-0000-4000-8000-000000000001';
const OUT = '00000000-0000-4000-8000-0000000000ff';
const row = (id: string): RosterRow => ({
  id, ticketType: 'VIP', ticketIndex: 1, bookingId: 'b', bookingStatus: 'confirmed', checkedInAt: null,
  scannedBy: null, byMe: null, holderName: 'Ada', phoneMasked: '0803••••210', seat: null,
});
const approval = { approvedBy: 'Tunde', reason: 'Bought at the door' };

async function setup() {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const roster = createRosterStore(db);
  await roster.beginSync(EV, 'full', '2026-10-07T17:00:00Z', { title: null, eventDate: null, requireDynamic: true, total: 1 }, [], null);
  await roster.writePage(EV, 'full', [row(IN)], null);
  await roster.finishSync(EV, 'full');
  return { roster, outbox: createOutboxStore(db, { newDeviceId: () => 'device-abcdef12' }) };
}
const base = { eventId: EV, scannedAt: '2026-10-07T18:00:00.000Z', appVersion: '1' };

describe('outbox modes', () => {
  it('a lookup admission records its mode and approval', async () => {
    const { outbox } = await setup();
    await outbox.recordAdmission({ ...base, ticketId: IN, code: IN, kid: null, mode: 'manual_lookup', approval: { approvedBy: 'Tunde', reason: null } });
    expect((await outbox.due(EV, 0, 10))[0]).toMatchObject({ mode: 'manual_lookup', approvedBy: 'Tunde', reason: null });
  });
  it('an override for an unlisted ticket writes only the outbox, once', async () => {
    const { outbox } = await setup();
    expect(await outbox.recordOverride({ ...base, ticketId: OUT, code: OUT, approval })).toEqual({ recorded: true, seq: 1 });
    expect(await outbox.recordOverride({ ...base, ticketId: OUT, code: `BH2.x`, approval })).toMatchObject({ recorded: false });
    expect(await outbox.due(EV, 0, 10)).toEqual([expect.objectContaining({ mode: 'offline_override', reason: 'Bought at the door', approvedBy: 'Tunde' })]);
  });
  it('an override for a ticket the list now has behaves like an admission', async () => {
    const { roster, outbox } = await setup();
    expect(await outbox.recordOverride({ ...base, ticketId: IN, code: IN, approval })).toMatchObject({ recorded: true });
    expect(await roster.ticket(EV, IN)).toMatchObject({ byMe: true });
    expect(await outbox.recordOverride({ ...base, ticketId: IN, code: IN, approval })).toMatchObject({ recorded: false, ticket: { id: IN } });
  });
  it('lists by tab, newest first, with paging, and exports rows', async () => {
    const { outbox } = await setup();
    await outbox.recordOverride({ ...base, ticketId: OUT, code: OUT, approval });
    await outbox.recordAdmission({ ...base, ticketId: IN, code: IN, kid: null });
    expect((await outbox.list(EV, 'toSync', null, 10)).map((i) => i.seq)).toEqual([2, 1]);
    expect((await outbox.list(EV, 'toSync', 2, 10)).map((i) => i.seq)).toEqual([1]);
    expect(await outbox.list(EV, 'synced', null, 10)).toEqual([]);
    const rows = await outbox.exportRows(EV);
    expect(rows.map((r) => r.mode)).toEqual(['offline_override', 'offline']);
    expect(rows[1]).toMatchObject({ ticketType: 'VIP', ticketIndex: 1 });
    expect(JSON.stringify(rows)).not.toContain('Ada');
  });
});
```

`deviceStore.test.ts`:
```ts
import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { createDeviceStore, EMPTY_TALLY } from '@/features/gate/offline/deviceStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';

it('keeps the lockout and the shift tally', async () => {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const d = createDeviceStore(db);
  expect(await d.lock()).toEqual({ failures: 0, lockedUntil: null });
  await d.setLock({ failures: 5, lockedUntil: 123 });
  expect(await createDeviceStore(db).lock()).toEqual({ failures: 5, lockedUntil: 123 });
  expect(await d.tally()).toEqual(EMPTY_TALLY);
  await d.addToTally('admitted');
  await d.addToTally('admitted');
  await d.addToTally('refused');
  expect(await d.tally()).toEqual({ ...EMPTY_TALLY, admitted: 2, refused: 1 });
  await d.resetTally();
  expect(await d.tally()).toEqual(EMPTY_TALLY);
});

it('an unreadable lock record fails closed', async () => {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  await db.run("INSERT INTO device (k, v) VALUES ('override_lock', 'garbage')");
  const rec = await createDeviceStore(db).lock();
  expect(rec.lockedUntil).not.toBeNull();
});
```
For "fails closed", `lock()` returns `{ failures: 5, lockedUntil: <now from deps> + LOCK_MS }`; give `createDeviceStore(db, { now })` an optional `now` dep defaulting to `Date.now` and assert `lockedUntil` is not null (as above).

Add to `batchSync.test.ts`: an override item is posted with `mode: 'offline_override', reason, approved_by` and a plain offline item without `reason`/`approved_by` keys.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`outboxStore.ts`:
- Types: add `OutboxMode`, `Approval`, `OverrideInput`, `ActivityTab`; `OutboxItem.mode: OutboxMode`, `reason`, `approvedBy`; `AdmissionInput` gains `mode?: OutboxMode; approval?: Approval`. `ItemSqlRow` gains `mode: string; reason: string | null; approved_by: string | null`. In `toItem`: `mode: MODES.find((m) => m === r.mode) ?? 'offline'`, `reason: r.reason`, `approvedBy: r.approved_by` (with `const MODES: readonly OutboxMode[] = ['offline', 'manual_lookup', 'offline_override']`).
- A shared insert used by both record paths (inside a tx, so it takes `t`):
```ts
async function insertItem(
  t: Sql,
  i: { eventId: string; ticketId: string; code: string; scannedAt: string; kid: string | null; appVersion: string; mode: OutboxMode; approval: Approval | null },
): Promise<number> {
  const r = await t.get<{ seq: number }>(
    `INSERT INTO outbox (event_id, ticket_id, code, scanned_at, mode, kid, app_version, state, reason, approved_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?) RETURNING client_seq AS seq`,
    [i.eventId, i.ticketId, i.code, i.scannedAt, i.mode, i.kid, i.appVersion, i.approval?.reason ?? null, i.approval?.approvedBy ?? null],
  );
  if (r === null) throw new Error('outbox insert returned no row');
  return r.seq;
}
```
- `recordAdmission` uses `insertItem(t, { ...input, mode: input.mode ?? 'offline', approval: input.approval ?? null })`.
- `recordOverride`:
```ts
    // FR-3.15: an unlisted ticket. If the list has since caught up, it is an ordinary admission
    // (Review Focus 1); otherwise only the outbox records it, once per ticket.
    recordOverride: (input: OverrideInput): Promise<RecordResult> =>
      db.tx(async (t): Promise<RecordResult> => {
        const listed = await readTicket(t, input.eventId, input.ticketId);
        if (listed !== null) {
          const u = await t.run(
            'UPDATE roster_ticket SET checked_in_at = ?, by_me = 1, scanned_by = NULL WHERE event_id = ? AND id = ? AND checked_in_at IS NULL',
            [input.scannedAt, input.eventId, input.ticketId],
          );
          if (u.changes === 0) return { recorded: false, ticket: await readTicket(t, input.eventId, input.ticketId) };
        } else {
          const dup = await t.get<{ one: number }>(
            'SELECT 1 AS one FROM outbox WHERE event_id = ? AND ticket_id = ? LIMIT 1',
            [input.eventId, input.ticketId],
          );
          if (dup !== null) return { recorded: false, ticket: null };
        }
        const seq = await insertItem(t, { ...input, kid: null, mode: 'offline_override', approval: input.approval });
        return { recorded: true, seq };
      }),
```
- `list` and `exportRows`:
```ts
const TAB_STATES: Record<ActivityTab, string> = {
  toSync: UNSYNCED,
  attention: ATTENTION,
  synced: "('synced')",
};
…
    list: async (eventId: string, tab: ActivityTab, beforeSeq: number | null, limit: number): Promise<AttentionItem[]> =>
      (
        await db.all<ItemSqlRow & { ticket_type: string | null; ticket_index: number | null }>(
          `SELECT o.*, r.ticket_type, r.ticket_index FROM outbox o
           LEFT JOIN roster_ticket r ON r.event_id = o.event_id AND r.id = o.ticket_id
           WHERE o.event_id = ? AND o.state IN ${TAB_STATES[tab]} AND o.client_seq < ?
           ORDER BY o.client_seq DESC LIMIT ?`,
          [eventId, beforeSeq ?? Number.MAX_SAFE_INTEGER, limit],
        )
      ).map((r) => ({ ...toItem(r), ticketType: r.ticket_type, ticketIndex: r.ticket_index })),

    exportRows: async (eventId: string): Promise<ActivityRow[]> =>
      (
        await db.all<ItemSqlRow & { ticket_type: string | null; ticket_index: number | null }>(
          `SELECT o.*, r.ticket_type, r.ticket_index FROM outbox o
           LEFT JOIN roster_ticket r ON r.event_id = o.event_id AND r.id = o.ticket_id
           WHERE o.event_id = ? ORDER BY o.client_seq`,
          [eventId],
        )
      ).map((r) => {
        const i = toItem(r);
        return {
          ticketId: i.ticketId, ticketType: r.ticket_type, ticketIndex: r.ticket_index, scannedAt: i.scannedAt,
          mode: i.mode, state: i.state, result: i.result, reason: i.reason, approvedBy: i.approvedBy,
        };
      }),
```
(Change `attention` to delegate: `attention: (eventId) => store.list(eventId, 'attention', null, 500)` — or keep it as is; either way its callers stay working.)

`api/batch.ts`: `BatchItem` as in Interfaces (import `OutboxMode` type from `@/features/gate/offline/outboxStore`).

`batchSync.ts` `toBatchItem`:
```ts
const toBatchItem = (i: OutboxItem): BatchItem => ({
  client_seq: i.seq,
  ticket_id: i.code,
  scanned_at: i.scannedAt,
  mode: i.mode,
  ...(i.reason !== null ? { reason: i.reason } : {}),
  ...(i.approvedBy !== null ? { approved_by: i.approvedBy } : {}),
});
```

`deviceStore.ts`:
```ts
import { LOCK_MS, MAX_FAILURES, NO_LOCK, type LockRecord } from '@/features/gate/domain/overrideLock';
import type { Sql } from '@/shared/db/sql';

export type ShiftTally = { admitted: number; used: number; refused: number; couldntCheck: number };
export const EMPTY_TALLY: ShiftTally = { admitted: 0, used: 0, refused: 0, couldntCheck: 0 };

const LOCK_KEY = 'override_lock';
const TALLY_KEY = 'shift_tally';

const isLock = (v: unknown): v is LockRecord =>
  typeof v === 'object' && v !== null && 'failures' in v && typeof v.failures === 'number' &&
  'lockedUntil' in v && (v.lockedUntil === null || typeof v.lockedUntil === 'number');
const isTally = (v: unknown): v is ShiftTally =>
  typeof v === 'object' && v !== null &&
  (['admitted', 'used', 'refused', 'couldntCheck'] as const).every((k) => k in v && typeof (v as Record<string, unknown>)[k] === 'number');

// Small values kept in the encrypted DB's key/value table, so they survive restarts and are wiped
// with the account's data at sign-out.
export function createDeviceStore(db: Sql, deps: { now: () => number } = { now: () => Date.now() }) {
  const read = async (k: string): Promise<unknown> => {
    const r = await db.get<{ v: string }>('SELECT v FROM device WHERE k = ?', [k]);
    if (r === null) return undefined;
    try {
      return JSON.parse(r.v) as unknown;
    } catch {
      return null;
    }
  };
  const write = async (k: string, v: unknown): Promise<void> => {
    await db.run('INSERT INTO device (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v', [k, JSON.stringify(v)]);
  };
  return {
    lock: async (): Promise<LockRecord> => {
      const v = await read(LOCK_KEY);
      if (v === undefined) return NO_LOCK;
      // Unreadable: fail closed (spec §5).
      return isLock(v) ? v : { failures: MAX_FAILURES, lockedUntil: deps.now() + LOCK_MS };
    },
    setLock: (r: LockRecord): Promise<void> => write(LOCK_KEY, r),
    tally: async (): Promise<ShiftTally> => {
      const v = await read(TALLY_KEY);
      return isTally(v) ? v : EMPTY_TALLY;
    },
    addToTally: (k: keyof ShiftTally): Promise<void> =>
      db.tx(async (t) => {
        const r = await t.get<{ v: string }>('SELECT v FROM device WHERE k = ?', [TALLY_KEY]);
        let cur: ShiftTally = EMPTY_TALLY;
        try {
          const parsed: unknown = r === null ? null : JSON.parse(r.v);
          if (isTally(parsed)) cur = parsed;
        } catch {
          cur = EMPTY_TALLY;
        }
        await t.run('INSERT INTO device (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v', [
          TALLY_KEY,
          JSON.stringify({ ...cur, [k]: cur[k] + 1 }),
        ]);
      }),
    resetTally: (): Promise<void> => write(TALLY_KEY, EMPTY_TALLY),
  };
}

export type DeviceStore = ReturnType<typeof createDeviceStore>;
```
(Write with ESLint in mind; adjust the guards' casts minimally if the linter objects.)

`gateDb.ts`: `GateDb = { roster; outbox; device: DeviceStore; close }`; in `open` add `const device = createDeviceStore(conn.sql);` and return it. Update the controller test's fake `stores` object (in `controller.test.ts`) to include `device: createDeviceStore(db)`.

- [ ] **Step 4: Run** `npx jest src/features/gate` → PASS; tsc; lint.

- [ ] **Step 5: Commit**
```bash
git add src/features/gate/offline/outboxStore.ts src/features/gate/api/batch.ts src/features/gate/offline/batchSync.ts src/features/gate/offline/gateDb.ts src/features/gate/offline/deviceStore.ts src/features/gate/offline/__tests__/outboxModes.test.ts src/features/gate/offline/__tests__/deviceStore.test.ts src/features/gate/offline/__tests__/batchSync.test.ts src/features/gate/offline/__tests__/controller.test.ts
git commit -m "feat(gate): lookup and override records, activity listing, lockout and shift tally storage"
```

---

### Task 6: Offline gate — lookup admission, override, PIN check, tally

**Files:**
- Modify: `src/features/gate/domain/outcome.ts`, `src/features/gate/domain/present.ts`, `src/features/gate/offline/offlineGate.ts`
- Test: `src/features/gate/domain/__tests__/present.test.ts` (add), `src/features/gate/offline/__tests__/offlineGateLookup.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 2, 4, 5 (`parseVerifier`, `verifyPin`, `lockState`, `afterFailure`, `afterSuccess`, `rosterStore.search/bookingTickets/meta().override`, `outboxStore.recordAdmission({mode, approval})`, `recordOverride`, `DeviceStore`).
- Produces:
  - `outcome.ts`: admitted variant gains `via?: 'lookup' | 'override'`.
  - `present.ts`: tag = `via === 'lookup'` → `'Lookup · will sync'`; `via === 'override'` → `'Override · will sync'`; else `offline === true` → `'Offline · will sync'`; else null.
  - `OfflineGateDeps` gains `device: DeviceStore`.
  - `offlineGate` gains:
```ts
export type OverrideAvailability = { kind: 'none' } | LockState;   // 'none' = no usable verifier
export type PinCheck = { kind: 'ok' } | { kind: 'wrong'; triesLeft: number } | { kind: 'locked'; minutesLeft: number } | { kind: 'unavailable' };
availability: () => Promise<OverrideAvailability>;
checkPin: (pin: string) => Promise<PinCheck>;
needsPinForLookup: () => Promise<boolean>;                      // meta.requireDynamic
search: (q: LookupQuery) => Promise<GuestRow[]>;
bookingTickets: (bookingId: string) => Promise<GuestRow[]>;
admitFromLookup: (ticketId: string, approval: Approval | null) => Promise<ScanOutcome>;
override: (code: TicketCode, approval: Approval) => Promise<ScanOutcome>;
```

Rules:
- `checkPin`: read `lock()`; if locked → `locked`; parse the verifier from `meta.override` (no meta / null / bad → `unavailable`); `verifyPin` (a throw → `unavailable`, no failure counted); wrong → `setLock(afterFailure(rec, now))` and return `wrong` with the new `triesLeft` (or `locked` if that failure locked it); right → `setLock(afterSuccess())`, `ok`. `now` = `deps.serverNow()`.
- `admitFromLookup`: the ticket must be in the roster, confirmed, not in. Not confirmed → `refused notConfirmed`; already in → `used` (domain `scannedBy`); otherwise `recordAdmission({ mode: 'manual_lookup', approval, code: ticketId, kid: null, … })` and return admitted with `offline: true, via: 'lookup'` and group progress (same as `decide`). The **caller** enforces "PIN first on live-ticket events" via `needsPinForLookup`; `admitFromLookup` additionally refuses (returns `couldntCheck` with cause `noOfflineList`? — no:) throws `Error('approval required')` when `meta.requireDynamic && approval === null`, so a UI bug can never skip the PIN.
- `override`: `ticketIdOf(code)` null → `refused invalid`; `recordOverride({ ticketId, code, approval, … })`; recorded → admitted `offline: true, via: 'override'` (ticket fields from the roster if it has the row, else nulls); not recorded → `used` "by you" (or domain `scannedBy` of the row).
- Both call `onAdmitted()` (guarded, as in `decide`) after a recorded admission.

- [ ] **Step 1: Failing tests**

Add to `present.test.ts`:
```ts
  it('lookup and override admissions say how they were made', () => {
    expect(present({ ...admitted, offline: true, via: 'lookup' }, NOW).tag).toBe('Lookup · will sync');
    expect(present({ ...admitted, offline: true, via: 'override' }, NOW).tag).toBe('Override · will sync');
  });
```

`offlineGateLookup.test.ts` (uses nodeSql + real stores; KAT verifier from Task 1):
```ts
import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { parseTicketCode, type TicketCode } from '@/features/gate/domain/parseTicketCode';
import { createDeviceStore } from '@/features/gate/offline/deviceStore';
import { createOfflineGate } from '@/features/gate/offline/offlineGate';
import { createOutboxStore } from '@/features/gate/offline/outboxStore';
import { createRosterStore, type RosterRow } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';

const EV = 'e0000000-0000-4000-8000-000000000001';
const A = '00000000-0000-4000-8000-000000000001';
const PENDING = '00000000-0000-4000-8000-000000000002';
const UNLISTED = '00000000-0000-4000-8000-0000000000ff';
const KAT = { enabled: true, alg: 'scrypt', N: 8192, r: 8, p: 1, dk_len: 32, salt: 'ABEiM0RVZneImaq7zN3u_w', hash: 'L8yIIos_9EAoJkqiN2s2Qv6pNMzKe65LM05K0fZtgeA' };
const NOW = Date.parse('2026-10-07T18:00:00Z');
const code = (raw: string): TicketCode => {
  const p = parseTicketCode(raw);
  if (!p) throw new Error('fixture');
  return p.value;
};
const row = (id: string, over: Partial<RosterRow> = {}): RosterRow => ({
  id, ticketType: 'VIP', ticketIndex: 1, bookingId: 'b', bookingStatus: 'confirmed', checkedInAt: null,
  scannedBy: null, byMe: null, holderName: 'Ada', phoneMasked: '0803••••210', seat: null, ...over,
});

async function setup(opts: { requireDynamic?: boolean; override?: unknown } = {}) {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const roster = createRosterStore(db);
  await roster.beginSync(EV, 'full', '2026-10-07T17:00:00Z', { title: null, eventDate: null, requireDynamic: opts.requireDynamic ?? false, total: 2 }, [], opts.override === undefined ? KAT : opts.override);
  await roster.writePage(EV, 'full', [row(A), row(PENDING, { bookingStatus: 'pending', ticketIndex: 2 })], null);
  await roster.finishSync(EV, 'full');
  const outbox = createOutboxStore(db, { newDeviceId: () => 'device-abcdef12' });
  const device = createDeviceStore(db, { now: () => NOW });
  const gate = createOfflineGate({
    eventId: EV, roster, outbox, device, serverNow: () => NOW,
    clockState: () => ({ suspect: false, checkedAgoMs: 0 }), appVersion: '1',
    onKeysOutdated: jest.fn(), onAdmitted: jest.fn(),
  });
  return { gate, outbox, device };
}

describe('lookup and override', () => {
  it('admits from lookup as manual_lookup', async () => {
    const { gate, outbox } = await setup();
    expect(await gate.admitFromLookup(A, null)).toMatchObject({ kind: 'admitted', via: 'lookup' });
    expect((await outbox.due(EV, 0, 10))[0]).toMatchObject({ mode: 'manual_lookup', code: A });
    expect(await gate.admitFromLookup(A, null)).toMatchObject({ kind: 'used', scannedBy: { kind: 'me' } });
  });
  it('refuses an unconfirmed booking from lookup', async () => {
    const { gate } = await setup();
    expect(await gate.admitFromLookup(PENDING, null)).toEqual({ kind: 'refused', reason: 'notConfirmed', fixable: false });
  });
  it('a live-ticket event cannot admit from lookup without an approval', async () => {
    const { gate } = await setup({ requireDynamic: true });
    expect(await gate.needsPinForLookup()).toBe(true);
    await expect(gate.admitFromLookup(A, null)).rejects.toThrow('approval required');
    expect(await gate.admitFromLookup(A, { approvedBy: 'Tunde', reason: null })).toMatchObject({ kind: 'admitted' });
  });
  it('checks the PIN, counts failures and locks', async () => {
    const { gate } = await setup();
    expect(await gate.availability()).toEqual({ kind: 'open', triesLeft: 5 });
    expect(await gate.checkPin('000000')).toEqual({ kind: 'wrong', triesLeft: 4 });
    for (let i = 0; i < 3; i++) await gate.checkPin('000000');
    expect(await gate.checkPin('000000')).toEqual({ kind: 'locked', minutesLeft: 15 });
    expect(await gate.checkPin('123456')).toEqual({ kind: 'locked', minutesLeft: 15 });
  }, 30_000);
  it('a correct PIN resets the count', async () => {
    const { gate } = await setup();
    await gate.checkPin('000000');
    expect(await gate.checkPin('123456')).toEqual({ kind: 'ok' });
    expect(await gate.availability()).toEqual({ kind: 'open', triesLeft: 5 });
  }, 30_000);
  it('no usable verifier means no override', async () => {
    const { gate } = await setup({ override: null });
    expect(await gate.availability()).toEqual({ kind: 'none' });
    expect(await gate.checkPin('123456')).toEqual({ kind: 'unavailable' });
  });
  it('overrides an unlisted ticket once', async () => {
    const { gate, outbox } = await setup();
    const approval = { approvedBy: 'Tunde', reason: 'Bought at the door' };
    expect(await gate.override(code(UNLISTED), approval)).toMatchObject({ kind: 'admitted', via: 'override' });
    expect(await gate.override(code(UNLISTED), approval)).toMatchObject({ kind: 'used', scannedBy: { kind: 'me' } });
    expect(await outbox.due(EV, 0, 10)).toHaveLength(1);
  });
  it('searches and lists a booking', async () => {
    const { gate } = await setup();
    expect((await gate.search({ kind: 'phoneTail', value: '210' })).length).toBe(2);
    expect((await gate.bookingTickets('b')).map((r) => r.ticketIndex)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — `outcome.ts` (`via?: 'lookup' | 'override'` on admitted), `present.ts` (tag rule above), and in `offlineGate.ts` add the deps field and the functions. Sketch of the core pieces (write them fully, reusing `decide`'s progress/onAdmitted code via a small helper `admittedOutcome(ticket, scannedAt, via)`):
```ts
  async function verifier(): Promise<PinVerifier | null> {
    const meta = await deps.roster.meta(eventId);
    return meta === null ? null : parseVerifier(meta.override);
  }

  async function availability(): Promise<OverrideAvailability> {
    if ((await verifier()) === null) return { kind: 'none' };
    return lockState(await deps.device.lock(), deps.serverNow());
  }

  async function checkPin(pin: string): Promise<PinCheck> {
    const now = deps.serverNow();
    const rec = await deps.device.lock();
    const st = lockState(rec, now);
    if (st.kind === 'locked') return st;
    const v = await verifier();
    if (v === null) return { kind: 'unavailable' };
    let ok: boolean;
    try {
      ok = await verifyPin(pin, v);
    } catch {
      return { kind: 'unavailable' };
    }
    if (ok) {
      await deps.device.setLock(afterSuccess());
      return { kind: 'ok' };
    }
    const next = afterFailure(rec, now);
    await deps.device.setLock(next);
    const after = lockState(next, now);
    return after.kind === 'locked' ? after : { kind: 'wrong', triesLeft: after.triesLeft };
  }
```

- [ ] **Step 4: Run** `npx jest src/features/gate` → PASS; tsc; lint.

- [ ] **Step 5: Commit**
```bash
git add src/features/gate/domain/outcome.ts src/features/gate/domain/present.ts src/features/gate/offline/offlineGate.ts src/features/gate/domain/__tests__/present.test.ts src/features/gate/offline/__tests__/offlineGateLookup.test.ts
git commit -m "feat(gate): admit from lookup, supervisor override and PIN lockout in the offline gate"
```

---

### Task 7: Scan session `show`, tally, controller entry points

**Files:**
- Modify: `src/features/gate/domain/scanSession.ts`, `src/features/gate/domain/syncLine.ts` (`SyncStatus` gains `override`), `src/features/gate/offline/controller.ts`, `src/features/gate/hooks/useScanSession.ts`, `src/features/gate/hooks/useOfflineGate.ts`
- Test: `src/features/gate/domain/__tests__/scanSession.test.ts` (add), `src/features/gate/offline/__tests__/controller.test.ts` (add)

**Interfaces:**
- Produces:
  - `ScanSessionDeps` gains `onOutcome?: (o: ScanOutcome) => void` — called once for every outcome that is pushed to the overlay (scan results, `show`, `showNotAssigned`, local junk refusals).
  - `session.show(outcome: ScanOutcome): void` — pushes a code-less overlay, publishes, fires the cue, calls `onAdmitted` when admitted.
  - `SyncStatus.override: OverrideAvailability` (`EMPTY_SYNC.override = { kind: 'none' }`), published by `refreshStatus`.
  - Controller gains: `availability`, `checkPin`, `needsPinForLookup`, `search`, `bookingTickets`, `admitFromLookup`, `override` (delegating to the gate, refreshing status after admissions and calling `syncNow()` after a recorded lookup/override admission), `tally(o: ScanOutcome)` (maps kind → tally key, best effort, never throws), `activity(tab, beforeSeq)` (50 per page), `exportRows()`.
  - `useScanSession(eventId, offline, onOutcome?)`; the route passes `offline.controller?.tally`.

- [ ] **Step 1: Failing tests** — `scanSession.test.ts`: `show(admittedOutcome)` makes `view().current?.outcome` that outcome with `code: null`, calls `onAdmitted` once and `onOutcome` once; a scan result calls `onOutcome` once; `onOutcome` throwing doesn't stop the overlay. `controller.test.ts`: `tally` of an admitted outcome increments `admitted` in the device store; `admitFromLookup` triggers a batch post (post mock called) and publishes a status with `pending` ≥ 0; `refreshStatus` publishes `override: { kind: 'open', triesLeft: 5 }` when the roster has the KAT verifier.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** (follow the existing patterns in each file; `onOutcome` calls are wrapped in try/catch like `emit` in scanQueue). In `scanSession`:
```ts
  function shown(outcome: ScanOutcome) {
    try {
      deps.onOutcome?.(outcome);
    } catch {
      // Counting must never hide an outcome.
    }
  }
```
call it in the queue `onResult`, in `showNotAssigned`, in the local junk-refusal path and in `show`. In the controller, `tally` maps `admitted→admitted, used→used, refused→refused, couldntCheck→couldntCheck` and `void`s `device.addToTally(k).catch(fail)`.

- [ ] **Step 4: Run** `npx jest src/features/gate` → PASS; tsc; lint.

- [ ] **Step 5: Commit**
```bash
git add src/features/gate/domain/scanSession.ts src/features/gate/domain/syncLine.ts src/features/gate/offline/controller.ts src/features/gate/hooks/useScanSession.ts src/features/gate/hooks/useOfflineGate.ts src/features/gate/domain/__tests__/scanSession.test.ts src/features/gate/offline/__tests__/controller.test.ts
git commit -m "feat(gate): show non-scan admissions, count the shift, controller entry points"
```

---

### Task 8: Shift summary at sign-out

**Files:**
- Modify: `src/shared/lib/signOutGuard.ts`, `src/features/gate/offline/signOutGuard.ts`, `src/features/auth/hooks/useSignOut.ts`
- Create: `src/features/auth/domain/shiftSummary.ts`
- Test: `src/shared/lib/__tests__/signOutGuard.test.ts` (add), `src/features/auth/domain/__tests__/shiftSummary.test.ts`

**Interfaces:**
- Produces:
```ts
// shared/lib/signOutGuard.ts
export type ShiftSummary = { admitted: number; used: number; refused: number; couldntCheck: number; toSync: number };
// SignOutGuard gains optional: summary?: (userId) => Promise<ShiftSummary | null>; resetSummary?: (userId) => Promise<void>
export function shiftSummary(userId: string): Promise<ShiftSummary | null>;   // first non-null; errors → null
export function resetShiftSummary(userId: string): Promise<void>;
// auth/domain/shiftSummary.ts
export function summaryLine(s: ShiftSummary): string;  // "This shift: 12 admitted · 3 already used · 1 refused · 2 to sync"
```
- Gate guard: `summary` returns null when the account has no gate DB; otherwise the device tally plus `outbox.totals().unsynced` as `toSync`. `resetSummary` → `device.resetTally()`.
- `useSignOut`: before the existing flow, `const s = await shiftSummary(userId)`; when `s` is non-null and anything is non-zero, show `Alert.alert('Sign out?', summaryLine(s), [Cancel, 'Reset counts' (→ resetShiftSummary, no sign-out), 'Sign out' (→ existing flow)])`; otherwise run the existing flow directly. The blocked/discard alerts are unchanged.

- [ ] **Step 1: Failing tests** — `shiftSummary.test.ts`: `summaryLine({admitted:12, used:3, refused:1, couldntCheck:0, toSync:2})` = `'This shift: 12 admitted · 3 already used · 1 refused · 2 to sync'`; zero parts other than admitted are omitted (`{admitted:1,…0}` → `'This shift: 1 admitted'`); `couldntCheck` shows as `N couldn’t check`. `signOutGuard.test.ts`: `shiftSummary` returns the first guard's non-null summary and returns null when a guard throws.

- [ ] **Step 2–4:** implement, run `npx jest src/features/auth src/shared/lib src/features/gate`, tsc, lint.

- [ ] **Step 5: Commit**
```bash
git add src/shared/lib/signOutGuard.ts src/features/gate/offline/signOutGuard.ts src/features/auth/hooks/useSignOut.ts src/features/auth/domain/shiftSummary.ts src/shared/lib/__tests__/signOutGuard.test.ts src/features/auth/domain/__tests__/shiftSummary.test.ts
git commit -m "feat(gate): shift summary in the sign-out dialog"
```

---

### Task 9: PIN sheet

**Files:**
- Create: `src/features/gate/ui/PinSheet.tsx`
- Test: `src/features/gate/ui/__tests__/PinSheet.test.tsx`

**Interfaces:**
- Consumes: `PinCheck`, `Approval` (Tasks 5–6), `isPinShape` (Task 1).
- Produces:
```ts
type Props = {
  visible: boolean;
  purpose: 'override' | 'lookup';          // override: reason required (3–200); lookup: reason optional
  check: (pin: string) => Promise<PinCheck>;
  onApproved: (approval: Approval) => void; // called once after { kind: 'ok' }
  onClose: () => void;
};
export function PinSheet(p: Props): JSX.Element;
```
Behaviour: three inputs (PIN: `keyboardType="number-pad"`, `secureTextEntry`, `maxLength={6}`; approver; reason), a primary "Confirm" button disabled until the inputs are valid **and while a check is running** (Review Focus 2), "Checking…" label while running; results: `wrong` → "Wrong PIN — N tries left" and the PIN field clears; `locked` → "Override locked — try again in N min" and Confirm stays disabled; `unavailable` → "Override isn’t available for this event"; `ok` → `onApproved({ approvedBy: approver.trim(), reason: reason.trim() === '' ? null : reason.trim() })`. Reset all fields when `visible` turns false. Copy: title "Supervisor override" (purpose override) / "Supervisor approval" (lookup); helper "A supervisor enters the event PIN. Every override is logged." Use `Input` and `Button` from `@/shared/ui` (read their props first), a `Modal` with `presentationStyle="pageSheet"` like `AttentionSheet`.

- [ ] **Step 1: Failing tests** (RNTL v14 async — `await render`, `await fireEvent…`): Confirm disabled until 6 digits + approver (+ reason ≥ 3 for override); a second press while checking does not call `check` again (resolve the first check with a deferred promise); `wrong` shows the tries-left message; `locked` shows the lock message; `ok` calls `onApproved` with trimmed values and `reason: null` for an empty lookup reason.
- [ ] **Step 2–4:** implement; `npx jest src/features/gate/ui`; tsc; lint.
- [ ] **Step 5: Commit**
```bash
git add src/features/gate/ui/PinSheet.tsx src/features/gate/ui/__tests__/PinSheet.test.tsx
git commit -m "feat(gate): supervisor PIN sheet"
```

---

### Task 10: Find guest and booking view

**Files:**
- Create: `src/features/gate/ui/FindGuestSheet.tsx`
- Modify: `src/features/gate/screens/ScannerScreen.tsx` (a 4th control "Find guest" with the `UserSearch` lucide icon — verify the icon exists in `node_modules/lucide-react-native/dist/esm/icons`, else use `Search`), `src/app/(gate)/gate/[eventId].tsx` (wire props)
- Test: `src/features/gate/ui/__tests__/FindGuestSheet.test.tsx`, `src/features/gate/screens/__tests__/ScannerScreen.test.tsx` (props builder)

**Interfaces:**
- Consumes: controller `search`, `bookingTickets`, `needsPinForLookup`, `admitFromLookup`, `checkPin`; `parseLookup`; `PinSheet`; `session.show`.
- Produces:
```ts
type Props = {
  visible: boolean;
  search: (q: LookupQuery) => Promise<GuestRow[]>;
  bookingTickets: (bookingId: string) => Promise<GuestRow[]>;
  needsPin: () => Promise<boolean>;
  checkPin: (pin: string) => Promise<PinCheck>;
  admit: (ticketId: string, approval: Approval | null) => Promise<ScanOutcome>;
  onAdmitted: (o: ScanOutcome) => void;   // the scanner shows it via session.show and closes the sheet
  onClose: () => void;
};
```
Behaviour: search box (placeholder "Name or last phone digits"), searches 250 ms after typing stops when `parseLookup` returns a query; a hint "Type a name or 2–4 phone digits" otherwise; results list (`FlatList`, rows ≥ `density.work.rowMin`): name or masked phone, "VIP · ticket 2", status ("In" / "Not in" / "Booking pending|cancelled"); tapping a row shows the booking view: all tickets of that booking with an "Admit" button (≥ 44 pt) on confirmed, not-in tickets; Admit → if `needsPin()` open `PinSheet` (`purpose="lookup"`) and admit after approval, else admit with `null`; then `onAdmitted(outcome)`. Empty states: "No offline list on this phone yet" (search rejects / no roster), "No one matches". Pause the camera while open (add to the existing `paused` condition in ScannerScreen). Guest names appear on screen only; never log them.

- [ ] **Step 1: Failing tests:** typing "210" calls `search` with `{kind:'phoneTail', value:'210'}` (use fake timers for the debounce); tapping a result shows the booking tickets; Admit on a non-PIN event calls `admit(id, null)` then `onAdmitted`; on a PIN event it opens the PIN sheet first and admits with the approval; "Not in"/"In" labels; a not-confirmed ticket has no Admit button.
- [ ] **Step 2–4:** implement; run `npx jest src/features/gate`; tsc; lint.
- [ ] **Step 5: Commit**
```bash
git add src/features/gate/ui/FindGuestSheet.tsx src/features/gate/ui/__tests__/FindGuestSheet.test.tsx src/features/gate/screens/ScannerScreen.tsx src/features/gate/screens/__tests__/ScannerScreen.test.tsx "src/app/(gate)/gate/[eventId].tsx"
git commit -m "feat(gate): find a guest by name or phone digits and admit from the list"
```

---

### Task 11: Activity screen and CSV export

**Files:**
- Create: `src/features/gate/ui/ActivityScreen.tsx`, `src/features/gate/platform/shareCsv.ts`
- Delete: `src/features/gate/ui/AttentionSheet.tsx` and its test (replaced)
- Modify: `src/features/gate/screens/ScannerScreen.tsx`, `src/app/(gate)/gate/[eventId].tsx`, `src/features/gate/ui/SyncBar.tsx` (the "N need attention" link opens Activity on the attention tab)
- Test: `src/features/gate/ui/__tests__/ActivityScreen.test.tsx`

**Interfaces:**
- Consumes: controller `activity(tab, beforeSeq)`, `exportRows()`, `syncNow()`; `activityCsv`; `attentionLine`.
- Produces:
```ts
// platform/shareCsv.ts — the only file touching expo-file-system / expo-sharing
export async function shareCsv(fileName: string, text: string): Promise<void>;
// ActivityScreen props
type Props = {
  visible: boolean;
  initialTab: ActivityTab;
  load: (tab: ActivityTab, beforeSeq: number | null) => Promise<AttentionItem[]>;
  exportRows: () => Promise<ActivityRow[]>;
  share: (fileName: string, text: string) => Promise<void>;
  onSyncNow: () => void;
  onClose: () => void;
};
```
`shareCsv` (verified SDK 57 APIs): 
```ts
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// The share target may still be reading the file after shareAsync resolves, so the previous
// export is removed at the start of the next one rather than straight away.
export async function shareCsv(fileName: string, text: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.write(text);
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export scan activity', UTI: 'public.comma-separated-values-text' });
}
```
Also delete the export file at sign-out wipe: in `wipeGateDb` add a best-effort `new File(Paths.cache, ACTIVITY_FILE).delete()` guarded by `exists` (export the file name constant from `shareCsv.ts`: `export const ACTIVITY_FILE = 'bookhushly-scan-activity.csv'`).
Screen: title "Activity", segmented tabs "To sync" / "Needs attention" / "Synced", list newest first with "Load more" when a page returns 50, each row: ticket type + number (or "Ticket"), local time, a "Lookup" / "Override" marker for those modes, and the state line (`attentionLine`, or "Waiting to sync" / "Synced"). Footer buttons: "Sync now", "Export CSV" (errors → "Couldn’t export — try again"), "Close". Read-only; no undo.

- [ ] **Step 1: Failing tests:** opens on `initialTab`; switching tab calls `load` with that tab; "Load more" passes the last seq; a lookup row shows "Lookup"; Export calls `share('bookhushly-scan-activity.csv', <csv starting with the header>)`; a share rejection shows the error copy; no element with an undo/delete label exists.
- [ ] **Step 2–4:** implement; replace `AttentionSheet` usages; run the whole `npx jest`; tsc; lint.
- [ ] **Step 5: Commit**
```bash
git add src/features/gate/ui/ActivityScreen.tsx src/features/gate/platform/shareCsv.ts src/features/gate/ui/__tests__/ActivityScreen.test.tsx src/features/gate/screens/ScannerScreen.tsx src/features/gate/ui/SyncBar.tsx src/features/gate/offline/gateDb.ts "src/app/(gate)/gate/[eventId].tsx"
git rm src/features/gate/ui/AttentionSheet.tsx src/features/gate/ui/__tests__/AttentionSheet.test.tsx
git commit -m "feat(gate): activity screen with sync tabs and CSV export"
```
(`src/features/gate/platform/` is a new folder for this feature's native wrappers; if the lint rules expect `src/shared/platform` instead, put `shareCsv.ts` there — it has no gate imports.)

---

### Task 12: Override action on the refusal overlay

**Files:**
- Modify: `src/features/gate/ui/OutcomeOverlay.tsx`, `src/features/gate/screens/ScannerScreen.tsx`, `src/app/(gate)/gate/[eventId].tsx`
- Test: `src/features/gate/ui/__tests__/OutcomeOverlay.test.tsx`, `src/features/gate/screens/__tests__/ScannerScreen.test.tsx`

**Interfaces:**
- Consumes: `SyncStatus.override` (Task 7), `PinSheet` (Task 9), controller `checkPin`, `override`; `session.dismiss`, `session.show`.
- Produces: `OutcomeOverlay` prop `onOverride?: (id: number) => void` and `overrideState?: OverrideAvailability`. For a `refused` outcome with reason `notInList` and a non-null `view.code`: when `overrideState.kind === 'open'` show a "Supervisor override" action (≥ 44 pt) next to "Done"; when `'locked'` show the line "Override locked — try again in N min" and no action; when `'none'` or absent, nothing. Pressing it calls `onOverride(view.id)`; ScannerScreen opens `PinSheet` (`purpose="override"`), and on approval calls `override(code, approval)`, then `session.dismiss(id)` and `session.show(outcome)`. The overlay never offers the override for any other reason.

- [ ] **Step 1: Failing tests:** overlay shows the action only for notInList + open; shows the lock line when locked; nothing for `none`; nothing for other refusals; ScannerScreen: approving in the PIN sheet calls `override` with the overlay's code and then shows the admitted outcome.
- [ ] **Step 2–4:** implement; whole `npx jest`; tsc; lint.
- [ ] **Step 5: Commit**
```bash
git add src/features/gate/ui/OutcomeOverlay.tsx src/features/gate/screens/ScannerScreen.tsx "src/app/(gate)/gate/[eventId].tsx" src/features/gate/ui/__tests__/OutcomeOverlay.test.tsx src/features/gate/screens/__tests__/ScannerScreen.test.tsx
git commit -m "feat(gate): supervisor override from the not-in-list refusal"
```

---

### Task 13: Docs and verification

**Files:**
- Modify: `docs/BACKEND_STATUS.md` (§10: one line "Phase 2b (2026-10-07): lookup, override PIN, activity/export and shift summary built — device verification pending"; §3 roster: note the app now reads `override` and clears it on `null`).

- [ ] **Step 1:** update the doc as above.
- [ ] **Step 2:** `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor`, and the full `npx jest` three times; record results.
- [ ] **Step 3: Commit**
```bash
git add docs/BACKEND_STATUS.md
git commit -m "docs: Phase 2b gate lookup and override status"
```
- [ ] **Step 4 (owner):** new preview build (expo-sharing is native) and Moto G06 checks: PIN check time with the real verifier (< 2 s), five wrong PINs lock for 15 min and survive an app restart, search on a large roster (< 300 ms), lookup on a live-ticket event asks for the PIN, override of an unlisted ticket syncs and appears in the web's scan log as an exception, export opens the share sheet and the CSV has no names or phone numbers, the sign-out dialog shows the shift counts (scenarios 13, 15d).

---

## Self-review notes

- Spec coverage: §2.1 → Tasks 6, 10; §2.2 → Tasks 6, 7; §2.3 → Tasks 3, 11; §2.4 → Task 1; §2.5 → Tasks 2, 5, 6; §2.6 → Tasks 5, 7, 8; §2.7 → Task 4; §3 flows → Tasks 9–12; §4 units → Tasks 1–8; §5 errors → Tasks 5 (fail-closed lock), 6 (unavailable ≠ wrong), 10/11 (search/export errors); §6 → every task + Task 13.
- Known judgement left to implementers in UI tasks (9–12): exact layout within the stated tokens/targets; behaviour and copy are fixed above.
