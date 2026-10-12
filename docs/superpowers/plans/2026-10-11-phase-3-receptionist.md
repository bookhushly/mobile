# Phase 3 Receptionist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A receptionist runs the front desk from the app: Today counts, check-in by typed or scanned code (preview → confirm), check-out, room reassign, room board, shift activity. Online-only.

**Architecture:** Pure domain units in `src/features/receptionist/domain` (dates, code parsing, booking stage, lists, room board, outcome mapping, reconcile, check-in flow reducer), thin API layer (RLS reads via supabase-js, actions via the shared API client), TanStack Query hooks with polling + a Realtime refetch trigger, screens built only from the UI-A kit. Routes: `(receptionist)` Stack → `(tabs)` JS Tabs (Today · Guests · Rooms) + `booking/[id]` + `activity`.

**Tech Stack:** Expo SDK 57, expo-router 57 (JS `Tabs`), React 19.2 + Compiler, TanStack Query 5, supabase-js 2.117 (Realtime), zustand, zod v4, Jest + RNTL v14 (async API).

**Spec:** `docs/superpowers/specs/2026-10-11-phase-3-receptionist-design.md` (rulings R1–R20). Contract: `docs/BACKEND_STATUS.md` §4.

## Global Constraints

- TypeScript strict + `noUncheckedIndexedAccess`; no `any`, `@ts-ignore`, `console.log`, raw hex, `fontWeight`, animated layout props (hooks enforce).
- `src/features/receptionist/**` must not import `src/features/gate/**`, `features/mode/**` or `features/auth/**` (cross-feature imports are blocked). Route files in `src/app/` may compose features.
- `src/shared/**` imports no feature. Domain files (`domain/`) import no React and no React Native.
- "Today" is always `lagosToday(clock.serverNow())` (R4).
- RLS reads select **explicit columns** only; never `guest_email`, amounts or `customer_id` (R19). Nothing about guests is written to disk.
- Check-in, check-out, reassign and room status are **never** sent with `idempotent: true` and never auto re-posted (R3).
- Transient (network, timeout, 5xx, 429, `validation` of a 2xx body) is never shown as a refusal; neutral tone, words "Couldn't confirm" / "Couldn't load".
- Copy is sentence case; status = word + icon/dot, never colour alone; touch targets ≥ 44 pt; `work` density.
- RNTL v14 is async: `await render(...)`, `await fireEvent.press(...)`, `await renderHook(...)`. Test QueryClients use `{ retry: false, gcTime: Infinity }` and are cleared at the end.
- Before each commit: `npx tsc --noEmit`, `npx expo lint`, and the touched tests pass. Stage specific paths. No co-author trailers.

## Review Focus

1. **Lagos midnight**: between 23:00 and 24:00 UTC the desk's "today" is the next day — arrivals and early-arrival warnings must follow (Task 3 tests 23:30 UTC).
2. **Lost response on check-in**: a timeout followed by **Check again** that finds the booking checked in at/after the send time shows "Checked in", never "Already checked in" (Task 6 + 7 tests).
3. **Room-status 403 without a code** can be a transient DB read: one silent re-read of the staff row before showing "You can't change rooms at this hotel" (Task 15 test).
4. **Two hotels**: a staff member with two `hotel_staff` rows gets a picker, not the mode error (Tasks 2 + 9 tests).
5. **Wrong QR**: a gate ticket (BH2… or a ticket link) scanned at the desk says it's an event ticket (Task 3 test) and never calls the server.

---

### Task 1: Move the camera to shared

**Files:**

- Create: `src/shared/ui/camera/QrCamera.tsx` (moved `ScannerCamera`, renamed `QrCamera`), `src/shared/ui/camera/useCameraAccess.ts` (moved `useCameraAccess` + `CameraPermission`), `src/shared/ui/camera/useAppActive.ts`, `src/shared/ui/camera/CameraPrompt.tsx`, `src/shared/ui/camera/index.ts`
- Delete: `src/features/gate/ui/ScannerCamera.tsx`, `src/features/gate/ui/CameraPrompt.tsx`
- Move tests: `src/features/gate/ui/__tests__/useAppActive.test.tsx`, `useCameraAccess.test.tsx` → `src/shared/ui/camera/__tests__/`; any CameraPrompt test likewise.
- Modify: every gate importer (`grep -rn "ScannerCamera\|CameraPrompt\|useCameraAccess\|useAppActive" src`).

**Interfaces — Produces:**

```ts
export type CameraPermission = 'loading' | 'unknown' | 'granted' | 'denied';
export function useCameraAccess(): {
  permission: CameraPermission;
  canAsk: boolean;
  request: () => void;
};
export function useAppActive(): boolean;
export const QrCamera: React.MemoExoticComponent<
  (p: { torch: boolean; paused: boolean; onCode: (raw: string) => void }) => JSX.Element
>;
export function CameraPrompt(p: {
  state: 'ask' | 'denied';
  canAsk: boolean;
  askTitle: string; // gate: 'Allow camera to scan tickets'
  body: string; // gate: 'The camera is only used to read ticket codes. Nothing is recorded.'
  byHandLabel: string; // gate: 'Enter codes by hand'
  tone?: 'inverse' | 'default'; // gate passes 'inverse' (dark scanner); default renders on light surfaces
  onAllow: () => void;
  onOpenSettings: () => void;
  onEnterByHand: () => void;
}): JSX.Element;
```

Denied title stays "Camera is off for Bookhushly". With `tone='default'` texts use default tones and buttons omit `onInverse`.

- [ ] Step 1: `git mv` the files, rename `ScannerCamera` → `QrCamera`, add the props above to `CameraPrompt`, export all from `index.ts` (do **not** add to `src/shared/ui/index.ts` — expo-camera must not load for every kit import).
- [ ] Step 2: Update gate imports and pass the gate's current strings + `tone="inverse"` so the gate renders exactly as before.
- [ ] Step 3: Run `npx jest src/features/gate src/shared/ui` → all pass (existing gate snapshots/text queries unchanged).
- [ ] Step 4: tsc + lint; commit `refactor(camera): move the QR camera and permission prompt to shared for the front desk`.

### Task 2: Mode — several hotels, receptionist always gets the desk

**Files:** Modify `src/features/mode/hooks/useModeState.ts`, `src/features/mode/schemas/rows.ts`, `src/features/mode/api/loadModeInputs.ts`, `src/features/mode/domain/resolveMode.ts`, `src/features/mode/hooks/useRouteStore.ts`; tests in the existing `__tests__` beside each.

- [ ] Step 1: Failing tests:
  - `loadModeInputs` with `hotelStaff` data `[{hotel_id:'a'},{hotel_id:'b'}]` → `hotelStaff: { hotelId: 'a' }`; with `[]` → `null`.
  - `resolveMode({ role:'receptionist', hotelStaff:null, activeScannerCount:0 })` → `{ kind:'modes', modes:['receptionist'], defaultMode:'receptionist' }` (no customer mode for a receptionist).
  - `resolveMode({ role:'receptionist', hotelStaff:{hotelId:'a'}, activeScannerCount:1 })` → modes `['receptionist','gate']`.
- [ ] Step 2: Implement:
  - query: `supabase.from('hotel_staff').select('hotel_id').eq('user_id', id).limit(1)` (array, no `maybeSingle`).
  - `hotelStaffRow = z.array(z.object({ hotel_id: z.string() }))`; `hotelStaff: staff.data[0] ? { hotelId: staff.data[0].hotel_id } : null`.
  - `resolveMode`: if `role === 'receptionist'` push `'receptionist'` (regardless of `hotelStaff`), then gate if scanners; push `'customer'` **only when role is `customer`**.
  - Route store: `receptionist: '/today'`.
- [ ] Step 3: Update existing tests that asserted the old behaviour (receptionist without staff row → customer). Run `npx jest src/features/mode src/app` → pass.
- [ ] Step 4: Commit `fix(mode): staff at several hotels no longer hit the mode error; a receptionist always lands on the front desk`.

### Task 3: Lagos dates and check-in codes (pure)

**Files:** Create `src/shared/lib/lagosDay.ts`, `src/shared/lib/__tests__/lagosDay.test.ts`, `src/features/receptionist/domain/checkInCode.ts`, `src/features/receptionist/domain/__tests__/checkInCode.test.ts`.

- [ ] Step 1: Tests (`lagosDay.test.ts`):

```ts
import {
  daysBetween,
  isIsoDate,
  lagosTime,
  lagosToday,
  longDate,
  shortDate,
  stayRange,
} from '@/shared/lib/lagosDay';

it('rolls to the next day at 23:00 UTC (WAT is UTC+1)', () => {
  expect(lagosToday(Date.UTC(2026, 9, 10, 22, 59))).toBe('2026-10-10');
  expect(lagosToday(Date.UTC(2026, 9, 10, 23, 30))).toBe('2026-10-11');
});
it('counts days across months and backwards', () => {
  expect(daysBetween('2026-10-11', '2026-10-14')).toBe(3);
  expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
  expect(daysBetween('2026-10-14', '2026-10-11')).toBe(-3);
  expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
});
it('formats dates', () => {
  expect(shortDate('2026-10-14')).toBe('Wed 14 Oct');
  expect(longDate('2026-10-11')).toBe('Sunday 11 October');
  expect(stayRange('2026-10-11', '2026-10-14')).toBe('11–14 Oct');
  expect(stayRange('2026-10-30', '2026-11-02')).toBe('30 Oct – 2 Nov');
  expect(stayRange('2026-12-31', '2027-01-02')).toBe('31 Dec – 2 Jan');
});
it('shows Lagos wall time for an ISO instant', () => {
  expect(lagosTime('2026-10-11T09:42:00Z')).toBe('10:42');
  expect(lagosTime('2026-10-11T23:05:00+00:00')).toBe('00:05');
  expect(lagosTime('nonsense')).toBe('');
});
it('validates ISO dates', () => {
  expect(isIsoDate('2026-02-29')).toBe(false);
  expect(isIsoDate('2028-02-29')).toBe(true);
  expect(isIsoDate('2026-1-01')).toBe(false);
});
```

- [ ] Step 2: Run → FAIL (module missing).
- [ ] Step 3: Implement `src/shared/lib/lagosDay.ts`:

```ts
// Hotels have no timezone column; the check-in RPC uses Africa/Lagos (WAT, UTC+1, no DST).
const LAGOS_OFFSET_MS = 3_600_000;
const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

function parts(d: IsoDate): [number, number, number] {
  const m = ISO_RE.exec(d);
  if (m === null) throw new RangeError(`Not a YYYY-MM-DD date: ${d}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function utcMs(d: IsoDate): number {
  const [y, m, day] = parts(d);
  return Date.UTC(y, m - 1, day);
}

export function isIsoDate(s: string): boolean {
  if (!ISO_RE.test(s)) return false;
  return new Date(utcMs(s)).toISOString().slice(0, 10) === s;
}

export function lagosToday(nowMs: number): IsoDate {
  return new Date(nowMs + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((utcMs(to) - utcMs(from)) / DAY_MS);
}

export function shortDate(d: IsoDate): string {
  const [, m, day] = parts(d);
  return `${WEEKDAYS[new Date(utcMs(d)).getUTCDay()] ?? ''} ${String(day)} ${MONTHS[m - 1] ?? ''}`;
}

export function longDate(d: IsoDate): string {
  const [, m, day] = parts(d);
  return `${WEEKDAYS_LONG[new Date(utcMs(d)).getUTCDay()] ?? ''} ${String(day)} ${MONTHS_LONG[m - 1] ?? ''}`;
}

export function stayRange(from: IsoDate, to: IsoDate): string {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  if (fy === ty && fm === tm) return `${String(fd)}–${String(td)} ${MONTHS[tm - 1] ?? ''}`;
  return `${String(fd)} ${MONTHS[fm - 1] ?? ''} – ${String(td)} ${MONTHS[tm - 1] ?? ''}`;
}

export function lagosTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms + LAGOS_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
```

- [ ] Step 4: Tests (`checkInCode.test.ts`):

```ts
import { parseCheckInCode } from '@/features/receptionist/domain/checkInCode';

it.each([
  ['ab12cd34', 'AB12CD34'],
  ['  7F3B9C01 \n', '7F3B9C01'],
])('accepts %p', (raw, code) => {
  expect(parseCheckInCode(raw)).toEqual({ ok: true, code });
});
it.each([['AB12CD3'], ['AB12CD345'], ['AB12-CD3'], ['GHIJKLMN']])('rejects shape %p', (raw) => {
  expect(parseCheckInCode(raw)).toEqual({ ok: false, reason: 'shape' });
});
it('says empty for blank input', () => {
  expect(parseCheckInCode('   ')).toEqual({ ok: false, reason: 'empty' });
});
it.each([
  ['BH2.eyJhbGciOi.sig'],
  ['BH1.abc'],
  ['https://bookhushly.com/tickets/3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f'],
  ['3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f'],
])('recognises an event ticket %p', (raw) => {
  expect(parseCheckInCode(raw)).toEqual({ ok: false, reason: 'eventTicket' });
});
```

- [ ] Step 5: Implement `checkInCode.ts`:

```ts
// Server codes: 8 chars from a UUID's hex with a→2, e→7, upper-cased. [0-9A-F]{8} is a safe superset.
const SHAPE = /^[0-9A-F]{8}$/;
// Gate tickets (features/gate must not be imported): rotating BH1./BH2. codes or a ticket UUID/link.
const EVENT_TICKET = /^BH[12]\.|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export type CheckInCode = string & { readonly __brand: 'CheckInCode' };
export type CodeParse =
  { ok: true; code: CheckInCode } | { ok: false; reason: 'empty' | 'shape' | 'eventTicket' };

export function parseCheckInCode(raw: string): CodeParse {
  const t = raw.trim();
  if (t === '') return { ok: false, reason: 'empty' };
  const up = t.toUpperCase();
  if (SHAPE.test(up)) return { ok: true, code: up as CheckInCode };
  if (EVENT_TICKET.test(t)) return { ok: false, reason: 'eventTicket' };
  return { ok: false, reason: 'shape' };
}
```

(The `as CheckInCode` brand cast is the one allowed cast: the regex just proved the shape.)

- [ ] Step 6: Run both → PASS. tsc, lint. Commit `feat(desk): Lagos calendar dates and check-in code parsing`.

### Task 4: Desk schemas and booking state (pure)

**Files:** Create `src/features/receptionist/schemas/desk.ts`, `src/features/receptionist/domain/bookingState.ts`, tests `src/features/receptionist/domain/__tests__/bookingState.test.ts`, `src/features/receptionist/schemas/__tests__/desk.test.ts`.

- [ ] Step 1: `schemas/desk.ts`:

```ts
import { z } from 'zod';

export const ROOM_STATUSES = [
  'available',
  'occupied',
  'dirty',
  'reserved',
  'under_maintenance',
  'out_of_service',
] as const;
export const roomStatus = z.enum(ROOM_STATUSES);
export type RoomStatus = z.infer<typeof roomStatus>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const roomType = z.object({ name: z.string() }).nullable();

// Explicit columns only (R19). Keep in sync with deskDb's select strings.
export const BOOKING_COLUMNS =
  'id, guest_name, guest_phone, check_in_date, check_out_date, adults, children, booking_status, payment_status, checked_in, checked_in_at, checked_out_at, check_in_code, special_requests, hotel_rooms ( id, room_number, floor, status, room_type_id, hotel_room_types ( name ) )';

export const bookingRoom = z
  .object({
    id: z.string(),
    room_number: z.number().int(),
    floor: z.number().int().nullable(),
    status: roomStatus,
    room_type_id: z.string().nullable(),
    hotel_room_types: roomType,
  })
  .nullable();

export const bookingRow = z.object({
  id: z.string(),
  guest_name: z.string().nullable(),
  guest_phone: z.string().nullable(),
  check_in_date: isoDate,
  check_out_date: isoDate,
  adults: z.number().int().nullable(),
  children: z.number().int().nullable(),
  booking_status: z.enum(['confirmed', 'checked_in', 'checked_out', 'cancelled']).nullable(),
  payment_status: z.enum(['pending', 'completed', 'refunded', 'failed']).nullable(),
  checked_in: z.boolean().nullable(),
  checked_in_at: z.string().nullable(),
  checked_out_at: z.string().nullable(),
  check_in_code: z.string().nullable(),
  special_requests: z.string().nullable(),
  hotel_rooms: bookingRoom,
});
export type BookingRow = z.infer<typeof bookingRow>;

export const ROOM_COLUMNS =
  'id, room_number, floor, status, room_type_id, last_cleaned_at, hotel_room_types ( name )';
export const roomRow = z.object({
  id: z.string(),
  room_number: z.number().int(),
  floor: z.number().int().nullable(),
  status: roomStatus,
  room_type_id: z.string().nullable(),
  last_cleaned_at: z.string().nullable(),
  hotel_room_types: roomType,
});
export type RoomRow = z.infer<typeof roomRow>;

export const STAFF_COLUMNS = 'hotel_id, hotels ( id, name, city, state )';
export const staffHotelRow = z.object({
  hotel_id: z.string(),
  hotels: z
    .object({
      id: z.string(),
      name: z.string(),
      city: z.string().nullable(),
      state: z.string().nullable(),
    })
    .nullable(),
});
export type StaffHotelRow = z.infer<typeof staffHotelRow>;

// Action bodies (BACKEND_STATUS §4).
export const checkInOk = z.object({ success: z.literal(true) });
export const checkOutOk = z.object({
  success: z.literal(true),
  hours_stayed: z.number().optional(),
});
export const reassignOk = z.object({
  success: z.literal(true),
  room_number: z.number().int().nullable().optional(),
});
export const roomStatusOk = z.object({ success: z.literal(true) });
export const alreadyCheckedInBody = z.object({ checked_in_at: z.string().nullable().optional() });
export const roomConflictBody = z.object({
  room_number: z.number().int().nullable().optional(),
  room_status: z.string().optional(),
});
```

Schema test: a full row parses; a row with `hotel_rooms: null` parses; a row with `booking_status: 'completed'` fails (DB constraint has no such value).

- [ ] Step 2: Tests (`bookingState.test.ts`) — build rows with a helper:

```ts
import { viewBooking } from '@/features/receptionist/domain/bookingState';
import type { BookingRow } from '@/features/receptionist/schemas/desk';

const TODAY = '2026-10-11';
function row(p: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 'b1',
    guest_name: 'Ada Obi',
    guest_phone: '+2348031234821',
    check_in_date: TODAY,
    check_out_date: '2026-10-14',
    adults: 2,
    children: 0,
    booking_status: 'confirmed',
    payment_status: 'completed',
    checked_in: false,
    checked_in_at: null,
    checked_out_at: null,
    check_in_code: 'AB12CD34',
    special_requests: null,
    hotel_rooms: {
      id: 'r1',
      room_number: 204,
      floor: 2,
      status: 'reserved',
      room_type_id: 't1',
      hotel_room_types: { name: 'Deluxe' },
    },
    ...p,
  };
}
```

Cases (each an `it`):

- confirmed, paid, in = today → `{ stage:'arriving', actions:['checkIn','reassign'], blocker:null, warnings:[], nights:3 }`.
- in = '2026-10-13' → stage `'early'`, warnings `[{ kind:'earlyArrival', days:2, date:'2026-10-13' }]`, actions still `['checkIn','reassign']`.
- in = '2026-10-09' → stage `'overdue'`.
- payment `'pending'` → stage `'unpaid'`, blocker `{ kind:'unpaid' }`, actions `[]`.
- `'cancelled'` → stage `'cancelled'`, blocker `{ kind:'cancelled' }`, actions `[]`.
- checked_in, out = '2026-10-14' → stage `'inHouse'`, actions `['checkOut']`, warnings `[{ kind:'earlyCheckOut', days:3, date:'2026-10-14' }]`.
- checked_in, out = today → `'dueOut'`, warnings `[]`; out = '2026-10-10' → `'overdueOut'`.
- checked_out with `checked_out_at:'2026-10-11T09:00:00Z'` → stage `'checkedOut'`, blocker `{ kind:'checkedOut', at:'2026-10-11T09:00:00Z' }`.
- `booking_status:null, checked_in:true` → treated as in house.
- room status `'under_maintenance'` on a confirmed booking → warnings include `{ kind:'roomNotReady', roomNumber:204, status:'under_maintenance' }` (not a blocker; the server decides).
- same-day stay (in = out = today) → `nights: 1`.
- [ ] Step 3: Implement `bookingState.ts`:

```ts
import { daysBetween, type IsoDate } from '@/shared/lib/lagosDay';
import type { BookingRow, RoomStatus } from '@/features/receptionist/schemas/desk';

export type Stage =
  | 'arriving'
  | 'early'
  | 'overdue'
  | 'unpaid'
  | 'cancelled'
  | 'inHouse'
  | 'dueOut'
  | 'overdueOut'
  | 'checkedOut';
export type DeskAction = 'checkIn' | 'checkOut' | 'reassign';
export type Warning =
  | { kind: 'earlyArrival'; days: number; date: IsoDate }
  | { kind: 'earlyCheckOut'; days: number; date: IsoDate }
  | { kind: 'roomNotReady'; roomNumber: number; status: RoomStatus };
export type Blocker =
  { kind: 'cancelled' } | { kind: 'unpaid' } | { kind: 'checkedOut'; at: string | null };
export type BookingView = {
  stage: Stage;
  actions: DeskAction[];
  warnings: Warning[];
  blocker: Blocker | null;
  nights: number;
};

export function isInHouse(b: BookingRow): boolean {
  if (b.booking_status === 'checked_in') return true;
  return b.booking_status === null && b.checked_in === true;
}

export function viewBooking(b: BookingRow, today: IsoDate): BookingView {
  const nights = Math.max(1, daysBetween(b.check_in_date, b.check_out_date));
  const base = { nights, warnings: [] as Warning[] };
  if (b.booking_status === 'cancelled') {
    return { ...base, stage: 'cancelled', actions: [], blocker: { kind: 'cancelled' } };
  }
  if (b.booking_status === 'checked_out') {
    return {
      ...base,
      stage: 'checkedOut',
      actions: [],
      blocker: { kind: 'checkedOut', at: b.checked_out_at },
    };
  }
  if (isInHouse(b)) {
    const left = daysBetween(today, b.check_out_date);
    const stage: Stage = left > 0 ? 'inHouse' : left === 0 ? 'dueOut' : 'overdueOut';
    const warnings: Warning[] =
      left > 0 ? [{ kind: 'earlyCheckOut', days: left, date: b.check_out_date }] : [];
    return { nights, stage, actions: ['checkOut'], warnings, blocker: null };
  }
  if (b.payment_status !== 'completed') {
    return { ...base, stage: 'unpaid', actions: [], blocker: { kind: 'unpaid' } };
  }
  const early = daysBetween(today, b.check_in_date);
  const stage: Stage = early > 0 ? 'early' : early < 0 ? 'overdue' : 'arriving';
  const warnings: Warning[] = [];
  if (early > 0) warnings.push({ kind: 'earlyArrival', days: early, date: b.check_in_date });
  const room = b.hotel_rooms;
  if (room && (room.status === 'under_maintenance' || room.status === 'out_of_service')) {
    warnings.push({ kind: 'roomNotReady', roomNumber: room.room_number, status: room.status });
  }
  return { nights, stage, actions: ['checkIn', 'reassign'], warnings, blocker: null };
}
```

- [ ] Step 4: Run → PASS; tsc, lint; commit `feat(desk): booking rows and what the desk can do with each booking`.

### Task 5: Guest lists and room board (pure)

**Files:** Create `src/features/receptionist/domain/guestLists.ts`, `roomBoard.ts`, tests beside them.

- [ ] Step 1: Tests (`guestLists.test.ts`, reuse the `row()` helper idea locally):
  - `splitGuests(rows, '2026-10-11')`:
    - arriving includes confirmed+paid with in ≤ today ≤ out; excludes unpaid, excludes in = tomorrow, excludes cancelled; sorted by `check_in_date` asc then `guest_name`.
    - inHouse = all in-house rows sorted by room number (no room last) then name.
    - leaving = in-house with out ≤ today, sorted by out asc.
  - `guestCounts(lists)` → `{ arriving, inHouse, leaving }` lengths.
  - `searchGuests(rows, q)`:
    - `'ada'` matches "Ada Obi"; `'OBI'` matches (case-insensitive).
    - `'4821'` matches phone `+2348031234821` (digits); `'48'` does **not** match phones (needs ≥ 3 digits) but matches room 48 if exists.
    - `'204'` matches room 204 (exact room-number string equality), and `'20'` does not match room 204.
    - `'ab12'` matches code `AB12CD34` (prefix, case-insensitive).
    - `''` / `'  '` returns all rows unchanged.
  - `maskPhone('+2348031234821')` → `'•••• 4821'`; `maskPhone(null)` → `''`; `maskPhone('12')` → `'12'`.
- [ ] Step 2: Implement `guestLists.ts`:

```ts
import { isInHouse } from '@/features/receptionist/domain/bookingState';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import type { IsoDate } from '@/shared/lib/lagosDay';

export type GuestLists = { arriving: BookingRow[]; inHouse: BookingRow[]; leaving: BookingRow[] };
export type GuestTab = keyof GuestLists;

const byName = (a: BookingRow, b: BookingRow) =>
  (a.guest_name ?? '').localeCompare(b.guest_name ?? '');
const roomNo = (b: BookingRow) => b.hotel_rooms?.room_number ?? Number.MAX_SAFE_INTEGER;

export function isArriving(b: BookingRow, today: IsoDate): boolean {
  return (
    b.booking_status === 'confirmed' &&
    b.checked_in !== true &&
    b.payment_status === 'completed' &&
    b.check_in_date <= today &&
    b.check_out_date >= today
  );
}

export function splitGuests(rows: readonly BookingRow[], today: IsoDate): GuestLists {
  const arriving = rows
    .filter((b) => isArriving(b, today))
    .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date) || byName(a, b));
  const inHouse = rows.filter(isInHouse).sort((a, b) => roomNo(a) - roomNo(b) || byName(a, b));
  const leaving = inHouse
    .filter((b) => b.check_out_date <= today)
    .sort((a, b) => a.check_out_date.localeCompare(b.check_out_date) || byName(a, b));
  return { arriving, inHouse, leaving };
}

export function guestCounts(l: GuestLists): Record<GuestTab, number> {
  return { arriving: l.arriving.length, inHouse: l.inHouse.length, leaving: l.leaving.length };
}

export function searchGuests(rows: readonly BookingRow[], query: string): readonly BookingRow[] {
  const q = query.trim();
  if (q === '') return rows;
  const lower = q.toLowerCase();
  const upper = q.toUpperCase();
  const digits = q.replace(/\D/g, '');
  return rows.filter(
    (b) =>
      (b.guest_name ?? '').toLowerCase().includes(lower) ||
      (b.check_in_code ?? '').startsWith(upper) ||
      (b.hotel_rooms !== null && String(b.hotel_rooms.room_number) === q) ||
      (digits.length >= 3 && (b.guest_phone ?? '').replace(/\D/g, '').includes(digits)),
  );
}

export function maskPhone(phone: string | null): string {
  if (phone === null) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length <= 4 ? phone : `•••• ${digits.slice(-4)}`;
}
```

- [ ] Step 3: Tests (`roomBoard.test.ts`):
  - `roomCounts(rooms)` → counts per status + `all`, zero for absent statuses.
  - `filterRooms(rooms, 'all')` sorted by floor (null last) then room number; `filterRooms(rooms, 'dirty')` only dirty.
  - `reassignCandidates(rooms, { typeId:'t1', currentRoomId:'r1' })` → only `available`, excludes r1, same type first, then floor/number.
  - `SETTABLE_STATUSES` equals `['available','dirty','reserved','under_maintenance','out_of_service']`; `canChangeStatus({status:'occupied'})` false, others true.
  - `ROOM_STATUS_LABEL.under_maintenance === 'Maintenance'`.
- [ ] Step 4: Implement `roomBoard.ts`:

```ts
import { ROOM_STATUSES, type RoomRow, type RoomStatus } from '@/features/receptionist/schemas/desk';

export type RoomFilter = 'all' | RoomStatus;
export const SETTABLE_STATUSES: readonly RoomStatus[] = [
  'available',
  'dirty',
  'reserved',
  'under_maintenance',
  'out_of_service',
];
export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  available: 'Available',
  occupied: 'Occupied',
  dirty: 'Dirty',
  reserved: 'Reserved',
  under_maintenance: 'Maintenance',
  out_of_service: 'Out of service',
};

const floorOf = (r: RoomRow) => r.floor ?? Number.MAX_SAFE_INTEGER;
const byPlace = (a: RoomRow, b: RoomRow) =>
  floorOf(a) - floorOf(b) || a.room_number - b.room_number;

export function roomCounts(rooms: readonly RoomRow[]): Record<RoomFilter, number> {
  const counts = { all: rooms.length } as Record<RoomFilter, number>;
  for (const s of ROOM_STATUSES) counts[s] = 0;
  for (const r of rooms) counts[r.status] += 1;
  return counts;
}

export function filterRooms(rooms: readonly RoomRow[], f: RoomFilter): RoomRow[] {
  return rooms.filter((r) => f === 'all' || r.status === f).sort(byPlace);
}

export function canChangeStatus(r: Pick<RoomRow, 'status'>): boolean {
  return r.status !== 'occupied';
}

export function reassignCandidates(
  rooms: readonly RoomRow[],
  opts: { typeId: string | null; currentRoomId: string | null },
): RoomRow[] {
  const same = (r: RoomRow) => (opts.typeId !== null && r.room_type_id === opts.typeId ? 0 : 1);
  return rooms
    .filter((r) => r.status === 'available' && r.id !== opts.currentRoomId)
    .sort((a, b) => same(a) - same(b) || byPlace(a, b));
}
```

(If lint rejects the `as Record` initialiser, build the object with `Object.fromEntries` and a typed loop instead; keep the behaviour.)

- [ ] Step 5: Run → PASS; tsc, lint; commit `feat(desk): guest lists, search and the room board`.

### Task 6: Desk outcomes and reconcile (pure)

**Files:** Create `src/features/receptionist/domain/deskOutcome.ts`, `reconcile.ts`, tests beside them.

- [ ] Step 1: Tests (`deskOutcome.test.ts`) — `deskOutcome(act, result)`:

| act        | input `Result`                                                                                                                                                                             | expected                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| checkIn    | `ok({success:true})`                                                                                                                                                                       | `{kind:'done', value:{success:true}}`                                              |
| checkIn    | `err({kind:'auth'})`                                                                                                                                                                       | `{kind:'signedOut'}`                                                               |
| checkIn    | `err({kind:'rateLimited', retryAfterSec:12})`                                                                                                                                              | `{kind:'rateLimited', retryAfterSec:12}`                                           |
| checkIn    | `err({kind:'rateLimited'})`                                                                                                                                                                | `{kind:'rateLimited', retryAfterSec:null}`                                         |
| checkIn    | network / timeout / aborted / validation / `{kind:'unavailable',status:500,code:'check_in_failed'}` / `{kind:'unavailable',status:500,code:'unexpected'}` / `{kind:'unknown'}` (no status) | `{kind:'uncertain'}`                                                               |
| checkIn    | `{kind:'unknown',status:400,code:'cancelled'}`                                                                                                                                             | refused `{kind:'cancelled'}`                                                       |
| checkIn    | `{kind:'unknown',status:400,code:'not_paid'}`                                                                                                                                              | refused `{kind:'unpaid'}`                                                          |
| checkIn    | `{kind:'unknown',status:400,code:'bad_request'}`                                                                                                                                           | refused `{kind:'invalid'}`                                                         |
| checkIn    | `{kind:'forbidden',code:'forbidden'}`                                                                                                                                                      | refused `{kind:'forbidden'}`                                                       |
| checkIn    | `{kind:'notFound',code:'not_found'}`                                                                                                                                                       | refused `{kind:'notFound'}`                                                        |
| checkIn    | `{kind:'conflict',code:'already_checked_in',body:{checked_in_at:'2026-10-11T09:42:00Z'}}`                                                                                                  | refused `{kind:'alreadyIn', at:'2026-10-11T09:42:00Z'}`                            |
| checkIn    | `{kind:'conflict',code:'room_occupied',body:{room_number:204}}`                                                                                                                            | refused `{kind:'roomOccupied', roomNumber:204}`                                    |
| checkIn    | `{kind:'conflict',code:'room_unavailable',body:{room_number:204,room_status:'under_maintenance'}}`                                                                                         | refused `{kind:'roomUnavailable', roomNumber:204, roomStatus:'under_maintenance'}` |
| checkOut   | `{kind:'conflict',code:'already_checked_out'}`                                                                                                                                             | refused `{kind:'alreadyOut'}`                                                      |
| checkOut   | `{kind:'unknown',status:400,code:'not_checked_in'}`                                                                                                                                        | refused `{kind:'notCheckedIn'}`                                                    |
| roomStatus | `{kind:'conflict',code:'conflict'}`                                                                                                                                                        | refused `{kind:'roomOccupied', roomNumber:null}`                                   |
| roomStatus | `{kind:'unknown',status:400}`                                                                                                                                                              | refused `{kind:'invalid'}`                                                         |
| reassign   | `{kind:'conflict',code:'conflict'}`                                                                                                                                                        | refused `{kind:'roomTaken'}`                                                       |
| reassign   | `{kind:'unknown',status:400}`                                                                                                                                                              | refused `{kind:'invalid'}`                                                         |
| any        | `{kind:'unknown',status:422}`                                                                                                                                                              | refused `{kind:'invalid'}`                                                         |

- [ ] Step 2: Implement `deskOutcome.ts`:

```ts
import { alreadyCheckedInBody, roomConflictBody } from '@/features/receptionist/schemas/desk';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

export type DeskAct = 'checkIn' | 'checkOut' | 'reassign' | 'roomStatus';
export type Refusal =
  | { kind: 'cancelled' }
  | { kind: 'unpaid' }
  | { kind: 'alreadyIn'; at: string | null }
  | { kind: 'alreadyOut' }
  | { kind: 'notCheckedIn' }
  | { kind: 'roomOccupied'; roomNumber: number | null }
  | { kind: 'roomUnavailable'; roomNumber: number | null; roomStatus: string | null }
  | { kind: 'roomTaken' }
  | { kind: 'forbidden' }
  | { kind: 'notFound' }
  | { kind: 'invalid' };
export type DeskOutcome<T> =
  | { kind: 'done'; value: T }
  | { kind: 'refused'; refusal: Refusal }
  | { kind: 'uncertain' }
  | { kind: 'rateLimited'; retryAfterSec: number | null }
  | { kind: 'signedOut' };

const refused = (refusal: Refusal) => ({ kind: 'refused', refusal }) as const;

function conflict(act: DeskAct, code: string, body: unknown): Refusal {
  if (act === 'roomStatus') return { kind: 'roomOccupied', roomNumber: null };
  if (act === 'reassign') return { kind: 'roomTaken' };
  if (code === 'already_checked_in') {
    const b = alreadyCheckedInBody.safeParse(body);
    return { kind: 'alreadyIn', at: b.success ? (b.data.checked_in_at ?? null) : null };
  }
  if (code === 'already_checked_out') return { kind: 'alreadyOut' };
  const room = roomConflictBody.safeParse(body);
  const roomNumber = room.success ? (room.data.room_number ?? null) : null;
  if (code === 'room_unavailable') {
    const roomStatus = room.success ? (room.data.room_status ?? null) : null;
    return { kind: 'roomUnavailable', roomNumber, roomStatus };
  }
  return { kind: 'roomOccupied', roomNumber };
}

function badRequest(code: string | undefined): Refusal {
  if (code === 'cancelled') return { kind: 'cancelled' };
  if (code === 'not_paid') return { kind: 'unpaid' };
  if (code === 'not_checked_in') return { kind: 'notCheckedIn' };
  return { kind: 'invalid' };
}

export function deskOutcome<T>(act: DeskAct, r: Result<T, ApiError>): DeskOutcome<T> {
  if (r.ok) return { kind: 'done', value: r.value };
  const e = r.error;
  switch (e.kind) {
    case 'auth':
      return { kind: 'signedOut' };
    case 'rateLimited':
      return { kind: 'rateLimited', retryAfterSec: e.retryAfterSec ?? null };
    case 'forbidden':
      return refused({ kind: 'forbidden' });
    case 'notFound':
      return refused({ kind: 'notFound' });
    case 'conflict':
      return refused(conflict(act, e.code, e.body));
    case 'unknown':
      // A 4xx means the server rejected the request: nothing happened.
      if (e.status !== undefined && e.status >= 400 && e.status < 500)
        return refused(badRequest(e.code));
      return { kind: 'uncertain' };
    case 'network':
    case 'timeout':
    case 'aborted':
    case 'validation':
    case 'unavailable':
      return { kind: 'uncertain' };
  }
}
```

- [ ] Step 3: Tests (`reconcile.test.ts`), `SENT = Date.parse('2026-10-11T09:42:00Z')`:
  - `reconcileCheckIn(SENT, { booking_status:'checked_in', checked_in_at:'2026-10-11T09:42:05Z' })` → `'done'`.
  - checked_in_at 30 s **before** SENT → `'done'` (60 s grace for clock skew); 2 minutes before → `{ kind:'elsewhere', at }` form: return `'elsewhere'`.
  - `booking_status:'checked_out'` with checked_in_at after SENT → `'done'`.
  - `booking_status:'confirmed'` → `'notDone'`; `null` row → `'notDone'`; unparsable `checked_in_at` on a checked-in row → `'elsewhere'`.
  - `reconcileCheckOut(SENT, { booking_status:'checked_out', checked_out_at:'2026-10-11T09:42:03Z' })` → `'done'`; `checked_in` → `'notDone'`; checked out an hour earlier → `'elsewhere'`.
  - `reconcileReassign({ hotel_rooms: { id:'r9' } }, 'r9')` → `'done'`; other id → `'notDone'`; null row → `'notDone'`.
- [ ] Step 4: Implement `reconcile.ts`:

```ts
// R3: after an uncertain answer the desk re-reads the booking instead of posting again.
export type Reconciled = 'done' | 'notDone' | 'elsewhere';
const GRACE_MS = 60_000;

type CheckInState = { booking_status: string | null; checked_in_at: string | null };
type CheckOutState = { booking_status: string | null; checked_out_at: string | null };

function byUs(sentAtMs: number, at: string | null): Reconciled {
  const ms = at === null ? NaN : Date.parse(at);
  return Number.isFinite(ms) && ms >= sentAtMs - GRACE_MS ? 'done' : 'elsewhere';
}

export function reconcileCheckIn(sentAtMs: number, row: CheckInState | null): Reconciled {
  if (row === null) return 'notDone';
  if (row.booking_status !== 'checked_in' && row.booking_status !== 'checked_out') return 'notDone';
  return byUs(sentAtMs, row.checked_in_at);
}

export function reconcileCheckOut(sentAtMs: number, row: CheckOutState | null): Reconciled {
  if (row === null || row.booking_status !== 'checked_out') return 'notDone';
  return byUs(sentAtMs, row.checked_out_at);
}

export function reconcileReassign(
  row: { hotel_rooms: { id: string } | null } | null,
  targetRoomId: string,
): 'done' | 'notDone' {
  return row?.hotel_rooms?.id === targetRoomId ? 'done' : 'notDone';
}
```

- [ ] Step 5: Run → PASS; tsc, lint; commit `feat(desk): map every front-desk answer and re-read after a lost response`.

### Task 7: Check-in flow reducer (pure)

**Files:** Create `src/features/receptionist/domain/checkInFlow.ts`, test beside it.

**Produces:**

```ts
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import type { CheckInCode } from '@/features/receptionist/domain/checkInCode';
import type { Refusal } from '@/features/receptionist/domain/deskOutcome';

export type FlowState =
  | { step: 'entry'; error: 'empty' | 'shape' | 'eventTicket' | null }
  | { step: 'looking'; code: CheckInCode }
  | { step: 'notFound'; code: CheckInCode }
  | { step: 'lookupFailed'; code: CheckInCode }
  | { step: 'preview'; booking: BookingRow }
  | { step: 'sending'; booking: BookingRow; sentAt: number }
  | { step: 'refused'; booking: BookingRow; refusal: Refusal }
  | { step: 'uncertain'; booking: BookingRow; sentAt: number }
  | { step: 'rechecking'; booking: BookingRow; sentAt: number }
  | { step: 'rateLimited'; booking: BookingRow; untilMs: number | null }
  | { step: 'done'; booking: BookingRow }
  | { step: 'elsewhere'; booking: BookingRow };

export type FlowEvent =
  | { type: 'submit'; raw: string } // typed or scanned
  | { type: 'found'; booking: BookingRow | null }
  | { type: 'lookupError' }
  | { type: 'confirm'; nowMs: number }
  | { type: 'answer'; outcome: DeskOutcome<unknown>; nowMs: number }
  | { type: 'recheck' }
  | { type: 'rechecked'; booking: BookingRow | null; reconciled: Reconciled }
  | { type: 'recheckError' }
  | { type: 'bookingChanged'; booking: BookingRow } // after a reassign
  | { type: 'reset' };

export const initialFlow: FlowState = { step: 'entry', error: null };
export function checkInFlow(s: FlowState, e: FlowEvent): FlowState;
```

Transitions (anything not listed returns `s` unchanged):

- `submit` from `entry`/`notFound`/`lookupFailed`: parse with `parseCheckInCode`; invalid → `entry` with the reason; valid → `looking`.
- `found` in `looking`: null → `notFound`; booking → `preview`.
- `lookupError` in `looking` → `lookupFailed`.
- `confirm` in `preview` (only if `viewBooking(...)` would allow — the hook guards; reducer just moves) or `rateLimited` (when `untilMs === null || nowMs >= untilMs`) → `sending` with `sentAt: nowMs`.
- `answer` in `sending`: `done` → `done`; `refused` with `alreadyIn` → `rechecking` (R3: re-read decides done vs elsewhere); other `refused` → `refused`; `uncertain` → `uncertain`; `rateLimited` → `rateLimited` with `untilMs = retryAfterSec === null ? null : nowMs + retryAfterSec*1000`; `signedOut` → unchanged (the session layer handles it).
- `recheck` in `uncertain` → `rechecking`.
- `rechecked` in `rechecking`: `done` → `done` (booking = re-read row ?? old); `elsewhere` → `elsewhere`; `notDone` → `preview` with the re-read booking (staff may press Check in again).
- `recheckError` in `rechecking` → `uncertain` (same sentAt).
- `bookingChanged` in `preview`/`refused` → `preview` with the new booking.
- `reset` from any → `initialFlow`.

- [ ] Step 1: Tests: one `it` per transition above, plus: `confirm` from `rateLimited` before `untilMs` stays put; `submit` while `sending` is ignored; `submit(' bh2.x ')` → entry error `eventTicket`.
- [ ] Step 2: Implement (a `switch (e.type)` with guards on `s.step`; import `parseCheckInCode`). No side effects.
- [ ] Step 3: Run → PASS; tsc, lint; commit `feat(desk): check-in flow from code to confirmed`.

### Task 8: Desk data access

**Files:** Create `src/features/receptionist/api/deskDb.ts`, `deskApi.ts`, tests `src/features/receptionist/api/__tests__/deskDb.test.ts`, `deskApi.test.ts`.

**Produces:**

```ts
// deskDb.ts — RLS reads. `Db` is injected so tests pass a fake; the default uses `supabase`.
export type DeskDb = {
  staffHotels(userId: string): Promise<Result<StaffHotelRow[], ApiError>>;
  guests(hotelId: string, today: IsoDate): Promise<Result<BookingRow[], ApiError>>;
  bookingByCode(hotelId: string, code: CheckInCode): Promise<Result<BookingRow | null, ApiError>>;
  bookingById(hotelId: string, id: string): Promise<Result<BookingRow | null, ApiError>>;
  rooms(hotelId: string): Promise<Result<RoomRow[], ApiError>>;
};
export function createDeskDb(client: SupabaseLike): DeskDb;
export const deskDb: DeskDb; // createDeskDb(supabase)

// deskApi.ts — actions through the shared API client (never idempotent).
export function checkIn(
  c: Requester,
  bookingId: string,
): Promise<Result<{ success: true }, ApiError>>;
export function checkOut(
  c: Requester,
  bookingId: string,
): Promise<Result<{ success: true; hours_stayed?: number }, ApiError>>;
export function reassignRoom(
  c: Requester,
  bookingId: string,
  roomId: string,
): Promise<Result<{ success: true; room_number?: number | null }, ApiError>>;
export function setRoomStatus(
  c: Requester,
  roomId: string,
  status: SettableStatus,
): Promise<Result<{ success: true }, ApiError>>;
export const DESK_TIMEOUT_MS = 10_000;
```

Queries (exact):

- staffHotels: `from('hotel_staff').select(STAFF_COLUMNS).eq('user_id', userId)`.
- guests: `from('hotel_bookings').select(BOOKING_COLUMNS).eq('hotel_id', hotelId).or(\`booking_status.eq.checked_in,and(booking_status.eq.confirmed,payment_status.eq.completed,check_in_date.lte.${today},check_out_date.gte.${today})\`).order('check_in_date').limit(500)`.
- bookingByCode: `.eq('hotel_id', hotelId).eq('check_in_code', code).maybeSingle()`; bookingById: `.eq('hotel_id', hotelId).eq('id', id).maybeSingle()`.
- rooms: `from('hotel_rooms').select(ROOM_COLUMNS).eq('hotel_id', hotelId).order('floor').order('room_number').limit(1000)`.
- Each: `wrap(...)` → on error `dbErrorToApiError`; parse with zod (`z.array(bookingRow)` etc.); parse failure → `err({ kind: 'validation' })`. A `maybeSingle` PGRST116 (several rows) also maps through `dbErrorToApiError` — fine.
- Routes: `POST /api/bookings/hotel/checkin` `{ booking_id }`; `POST /api/bookings/hotel/checkout` `{ booking_id }`; `PATCH /api/bookings/hotel/${encodeURIComponent(id)}/reassign-room` `{ new_room_id }`; `PATCH /api/hotel/rooms/${encodeURIComponent(roomId)}/status` `{ status }`; all with `timeoutMs: DESK_TIMEOUT_MS`.

- [ ] Step 1: Tests: deskDb with a fake builder recording calls (assert table, select string = the exported constant, filters, and that `guest_email` never appears in any select string); a row failing the schema → `validation`; a `{status: 503}` error → `unavailable`. deskApi with a fake `request` asserting path, method, body, `timeoutMs`, and that `idempotent` is never set.
- [ ] Step 2: Implement; `SupabaseLike` is the minimal structural type you need (`from(table)` returning the builder) — or type the default with `typeof supabase` and tests cast a fake through `unknown` in the test file only.
- [ ] Step 3: Run → PASS; tsc, lint; commit `feat(desk): RLS reads and front-desk actions`.

### Task 9: Hotel context, routes, tabs, account sheet

**Files:**

- Create `src/features/receptionist/hooks/useHotel.ts`, `src/features/receptionist/state/shiftLog.ts`, `src/features/receptionist/hooks/DeskContext.tsx`, `src/features/receptionist/screens/HotelGateScreen.tsx` (picker / none / unavailable / loading / error), `src/features/receptionist/ui/DeskAccountSheet.tsx`, `src/shared/ui/useWide.ts` (exported from `shared/ui/index.ts`).
- Routes: rewrite `src/app/(receptionist)/_layout.tsx`; create `src/app/(receptionist)/(tabs)/_layout.tsx`, `(tabs)/today.tsx`, `(tabs)/guests.tsx`, `(tabs)/rooms.tsx` (temporary `EmptyState` bodies until Tasks 11–15), `src/app/(receptionist)/booking/[id].tsx` (placeholder), `src/app/(receptionist)/activity.tsx` (placeholder). Delete `src/app/(receptionist)/front-desk.tsx` and `src/features/receptionist/screens/ReceptionistShell.tsx` (+ their tests; update any app-level route test that referenced `/front-desk`).
- Tests for `useHotel`, `shiftLog`, `HotelGateScreen`, `DeskAccountSheet`, `useWide`.

**Produces:**

```ts
// useHotel.ts
export type DeskHotel = { id: string; name: string; place: string /* 'Ikeja, Lagos' or '' */ };
export type HotelState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'none' }
  | { status: 'unavailable' }
  | { status: 'pick'; hotels: DeskHotel[]; choose: (id: string) => void }
  | { status: 'ready'; hotel: DeskHotel; hotels: DeskHotel[]; change: () => void };
export function useHotel(userId: string): HotelState;
// Rules: rows from deskDb.staffHotels (query key ['desk','staff',userId]).
//  0 rows → none; all rows with hotels null → unavailable; rows with hotels drop the null ones;
//  1 usable → ready; >1 → choice remembered in plainKv `bh.desk.hotel.<userId>` (try/catch; a stale id is ignored) → ready, else pick.
//  change() clears the stored choice and returns to pick (only offered when hotels.length > 1).

// shiftLog.ts (zustand, memory only — R11)
export type ShiftEntry = {
  at: number;
  kind: 'checkIn' | 'checkOut' | 'reassign' | 'roomStatus';
  text: string;
};
export const useShiftLog: UseBoundStore<
  StoreApi<{ entries: ShiftEntry[]; add(e: ShiftEntry): void; clear(): void }>
>;
// newest first, capped at 200.

// DeskContext.tsx
export type Desk = {
  userId: string;
  email: string;
  hotel: DeskHotel;
  today: IsoDate;
  openAccount: () => void;
  openCheckIn: (code?: string) => void;
};
export function DeskProvider(p: { value: Desk; children: ReactNode }): JSX.Element;
export function useDesk(): Desk; // throws outside the provider

// useWide.ts (shared/ui)
export function useWide(): boolean; // useWindowDimensions().width >= 768
```

Layout behaviour:

- `(receptionist)/_layout.tsx` (route file — may import auth/mode): reads `useAuth` (userId, email), `useHotel(userId)`; not ready → `<HotelGateScreen state=… onSignOut=…/>` inside `DensityProvider density="work"`; ready → `DeskProvider` + `<Stack screenOptions={{ headerShown:false }} />` + `<DeskAccountSheet …/>` (+ the check-in sheet slot, filled in Task 13). `today` = `lagosToday(clock.serverNow())`, recomputed each minute (a 60 s interval updating state). `export const unstable_settings = { initialRouteName: '(tabs)' }`. On unmount: `useShiftLog.getState().clear()`.
- `(tabs)/_layout.tsx`: `Tabs` from `expo-router`; screens `today` ("Today", `LayoutDashboard`), `guests` ("Guests", `Users`), `rooms` ("Rooms", `BedDouble`) from lucide; `tabBarPosition: wide ? 'left' : 'bottom'`; label font = the kit's UI font family token, colours from `color` tokens (active = action violet, inactive = text secondary), `headerShown:false`, min tab height ≥ 48.
- `DeskAccountSheet` props `{ visible; email; hotelName; canChangeHotel; modeSwitcher: ReactNode; onChangeHotel; onActivity; onSignOut; onClose }`: card "Signed in as <email>" + "Front desk at <hotel>"; **Change hotel** (only when canChangeHotel); **Shift activity** link; modeSwitcher slot; footer **Sign out**. No Delete account (receptionists can't delete; spec UI-B).
- `HotelGateScreen`: `loading` → kit `LoadingScreen`-style spinner text "Loading your hotel…"; `error` → `ErrorState` "Couldn't load your hotel" + Try again; `none` → `EmptyState` "No hotel assigned" / "Ask the hotel owner to add you as front desk staff." + Sign out; `unavailable` → "This hotel isn't available right now" / "Contact the hotel owner." + Sign out; `pick` → Header "Choose a hotel" + `ListRow` per hotel (title name, subtitle place).

- [ ] Step 1: Tests first for `useHotel` (0 / 1 / 2 rows; 2 rows with stored choice; stale stored id; all-null hotels → unavailable; error → retry refetches) with `deskDb` mocked via `jest.mock('@/features/receptionist/api/deskDb')` and `plainKv` mocked; `shiftLog` (add order, cap 200, clear); `HotelGateScreen` texts per state; `DeskAccountSheet` (Change hotel hidden for one hotel, no "Delete account" text).
- [ ] Step 2: Implement; route the app. Run `npx jest src/features/receptionist src/app` → PASS. `npx expo lint`, tsc (typed routes: `/today`, `/guests`, `/rooms`, `/booking/[id]`, `/activity` must type-check).
- [ ] Step 3: Commit `feat(desk): hotel context, front-desk tabs and account sheet`.

### Task 10: Data hooks and live refresh

**Files:** Create `src/features/receptionist/hooks/useGuests.ts`, `useRooms.ts`, `useBooking.ts`, `useDeskLive.ts`, `useFreshness.ts`; tests beside them in `hooks/__tests__/`.

**Produces:**

```ts
export const deskKeys = {
  all: (hotelId: string) => ['desk', hotelId] as const,
  guests: (hotelId: string, today: IsoDate) => ['desk', hotelId, 'guests', today] as const,
  rooms: (hotelId: string) => ['desk', hotelId, 'rooms'] as const,
  booking: (hotelId: string, id: string) => ['desk', hotelId, 'booking', id] as const,
};
export function useGuests(): {
  lists: GuestLists | null;
  rows: BookingRow[];
  loading: boolean;
  error: boolean;
  refetch: () => void;
  updatedAt: number;
};
export function useRooms(): {
  rooms: RoomRow[];
  loading: boolean;
  error: boolean;
  refetch: () => void;
  updatedAt: number;
};
export function useBooking(id: string): {
  booking: BookingRow | null | undefined;
  error: boolean;
  refetch: () => void;
};
export function useDeskLive(hotelId: string): void; // mounted once in the (receptionist) layout
export function useFreshness(updatedAt: number): string | null; // 'Updated 3 min ago' when > 2 min old, else null; re-evaluates every 30 s
```

- Query functions throw a `DeskLoadError` carrying `kind` (same pattern as `ModeLoadError` in `features/mode/hooks/useModeState.ts`) so the shared retry policy applies.
- `useGuests`/`useRooms` use `useDesk()` for `hotel.id`/`today`; `refetchInterval: isFocused ? 30_000 : false` with `useIsFocused` (verify the export from `expo-router` for SDK 57; if absent use `useFocusEffect` to toggle a state flag); `refetchOnWindowFocus: true` (AppState focus is wired in `queryClient.ts`); `placeholderData: keepPreviousData` so a failed background refetch keeps the list.
- `useDeskLive`: `supabase.channel(\`desk:${hotelId}\`).on('postgres_changes', { event:'*', schema:'public', table:'hotel_bookings', filter:\`hotel_id=eq.${hotelId}\` }, bump).on(... 'hotel_rooms' ...).subscribe((status) => { if (status === 'SUBSCRIBED') bump(); })`; `bump`=`queryClient.invalidateQueries({ queryKey: deskKeys.all(hotelId) })`throttled to once per 2 s (use`src/shared/lib/trailing.ts`if it fits); cleanup`void supabase.removeChannel(channel)`. Events are triggers only (R10), never data.

- [ ] Step 1: Tests: `useGuests` splits via `splitGuests` with today from context; error with no data → `error: true`; background error keeps rows. `useDeskLive` with a mocked `supabase.channel` chain: subscribes to both tables with the hotel filter, invalidates on an event and on `SUBSCRIBED`, removes the channel on unmount. `useFreshness` with fake timers: null at 1 min, "Updated 3 min ago" at 3 min.
- [ ] Step 2: Implement; run → PASS; tsc, lint; commit `feat(desk): guest and room data with polling and live refresh`.

### Task 11: Today screen

**Files:** Create `src/features/receptionist/screens/TodayScreen.tsx`, `src/features/receptionist/ui/CountCard.tsx`, `src/features/receptionist/ui/GuestRow.tsx`, `src/features/receptionist/ui/stageLabel.ts` (stage → `{ label, tone: StatusTone }`); wire `(tabs)/today.tsx`; tests.

Content (spec §3): `Screen` with `Header` title = hotel name, subtitle = `longDate(today)`, right = account `IconButton` (`UserRound`, "Account"). `CountCard`: one `Card` with four cells in a 2×2 grid on phones and 1×4 on wide — each cell a pressable (≥ 44 pt) with the number (`display`/`titleLg` tabular) and label; accessibility label "Arriving, 4"; Arriving/In house/Leaving → `router.push({ pathname: '/guests', params: { tab } })`; Free rooms → `/rooms?filter=available`. Under it **Check in a guest** (primary, `ScanLine` icon) → `openCheckIn()`. Then `SectionHeader` "Arriving today" (count) + first 8 `GuestRow`s (→ `/booking/[id]`) + "See all" `TextLink` when more; `EmptyState` "No more arrivals today" when none. Freshness line (`useFreshness`) under the header as `bodySm` muted text. First load: `SkeletonRows`; error with no data: `ErrorState` "Couldn't load today" + Try again. Pull to refresh.

`GuestRow`: `ListRow` title guest name ("Guest" if null), subtitle `Room 204 · Deluxe` or `No room yet`, then `stayRange` + nights; trailing `StatusPill` from `stageLabel`: arriving "Arriving"/info, early "Early"/info, overdue "Overdue"/warning, inHouse "In house"/success, dueOut "Due out"/warning, overdueOut "Overdue out"/danger, unpaid "Not paid"/warning, cancelled "Cancelled"/neutral, checkedOut "Checked out"/neutral. (Use whichever `StatusTone` names exist in `color.status`; map to the nearest — read `src/shared/theme/theme.ts`.)

- [ ] Step 1: RNTL tests with hooks mocked: counts render with labels; pressing "Arriving, 2" pushes `/guests` with `tab: 'arriving'`; Check in button calls `openCheckIn`; empty arrivals text; error state + retry calls refetch; freshness line shown when provided.
- [ ] Step 2: Implement; run; tsc, lint; commit `feat(desk): today at the front desk`.

### Task 12: Guests and booking detail (two-pane on tablets)

**Files:** Create `src/features/receptionist/screens/GuestsScreen.tsx`, `BookingScreen.tsx`, `src/features/receptionist/ui/BookingSummary.tsx`, `src/features/receptionist/ui/warningText.ts`; wire `(tabs)/guests.tsx`, `booking/[id].tsx`; tests.

- `GuestsScreen`: Header "Guests" + right: Check in button (`IconButton` `ScanLine` "Check in a guest") and account; `SegmentedControl` options `Arriving (n) · In house (n) · Leaving (n)` (initial from the `tab` route param); `SearchField` label "Search guests", placeholder "Name, phone, room or code"; list = `searchGuests(lists[tab], q)` in a `FlatList` of `GuestRow`; per-tab empty states ("No arrivals left today", "No guests checked in", "Nobody is due out today"); search empty: "No guest matches “q”". Wide (`useWide`): row press selects into the right pane (`BookingSummary` + actions) instead of pushing; left pane width 380, 24 gutter; the first row is not auto-selected (the right pane shows "Choose a guest").
- `BookingSummary` (presentational) props `{ booking: BookingRow; view: BookingView; hotelName: string }`: status `StatusPill` + guest name (`titleLg`) · rows (label/value): Code, Dates (`shortDate` in – `shortDate` out, "3 nights"), Room ("Room 204 · Deluxe · Floor 2" / "No room yet"), Guests ("2 adults, 1 child"), Payment ("Paid" / "Not paid" / "Refunded" / "Failed"), Phone (full number, `tel:` link via `Linking.openURL`), Special requests (when present) · warnings as `Banner tone="info"` using `warningText(w)`:
  - earlyArrival: "Booked for Wed 14 Oct — 2 days early. You can still check them in."
  - earlyCheckOut: "Booked until Wed 14 Oct — leaving 3 days early."
  - roomNotReady: "Room 204 is marked under maintenance. Choose another room or check with housekeeping."
  - blockers (danger/neutral `Banner`): cancelled "This booking was cancelled."; unpaid "Payment hasn't been completed for this booking. The guest can pay on the Bookhushly app or website."; checkedOut "This guest checked out at 10:42." (`lagosTime`).
- `BookingScreen` (`/booking/[id]`): `useBooking(id)`; Header with back; `BookingSummary`; footer actions by `view.actions`: **Check in** (primary) → `openCheckIn` with the booking's code (the check-in sheet skips straight to preview, Task 13), **Choose another room** (secondary, Task 13 sheet), **Check out** (primary, Task 14 sheet). Until Tasks 13/14 land, the buttons call the context functions that exist; Task 14 adds check-out.
- [ ] Step 1: RNTL tests: tab switch + counts in labels; search narrows; empty states; wide layout (mock `useWide` true) shows "Choose a guest" then the summary after a press, without `router.push`; BookingSummary renders each warning/blocker text and payment label; booking not found (`null`) → `EmptyState` "This booking isn't at <hotel>".
- [ ] Step 2: Implement; run; tsc, lint; commit `feat(desk): guest lists, search and booking details`.

### Task 13: Check-in sheet and choose-room sheet

**Files:** Create `src/features/receptionist/hooks/useCheckIn.ts`, `useReassign.ts`, `src/features/receptionist/ui/CheckInSheet.tsx`, `ChooseRoomSheet.tsx`, `src/features/receptionist/ui/refusalText.ts`; render `CheckInSheet` once in `(receptionist)/_layout.tsx` (driven by `openCheckIn`); tests.

- `useCheckIn()` wraps `checkInFlow` with `useReducer` and effects:
  - `looking` → `deskDb.bookingByCode(hotel.id, code)` → `found` / `lookupError`.
  - `sending` → `checkIn(api, booking.id)` → `answer` with `deskOutcome('checkIn', r)`, `nowMs = clock.serverNow()`. On `done`: `useShiftLog.add({ kind:'checkIn', text: \`Checked in ${name} · Room ${n}\` })`, `feedback`success haptic (see`src/shared/platform/feedback.ts`), invalidate `deskKeys.all`.
  - `rechecking` → `deskDb.bookingById` → `rechecked` with `reconcileCheckIn(sentAt, row)` / `recheckError`.
  - `signedOut` outcome → call the existing session-expired path (the same thing the API client's 401 handling leads to; if the app has a `useAuth` sign-out-on-expiry, the route layout passes `onSignedOut` into the sheet — features must not import auth).
  - `openCheckIn(code)` with a code dispatches `reset` then `submit(code)` (Booking screen path).
  - Guard: `confirm` only when `viewBooking(booking, today).actions` includes `'checkIn'`.
- `CheckInSheet` (Sheet, `scroll`), title by step: entry "Check in a guest"; preview "Check in <first name>"; done "Checked in".
  - **entry**: `SegmentedControl` Type code / Scan QR (default Type code, R13). Type: `Input` label "Check-in code", `autoCapitalize="characters"`, `autoCorrect={false}`, `maxLength={12}`, error text from the reason: empty "Enter the guest's 8-character code."; shape "Check-in codes are 8 letters and numbers."; eventTicket "That's an event ticket, not a hotel check-in code."; footer **Find booking**. Scan: `QrCamera` (from `@/shared/ui/camera`) in a 1:1 rounded box (mounted only while the sheet is visible, the Scan tab is selected, and `useAppActive()`), `CameraPrompt` with `tone="default"`, askTitle "Allow camera to scan check-in codes", body "The camera is only used to read check-in codes. Nothing is recorded.", byHandLabel "Type the code instead"; a scanned value dispatches `submit` once (pause the camera while not in `entry`).
  - **looking**: spinner "Finding booking…".
  - **notFound**: Banner warning "No booking with code AB12CD34 at <hotel>. Check the code with the guest." + the code field again.
  - **lookupFailed**: Banner neutral "Couldn't look up the code. Check the connection and try again." + **Try again** (re-submit the same code).
  - **preview/refused/rateLimited**: `BookingSummary`; refusal Banner from `refusalText` (spec §4 table: cancelled, unpaid, alreadyIn "Already checked in at 10:42", alreadyOut, roomOccupied "Room 204 still has a guest checked in.", roomUnavailable "Room 204 is under maintenance." / "out of service", forbidden "You can't check in guests at this hotel.", notFound "This booking no longer exists.", invalid "Couldn't check in this booking. Try again or use the web dashboard.") with **Choose another room** action for roomOccupied/roomUnavailable; rateLimited Banner neutral "This hotel's network is sending too many requests — try again in 12 s." (countdown via `src/shared/lib/cooldown.ts`; button disabled until then). Footer: **Check in** (primary, `loading` while sending) + **Cancel**.
  - **uncertain**: Banner neutral "Couldn't confirm the check-in. It may have gone through." + **Check again** (primary).
  - **rechecking**: spinner "Checking…".
  - **done**: `SuccessMark animate`, "Checked in · Room 204" (`titleLg`), guest name, early-arrival note if any; `announce('Checked in')`; footer **Done** (closes, `reset`).
  - **elsewhere**: Banner info "Already checked in at 10:42 (by another desk or device)." + **Done**.
  - Close while `sending`/`rechecking` is disabled (`closeDisabled`).
- `useReassign(booking)` + `ChooseRoomSheet`: rooms from `useRooms` → `reassignCandidates(rooms, { typeId: booking.hotel_rooms?.room_type_id ?? null, currentRoomId: booking.hotel_rooms?.id ?? null })`, grouped by floor (`SectionHeader` "Floor 2"), `ListRow` "Room 305 · Deluxe"; empty → "No free rooms right now. Mark a cleaned room as available on the Rooms tab."; tap → inline confirm "Move <name> to Room 305?" with **Move** / Cancel → `reassignRoom` → `deskOutcome('reassign')`: done → shift log "Moved <name> to Room 305", invalidate, re-read the booking and dispatch `bookingChanged` into the check-in flow (when opened from it) or refetch the booking; uncertain → "Couldn't confirm the move." + **Check again** (re-read, `reconcileReassign`); refused roomTaken → "Room 305 was just taken. Choose another."; forbidden/notFound/invalid → their texts.
- [ ] Step 1: Tests (RNTL, data layer mocked, `jest.mock('@/shared/ui/camera')` to a stub that exposes an `onCode` trigger):
  - type `ab12cd34` → Find booking → preview shows guest + "Room 204" → Check in → done "Checked in · Room 204", shift log has 1 entry, invalidate called.
  - `BH2.x` → event-ticket error, no lookup call.
  - lookup returns null → not-found text with the code; lookup error → "Couldn't look up the code" + Try again re-queries.
  - POST timeout → uncertain → Check again → re-read checked_in at send time → done; re-read confirmed → back to preview with Check in enabled.
  - 409 already_checked_in after our send → rechecking → reconcile `elsewhere` (checked in an hour earlier) → "Already checked in at …".
  - 400 not_paid, 409 room_occupied (shows Choose another room), 403, 429 with retry_after 12 (button disabled, text shows 12 s).
  - scan path: stub camera emits `AB12CD34` → lookup called once even if emitted twice.
  - Choose room: candidates ordered same type first; Move → reassign called with ids; success updates preview room; 409 → "was just taken".
- [ ] Step 2: Implement; run; tsc, lint; commit `feat(desk): check in by code or QR with a confirm step, and move a booking to another room`.

### Task 14: Check-out and shift activity

**Files:** Create `src/features/receptionist/hooks/useCheckOut.ts`, `src/features/receptionist/ui/CheckOutSheet.tsx`, `src/features/receptionist/screens/ActivityScreen.tsx`; wire Booking screen's **Check out** and the two-pane action; wire `activity.tsx` (+ account sheet's Shift activity link); tests.

- `useCheckOut(booking)`: states `confirm · sending · done · refused · uncertain · rechecking · rateLimited · elsewhere` (mirror the check-in reducer pattern; a small local reducer in the hook file is fine, unit-tested through the hook), using `checkOut`, `deskOutcome('checkOut')`, `reconcileCheckOut`; `alreadyOut` after our send → recheck; done → shift log "Checked out <name> · Room 204", success haptic, invalidate.
- `CheckOutSheet`: title "Check out <first name>"; guest, room, `stayRange`; early-check-out `Banner info` (warningText); line "Room 204 will be marked dirty." (only with a room); footer **Check out** (primary) + Cancel; done: SuccessMark + "Checked out · Room 204 is now dirty"; refusal texts: alreadyOut "This guest has already checked out.", notCheckedIn "This guest isn't checked in.", forbidden, notFound; uncertain "Couldn't confirm the check-out. It may have gone through." + Check again.
- `ActivityScreen`: Header "Shift activity" subtitle "This device, since you opened the front desk"; `FlatList` of entries: `ListRow` title = text, subtitle = `lagosTime` of `at` (ISO from ms); empty → `EmptyState` "Nothing yet" / "Check-ins, check-outs and room changes you make here appear in this list."
- [ ] Step 1: Tests: check-out happy path (sheet text includes "will be marked dirty", early banner when out > today); timeout → Check again → done; 409 already_checked_out after send → recheck elsewhere → "already checked out at …"; Activity lists entries newest first and shows the empty state.
- [ ] Step 2: Implement; run; tsc, lint; commit `feat(desk): check out guests and see this shift's activity`.

### Task 15: Rooms board and room sheet

**Files:** Create `src/features/receptionist/screens/RoomsScreen.tsx`, `src/features/receptionist/ui/RoomRow.tsx`, `RoomTile.tsx`, `RoomSheet.tsx`, `src/features/receptionist/ui/roomTone.ts`, `src/features/receptionist/hooks/useRoomStatus.ts`; wire `(tabs)/rooms.tsx`; tests.

- `RoomsScreen`: Header "Rooms" + account; horizontal `ScrollView` of filter chips (use `ToggleButton` or `SegmentedControl` — pick the kit piece that supports many options; chips must be ≥ 44 pt tall) labelled "All 24 · Available 6 · Occupied 12 · Dirty 3 · Reserved 2 · Maintenance 1 · Out of service 0" (hide zero-count chips except All and the active one); initial filter from the `filter` route param; phone: `FlatList` of `RoomRow` (title "Room 204", subtitle "Deluxe · Floor 2", trailing status dot + word, note "Cleaned 09:12" when `last_cleaned_at` is today); wide: grid of `RoomTile` (min tile width 140, number `titleLg`, type, status dot + word) via `FlatList numColumns` computed from width. Empty filter → "No rooms are <status> right now." First load skeleton; error state.
- `roomTone`: available → success, occupied → info (violet), dirty → warning, reserved → neutral, under_maintenance → warning, out_of_service → danger (map to existing `StatusTone` keys).
- `RoomSheet` (room): title "Room 204"; current status pill; when occupied: Banner info "A guest is checked in. Check them out first to change this room." and the in-house guest's name (from `useGuests().lists.inHouse` by room id) with a link to their booking; otherwise a radio list (`ListRow` with `accessibilityRole="radio"` + `accessibilityState.checked`) of `SETTABLE_STATUSES` with labels, the current one selected; footer **Save** (disabled until changed).
- `useRoomStatus(room)`: `setRoomStatus` → `deskOutcome('roomStatus')`: done → shift log "Room 204 marked dirty", invalidate rooms, close; refused roomOccupied → "A guest was just checked in to this room."; notFound → "This room no longer exists."; **forbidden → silently re-run `deskDb.staffHotels(userId)` once: if the hotel is still in the list, show neutral "Couldn't save. Try again."; if not, show "You can't change rooms at this hotel."** (R18); uncertain → "Couldn't confirm. Check the board and try again." (refetch rooms; the PATCH is idempotent, so **Try again** is allowed here); rateLimited as in Task 13.
- [ ] Step 1: Tests: counts on chips; filter param applied; occupied room sheet shows the guest and no Save; change dirty → available → Save → `setRoomStatus(api, id, 'available')`; 409 text; 403 with hotel still listed → "Couldn't save. Try again." and with hotel gone → "You can't change rooms at this hotel."; wide grid renders tiles.
- [ ] Step 2: Implement; run; tsc, lint; commit `feat(desk): room board with status changes`.

### Task 16: Requirements notes and phone checklist

**Files:** Modify `docs/MOBILE_APP_REQUIREMENTS.md` (FR-4.4: `pay_at_hotel` unreachable, paid = `completed`; FR-4.5: status becomes `checked_out`, room → dirty, early-check-out warning is client-side; FR-4.6: no balance, show payment status; FR-4.10: device-local, this session; §5.3/5.4 notes pointing to BACKEND_STATUS §4); create `docs/device-tests/2026-10-11-phone-checks-phase-3-front-desk.md`.

Checklist content (same style as `2026-10-09-phone-checks-ui-a-ui-b.md`: build line, before-you-start, parts with checkboxes, Tell me):

- Before you start: create the receptionist through the **vendor dashboard → hotel → Staff → Add receptionist** (password shown once; keep it out of chat logs); the hotel needs at least 4 rooms (one per status case); one **paid** test booking for today, one for tomorrow (early arrival), and later a second phone signed in as the same receptionist for the simultaneous check-in; note how you'll cancel/refund the test bookings afterwards.
- Part A Sign in and Today (lands on Today with the hotel name and date; counts match the web dashboard; tablet shows the left rail if you have one).
- Part B Check in by code (16: type code → preview → Check in → "Checked in · Room …", room shows Occupied on Rooms; guest notified if they have an account).
- Part C Scan QR (camera prompt text; scan the guest's QR from the customer booking page; an event ticket QR says "event ticket").
- Part D Refusals (17 other hotel's code → not found at this hotel; 18 already checked in; 19 unpaid booking → payment message; 20 tomorrow's booking → early banner, can proceed; 21 two phones press Check in together → exactly one "Checked in", the other "Already checked in at …"; airplane mode right after pressing Check in → "Couldn't confirm" → back online → Check again → "Checked in").
- Part E Choose another room (set the booked room to Maintenance on the web or Rooms tab first; check-in offers Choose another room; move; check in).
- Part F Check out (early-check-out banner; room becomes Dirty; Activity lists it).
- Part G Rooms (22 occupied room can't be changed, message shown; Dirty → Available updates the Free rooms count on Today within 30 s on a second device).
- Part H Comfort (largest text: sheets scroll, tabs readable; TalkBack reads count cells "Arriving, 2" and outcomes).
- Clean-up: check out the test guests, cancel/refund test bookings the usual way, delete the receptionist from the vendor staff panel if it was only for testing.
- [ ] Step 1: Write both docs; `npx prettier --write` them; commit `docs(phase-3): requirement notes from the verified contract and the front-desk phone checklist`.
