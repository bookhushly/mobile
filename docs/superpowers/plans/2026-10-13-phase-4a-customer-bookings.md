# Phase 4a Customer Bookings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in customers see their bookings, show live event tickets and hotel check-in codes (also offline once opened), read their notifications and edit their profile.

**Architecture:**

- Pure domain units in `src/features/customer/domain` handle merging and classifying bookings, ticket and live-code logic, the check-in code rule and notification targets.
- RLS reads and writes go through supabase-js; the live ticket code comes through the shared API client.
- An encrypted offline wallet is wiped on sign-out.
- TanStack Query hooks feed screens built from the UI-A kit.
- Routes: `(customer)` Stack → `(tabs)` with Bookings and Account; full-screen ticket and check-in-code routes; booking detail; notifications.

**Tech Stack:** Expo SDK 57, expo-router 57 (JS `Tabs`), React 19.2 + Compiler, TanStack Query 5, supabase-js 2.117, zod v4, `qrcode-generator` 2.x, `expo-brightness`, `expo-keep-awake`, `expo-web-browser`, Jest + RNTL v14.

**Spec:** `docs/superpowers/specs/2026-10-13-phase-4a-customer-bookings-design.md` (rulings C1–C17). Contract: `docs/BACKEND_STATUS.md` §7 "My bookings" row and §9 "Customer 4a".

## Global Constraints

- **Code rules (hooks enforce):**
  - TypeScript strict + `noUncheckedIndexedAccess`.
  - No `any`, `@ts-ignore`, `console.log`, raw hex, `fontWeight` or animated layout props.
  - Tokens only.
- **Import boundaries:**
  - `src/features/customer/**` imports no other feature; routes in `src/app/` compose features.
  - `src/shared/**` imports no feature.
  - Domain files import no React or React Native.
- **Dates:** "Today" is `lagosToday(clock.serverNow())` (`@/shared/lib/lagosDay`), and live-code timing uses `clock.serverNow()`.
- **Reads:** explicit column lists. Never `users.*` (legacy `password` column), never `email` in booking lists, never `role`.
- **Profile writes:** send only `name, phone, state, address, updated_at`.
- **Notification writes:** always `.select('id')`. When rows were expected and none came back, refresh the session once and retry, then fail neutrally.
- **Live codes:** only the visible ticket polls. A 429 waits `Retry-After`. A transient failure never reads as a refusal or "not yours".
- **Guest data on disk:** none, except the encrypted wallet (C9). The wallet holds no email, phone or amounts, and is wiped on sign-out.
- **Packages:** install only with `npx expo install <pkg>`.
- **Copy and accessibility:** sentence case; status = word + colour; targets ≥ 44 pt; `customer` density.
- **Tests:** RNTL v14 is async. Test QueryClients use `{ retry: false, gcTime: Infinity }` and are cleared. Output must be clean: no act() warnings; use fake timers for FlatList batching as in the receptionist tests.
- **Before each commit:**
  - `npx tsc --noEmit`, `npx expo lint`, the touched tests and prettier must all pass.
  - Stage specific paths. Never stage `CLAUDE.md` or `.claude/skills/update-docs/`.
  - No co-author or "Generated with" trailers.

## Review Focus

1. **Lagos midnight:** an event at 23:30 Lagos is "today" until midnight Lagos, not UTC (Task 2 tests 23:30 UTC).
2. **Live-only event offline:** a ticket for an event with `require_dynamic_ticket` must never show the static QR. It says to connect instead (Task 3 + Task 9 tests).
3. **Admitted ticket:** a 409 with `checked_in_at` shows "Admitted at …" and stops polling (Task 3 + 9).
4. **Stale-session notification write:** mark-all-read that returns zero rows refreshes the session and retries once, then rolls back with a neutral message (Task 4 + 10).
5. **Hidden listing:** a booking whose listing embed is `null` still lists with the kind word and its dates, and its details open (Task 2 + 8).

---

### Task 1: QR, phone and brightness foundations (shared)

**Files:**

- Install: `npx expo install qrcode-generator expo-brightness`
- Create:
  - `src/shared/lib/qrMatrix.ts` + `src/shared/lib/__tests__/qrMatrix.test.ts`
  - `src/shared/ui/QrCode.tsx` + `src/shared/ui/__tests__/QrCode.test.tsx` (export from `src/shared/ui/index.ts`, alphabetical)
  - `src/shared/lib/phone.ts` + test
  - `src/shared/platform/brightness.ts`
  - `src/shared/platform/useBrightScreen.ts` + test (mock `expo-brightness`, `expo-keep-awake`)

**Produces:**

```ts
// qrMatrix.ts
export type QrPath = { size: number; d: string }; // size = module count (no quiet zone)
export function qrPath(text: string): QrPath; // level 'M', Byte mode, type number 0 (auto)

// QrCode.tsx
export function QrCode(p: {
  value: string;
  size: number;
  accessibilityLabel?: string;
  testID?: string;
}): JSX.Element;
// White square of `size` pt; Svg viewBox `-4 -4 ${n+8} ${n+8}` (4-module quiet zone), one Path
// (fill = ink token), shapeRendering "crispEdges"; d memoised on value. Default label "QR code".

// phone.ts
export type PhoneParse = { ok: true; e164: string } | { ok: false };
export function parseNigerianPhone(raw: string): PhoneParse;
export function formatNigerianPhone(e164: string): string; // '+2348031234567' → '0803 123 4567'
export const NIGERIAN_STATES: readonly string[]; // 36 states + 'FCT', alphabetical, 'Akwa Ibom', 'Cross River', 'FCT'

// brightness.ts — every call wrapped in try/catch, never throws.
export async function raiseBrightness(): Promise<() => Promise<void>>; // returns a restore fn
// Android: setBrightnessAsync(1), restore = restoreSystemBrightnessAsync()
// iOS: prev = getBrightnessAsync(); setBrightnessAsync(1); restore = setBrightnessAsync(prev)

// useBrightScreen.ts
export function useBrightScreen(active: boolean): void;
// While `active` and the app is active: keep awake (useKeepAwake-equivalent via activateKeepAwakeAsync/deactivateKeepAwake with a unique tag)
// and raised brightness; restore on inactive, unmount and AppState background; re-raise on foreground.
// Guard the async race: if cleanup runs before raise resolves, restore as soon as it resolves.
```

Phone rules (tests):

| Input                            | Result           |
| -------------------------------- | ---------------- |
| `0803 123 4567`                  | `+2348031234567` |
| `8031234567`                     | `+2348031234567` |
| `+234 803 123 4567`              | `+2348031234567` |
| `2348031234567`                  | `+2348031234567` |
| `07012345678`                    | `+2347012345678` |
| `0903-123-4567`                  | `+2349031234567` |
| `080312345` (too short)          | `{ ok:false }`   |
| `05031234567` (prefix not 7/8/9) | `{ ok:false }`   |
| `+44 7700 900123`                | `{ ok:false }`   |

Rule: strip spaces, dashes, dots and parentheses. Accept `+234`, `234` or a leading `0`, or a bare 10 digits. The national number must be 10 digits, starting with 7, 8 or 9.

qrMatrix tests:

- `qrPath('AB12CD34')` gives `size` 21 (version 1) and a `d` that starts with `M`. Calling it twice gives the same string.
- A 300-character string gives a larger size.
- An empty string still returns a valid path (the library accepts it), or throws a clear error. Pick the library's behaviour and pin it in the test.

QrCode test: renders an `Svg` and one `Path` whose `d` equals `qrPath(value).d`; the accessibility label is applied.

- [ ] Step 1: Install the two packages with `npx expo install`. Confirm `qrcode-generator` imports under jest-expo; if the default export needs interop, use `import qrcode from 'qrcode-generator'` with `esModuleInterop` as tsc allows.
- [ ] Step 2: Write the tests above (RED), then implement (GREEN).
- [ ] Step 3: tsc, lint, tests. Commit `feat(shared): QR codes, Nigerian phone numbers and a bright, awake screen for showing codes`.

### Task 2: Booking rows and "my bookings" (pure)

**Files:**

- Create:
  - `src/features/customer/schemas/bookings.ts` + test
  - `src/features/customer/domain/myBookings.ts` + test

**Schemas.** Use exactly these column constants:

```ts
export const EVENT_BOOKING_COLUMNS =
  'id, status, payment_status, booking_date, booking_time, guests, ticket_details, seat_assignments, created_at, listing:listing_id ( id, title, location, media_urls, event_date, event_time, require_dynamic_ticket ), tickets:event_tickets ( id, ticket_type, ticket_index, checked_in_at )';
export const HOTEL_BOOKING_COLUMNS =
  'id, check_in_date, check_out_date, adults, children, payment_status, booking_status, checked_in, checked_in_at, checked_out_at, check_in_code, created_at, hotel:hotel_id ( id, name, city, state, address, image_urls, check_in_time, check_out_time ), room_type:room_type_id ( id, name )';
export const APARTMENT_BOOKING_COLUMNS =
  'id, check_in_date, check_out_date, number_of_nights, number_of_guests, payment_status, booking_status, checked_in_at, checked_out_at, created_at, apartment:apartment_id ( id, name, city, state, area, address, image_urls, check_in_time, check_out_time )';
```

- Every embed is `.nullable()`.
- Enums per the contract:
  - event `status`: `pending|confirmed|completed|cancelled`
  - event `payment_status`: `pending|completed|failed|refunded`
  - hotel `booking_status`: `confirmed|checked_in|checked_out|cancelled` (nullable)
  - hotel `payment_status`: `pending|completed|refunded|failed`
  - apartment `booking_status`: `pending|confirmed|checked_in|checked_out|cancelled|no_show`
  - apartment `payment_status`: `pending|paid|failed|refunded|partially_refunded`
- `ticket_details`: `z.record(z.string(), z.number())` nullable.
- `seat_assignments`: `z.array(z.object({ seat: z.string().optional() }).loose())` nullable (or the zod v4 equivalent for passthrough).
- Dates: `YYYY-MM-DD` strings refined with `isIsoDate`.
- Times (`HH:MM` or `HH:MM:SS`): nullable strings.
- `media_urls` / `image_urls`: nullable string arrays.
- `hotels.check_in_time` / `check_out_time`: nullable; they exist (contract §4 Phase 3).
- Schema test: none of the constants contains `email`, `phone`, `total`, `amount` or `password`.

**Domain** `myBookings.ts`:

```ts
export type BookingKind = 'event' | 'hotel' | 'apartment';
export type ChipTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';
export type When = 'today' | 'upcoming' | 'past';
export type MyBooking = {
  kind: BookingKind;
  id: string;
  title: string | null; // null when the embed is hidden (C4)
  place: string | null; // event location / "City, State" / apartment area, city
  start: IsoDate;
  end: IsoDate; // event: same day
  time: string | null; // 'HH:MM' event time or hotel/apartment check-in time
  status: string;
  tone: ChipTone; // C5 words
  paid: boolean;
  pending: boolean; // pending = not paid and not cancelled
  when: When;
  next: string; // the "what's next" line
  imageUrl: string | null;
  createdAt: string;
};
export function fromEvent(row: EventBookingRow, today: IsoDate): MyBooking;
export function fromHotel(row: HotelBookingRow, today: IsoDate): MyBooking;
export function fromApartment(row: ApartmentBookingRow, today: IsoDate): MyBooking;
export function splitBookings(all: readonly MyBooking[]): {
  today: MyBooking[];
  upcoming: MyBooking[];
  past: MyBooking[];
};
export function kindWord(k: BookingKind): string; // 'Event' | 'Hotel stay' | 'Apartment stay'
export function clockLabel(hhmm: string | null): string | null; // '19:00' → '7:00 pm', '09:30:00' → '9:30 am', '12:00' → '12:00 pm', '00:15' → '12:15 am'
```

Rules (one test per row; `today = '2026-10-13'`):

| Case                                                              | Expect                                                                                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Event dates**                                                   | start = end = `listing.event_date ?? booking_date`; time = `listing.event_time ?? booking_time`                                            |
| Event, paid (`payment_status` completed), `confirmed`, date today | when `today`; status "Confirmed"/success; next "Today · 7:00 pm" (or "Today" without a time)                                               |
| Event confirmed, date 2026-10-18                                  | `upcoming`; next "Sun 18 Oct · 7:00 pm"                                                                                                    |
| Event `pending` + payment pending                                 | status "Pending payment"/warning; pending true; next "Finish paying on bookhushly.com"                                                     |
| Event `cancelled` (any date)                                      | `past`; status "Cancelled"/neutral; next "Cancelled"                                                                                       |
| Event `completed` or date before today                            | `past`; status "Completed"/neutral when completed, else keep the status word; next "Attended" when any ticket is checked in, else the date |
| Event listing null                                                | title null; place null; dates from `booking_date`/`booking_time`                                                                           |
| **Hotel paid**                                                    | `payment_status ∈ {completed, paid}`                                                                                                       |
| Hotel unpaid + `confirmed`                                        | "Pending payment"/warning, pending                                                                                                         |
| Hotel paid, in 2026-10-15 / out 2026-10-17                        | `upcoming`; "Confirmed"/success; next "Check-in Thu 15 Oct" (+ " from 2:00 pm" when the hotel has a check-in time)                         |
| Hotel paid, in = today                                            | `today`; next "Check-in today" (+ time)                                                                                                    |
| Hotel `checked_in`, out 2026-10-14                                | `today` (stay in progress counts as today); "Checked in"/info; next "Check-out Wed 14 Oct"                                                 |
| Hotel `checked_out`                                               | `past`; "Checked out"/neutral; next "Stayed 10–12 Oct" (`stayRange`)                                                                       |
| Hotel `cancelled`                                                 | `past`; "Cancelled"/neutral                                                                                                                |
| Hotel paid, out < today, still `confirmed` (no-show)              | `past`; status stays "Confirmed"; next `stayRange`                                                                                         |
| Hotel title                                                       | `hotel.name`; place "City, State" (skip nulls)                                                                                             |
| **Apartment paid**                                                | `payment_status ∈ {paid}`; `refunded`/`partially_refunded` → status "Refunded"/neutral                                                     |
| Apartment statuses                                                | `pending` → "Pending payment" when unpaid, else "Confirmed"; `no_show` → "No-show"/neutral (`past`); otherwise the same rules as hotel     |
| Apartment place                                                   | `area, city` (skip nulls)                                                                                                                  |
| **Sorting**                                                       | `splitBookings`: today sorted by start asc; upcoming by start asc then time; past by start **desc**. `createdAt` breaks ties.              |

- [ ] Step 1: Schemas + schema tests (RED → GREEN).
- [ ] Step 2: Domain tests from the table (RED), implement (GREEN). Use `shortDate`, `stayRange` and `daysBetween` from `@/shared/lib/lagosDay`.
- [ ] Step 3: Commit `feat(customer): booking rows and the merged my-bookings list`.

### Task 3: Tickets, live code, check-in code and notification targets (pure)

**Files:**

- Create `src/features/customer/domain/{tickets,liveCode,checkInCode,notificationTarget}.ts` + tests.
- Create `src/features/customer/schemas/{ticketCode,notifications,profile}.ts`.

**Produces:**

```ts
// tickets.ts
export type TicketView = {
  id: string;
  index: number;
  total: number;
  type: string;
  seat: string | null;
  admittedAt: string | null;
};
export function ticketsOf(row: EventBookingRow): TicketView[]; // sorted by ticket_index; seat from seat_assignments[index-1]?.seat
export function canShowTickets(row: EventBookingRow): 'show' | 'issuing' | 'none';
// 'show' when status confirmed + payment completed + tickets.length>0; 'issuing' when confirmed+paid and 0 tickets; else 'none'
export function staticTicketUrl(ticketId: string): string; // `https://bookhushly.com/t/${ticketId}` (env.apiBaseUrl + '/t/' + id)
export function liveOnly(row: EventBookingRow): boolean; // listing?.require_dynamic_ticket === true; null listing → true (safe: never show a static code we can't vouch for)

// liveCode.ts
export type LiveCodeState =
  | { kind: 'loading' }
  | { kind: 'live'; token: string; expiresAt: number }
  | { kind: 'admitted'; at: string | null }
  | { kind: 'notConfirmed' }
  | { kind: 'notYours' }
  | { kind: 'fallback' } // transient: network/timeout/5xx/503/validation
  | {
      kind: 'rateLimited';
      retryAfterSec: number | null;
      last: { token: string; expiresAt: number } | null;
    };
export function liveCodeFromResult(
  r: Result<TicketCodeBody, ApiError>,
  last: { token: string; expiresAt: number } | null,
): LiveCodeState;
export function nextRefreshMs(expiresAt: number, serverNow: number): number; // max(3000, expiresAt - serverNow - 2000)
export function stillUsable(expiresAt: number, serverNow: number): boolean; // serverNow < expiresAt + 30_000
export const REFRESH_AFTER_ERROR_MS = 15_000;

// checkInCode.ts
export function showCheckInCode(
  row: Pick<HotelBookingRow, 'payment_status' | 'booking_status' | 'check_in_code'>,
): boolean;
// paid (completed|paid) && booking_status not in (cancelled, checked_out) && code present
export function spacedCode(code: string): string; // 'AB12CD34' → 'AB12 CD34'

// notificationTarget.ts
export type NotificationTarget =
  | { kind: 'booking'; bookingKind: BookingKind; id: string }
  | { kind: 'tab'; tab: 'bookings' | 'account' }
  | null;
export function notificationTarget(
  n: NotificationRow,
  myBookings: readonly MyBooking[],
): NotificationTarget;
// data.bookingId (or data.booking_id) found in myBookings → booking target with that booking's kind;
// else link starting '/dashboard/customer' (any sub-path) → { tab:'bookings' };
// '/dashboard/customer/profile' or '/settings' paths → { tab:'account' }; anything else → null.
```

`liveCodeFromResult` table:

| Input                                                            | State                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------- |
| `ok({token, expires_at, …})`                                     | `live{token, expiresAt: expires_at}`                      |
| `conflict` with body `checked_in_at` (409 already used)          | `admitted{at}`                                            |
| `conflict` without `checked_in_at` (409 not confirmed)           | `notConfirmed`                                            |
| `forbidden` / `notFound`                                         | `notYours`                                                |
| `rateLimited{retryAfterSec}`                                     | `rateLimited{retryAfterSec ?? null, last}`                |
| `auth`                                                           | `fallback` (the session layer handles sign-in separately) |
| network / timeout / unavailable / validation / aborted / unknown | `fallback`                                                |

Note: the route has no `code`s, so 409 cases are told apart by `checked_in_at` in the body (`errorFromResponse` keeps `body` on `conflict`).

Schemas:

- `ticketCodeBody = z.object({ token: z.string().min(1), format: z.union([z.literal(1), z.literal(2)]), expires_at: z.number(), step_seconds: z.number(), ticket: z.object({ ticket_type: z.string(), ticket_index: z.number() }) })`.
- `NOTIFICATION_COLUMNS = 'id, type, title, message, data, link, read, created_at'`; row schema with `data` as `z.record(z.string(), z.unknown()).nullable()`.
- `PROFILE_COLUMNS = 'id, email, name, phone, state, address'`; `profileRow`.

- [ ] Step 1: Tests for every function and table row (RED), implement (GREEN).
- [ ] Step 2: Commit `feat(customer): ticket, live-code and check-in-code rules, and notification targets`.

### Task 4: Customer data access

**Files:**

- Create:
  - `src/features/customer/api/customerDb.ts`
  - `src/features/customer/api/ticketCodeApi.ts`
  - tests in `src/features/customer/api/__tests__/`

**Produces:**

```ts
export type CustomerDb = {
  events(userId: string): Promise<Result<EventBookingRow[], ApiError>>; // .eq('customer_id', id).order('created_at',{ascending:false}).limit(50)
  hotels(userId: string): Promise<Result<HotelBookingRow[], ApiError>>; // .eq('customer_id', id) … limit 50
  apartments(userId: string): Promise<Result<ApartmentBookingRow[], ApiError>>; // .eq('user_id', id) … limit 50
  event(userId: string, id: string): Promise<Result<EventBookingRow | null, ApiError>>; // + .eq('id', id).maybeSingle()
  hotel(userId: string, id: string): Promise<Result<HotelBookingRow | null, ApiError>>;
  apartment(userId: string, id: string): Promise<Result<ApartmentBookingRow | null, ApiError>>;
  notifications(userId: string): Promise<Result<NotificationRow[], ApiError>>; // order created_at desc, limit 60
  markRead(userId: string, ids: readonly string[]): Promise<Result<number, ApiError>>; // update({read:true}).eq('user_id').in('id', ids).select('id') → rows affected
  markAllRead(userId: string): Promise<Result<number, ApiError>>; // update({read:true}).eq('user_id').eq('read', false).select('id')
  markUnread(userId: string, ids: readonly string[]): Promise<Result<number, ApiError>>; // for Undo
  remove(userId: string, id: string): Promise<Result<number, ApiError>>; // delete().eq('id').eq('user_id').select('id')
  profile(userId: string): Promise<Result<ProfileRow | null, ApiError>>;
  saveProfile(
    userId: string,
    p: { name: string; phone: string | null; state: string | null; address: string | null },
  ): Promise<Result<number, ApiError>>;
  // update({ ...p, updated_at: new Date().toISOString() }).eq('id', userId).select('id')
};
export function createCustomerDb(client: SupabaseLike): CustomerDb;
export const customerDb: CustomerDb;

// Zero-row guard used by the hooks (pure, tested here):
export async function withSessionRetry(
  write: () => Promise<Result<number, ApiError>>,
  expected: number, // rows we expect to touch (0 → no guard)
  refresh: () => Promise<boolean>, // supabase.auth.refreshSession() succeeded
): Promise<Result<number, ApiError | { kind: 'staleSession' }>>;
// rows ≥ 1 or expected 0 → ok; rows 0 with expected > 0 → refresh → retry once → still 0 → err staleSession.

// ticketCodeApi.ts
export function fetchTicketCode(
  c: Requester,
  ticketId: string,
): Promise<Result<TicketCodeBody, ApiError>>;
// GET `/api/tickets/${encodeURIComponent(ticketId)}/code`, schema ticketCodeBody, timeoutMs 8000 (GET retries are the client's default; fine — idempotent)
```

- Use the same `SupabaseLike` + `select<string, unknown>` adapter pattern as `src/features/receptionist/api/deskDb.ts`; the TS2589 workaround is documented there. Use `wrap` and `dbErrorToApiError`, and zod-parse with failure → `validation`.
- `saveProfile` builds its update object from exactly those keys. The test asserts the object passed to `update` has exactly `name, phone, state, address, updated_at`.
- Tests:
  - Fake builders assert table, select constant, filters, `.select('id')` on writes, and that `.in('id', ids)` is used.
  - `withSessionRetry`: all four paths.
  - `fetchTicketCode`: path encoding, schema, and `idempotent` never set.

- [ ] Steps: RED → GREEN → commit `feat(customer): booking, notification and profile reads and writes, and the live ticket code`.

### Task 5: Offline wallet

**Files:** Create `src/features/customer/offline/wallet.ts` + test.

**Produces:**

```ts
export type WalletEntry = MyBooking & {
  tickets?: {
    id: string;
    index: number;
    total: number;
    type: string;
    seat: string | null;
    admittedAt: string | null;
  }[];
  liveOnly?: boolean; // events
  checkInCode?: string | null; // hotels, only when showCheckInCode() is true
};
export type Wallet = { userId: string; savedAt: number; entries: WalletEntry[] };
export function createWallet(deps: {
  store: {
    getItem(k: string): Promise<string | null>;
    setItem(k: string, v: string): Promise<void>;
    removeItem(k: string): Promise<void>;
  };
}): {
  save(userId: string, entries: WalletEntry[], now: number): Promise<void>; // keeps only today+upcoming entries, max 30
  load(userId: string): Promise<Wallet | null>; // null when missing, unparsable or another user's
  wipe(): Promise<void>;
};
export const wallet: ReturnType<typeof createWallet>;
// Default store: createEncryptedStore({ secure: secureKv, plain: plainKv, randomBytes, storageKey: 'bh.wallet' })
// (same pattern as src/shared/supabase/client.ts sessionStore). Register once at module load:
// registerSignOutGuard({ check: async () => ({ unsynced: 0, unsyncable: 0 }), syncNow: async () => {}, wipe: async () => { await wallet.wipe(); } });
```

- The JSON is validated with zod on load; bad JSON → `null`.
- `MyBooking` already has no email, phone or amounts. Test that a saved entry has none of those keys.
- **Check `createEncryptedStore`'s fresh-install wipe:** it deletes `deps.storageKey` on the first run. Read `src/shared/supabase/encryptedStore.ts`; if its `MARKER` logic is shared across stores (same `bh.installed` marker), make sure the wallet's store doesn't break the session store's wipe. If needed, give `createEncryptedStore` a marker parameter, or just let the wallet's store skip the fresh-install step: Keychain leftovers only matter for the key, and a missing cipher returns null. Record the choice in the report.
- Tests: save → load roundtrip (in-memory store); other user → null; past entries dropped; cap 30; wipe; the guard is registered (`wipeOnSignOut` calls it).

- [ ] Steps: RED → GREEN → commit `feat(customer): an encrypted offline wallet of upcoming bookings and tickets, wiped on sign-out`.

### Task 6: Customer hooks

**Files:** Create in `src/features/customer/hooks/`:

- `customerKeys.ts`
- `useMyBookings.ts`
- `useBooking.ts`
- `useLiveCode.ts`
- `useNotifications.ts` (list + unread count + markRead/markAllRead/undo/remove mutations)
- `useProfile.ts` (+ save)
- tests

**Produces:**

```ts
export const customerKeys = {
  all: (u: string) => ['customer', u] as const,
  bookings: (u: string) => ['customer', u, 'bookings'] as const,
  booking: (u: string, kind: BookingKind, id: string) => ['customer', u, 'booking', kind, id] as const,
  notifications: (u: string) => ['customer', u, 'notifications'] as const,
  profile: (u: string) => ['customer', u, 'profile'] as const,
};
export function useMyBookings(userId: string): {
  bookings: { today: MyBooking[]; upcoming: MyBooking[]; past: MyBooking[] } | null;
  rows: { events: EventBookingRow[]; hotels: HotelBookingRow[]; apartments: ApartmentBookingRow[] } | null;
  saved: { savedAt: number } | null;      // showing wallet data because the network load failed
  loading: boolean; error: boolean; refetch: () => Promise<unknown>;
};
// Fetch the three lists in parallel; on success map with today = lagosToday(clock.serverNow()), save the wallet (fire-and-forget, errors ignored);
// on failure with no data, load the wallet → `saved`. Any failed table fails the load (no partial lists).
export function useBooking(userId: string, kind: BookingKind, id: string): { row: …|null|undefined; fromWallet: WalletEntry | null; error: boolean; refetch };
export function useLiveCode(ticketId: string | null, active: boolean): LiveCodeState;
// Only when active && ticketId: fetch, then schedule the next fetch at nextRefreshMs (server clock); after `fallback`, retry every REFRESH_AFTER_ERROR_MS;
// rateLimited: wait retryAfterSec*1000 (default 15 s), keep showing `last` while stillUsable;
// admitted/notConfirmed/notYours: stop polling. Pause when the app is backgrounded; resume on foreground. Clear timers on change/unmount.
export function useNotifications(userId: string): { items: NotificationRow[]; unread: number; loading; error; refetch;
  open(n): void /* marks read optimistically */; markAllRead(): void; undoMarkAll(): void; remove(id): void;
  writeError: 'stale' | 'transient' | null; clearWriteError(): void };
// Writes go through withSessionRetry(refresh = supabase.auth.refreshSession → !!data.session); optimistic update + rollback on error.
// List refetches on focus and every 60 s while focused (useIsFocused from expo-router).
export function useProfile(userId: string): { profile: ProfileRow | null; loading; error; refetch };
export function useSaveProfile(userId: string): { save(p): Promise<'ok' | 'stale' | 'transient'>; saving: boolean };
// after a DB save: supabase.auth.updateUser({ data: { name } }) (ignore its failure: the users row is the source the app reads).
```

- Tests:
  - `useMyBookings`: success path saves the wallet; failure with a wallet → `saved`; failure with no wallet → error.
  - `useLiveCode` (fake timers): schedules at `expires_at - 2 s` against a mocked server clock; admitted stops; a 429 keeps the last token until `stillUsable` is false; `fallback` retries after 15 s; inactive doesn't poll.
  - `useNotifications`: mark all read with zero rows → refresh → retry → stale → rollback; undo calls `markUnread`.
  - `useSaveProfile`: only the four fields.
- Mock `@/shared/api/instance` (clock, api) and `@/shared/supabase/client` as other hook tests do.

- [ ] Steps: RED → GREEN → commit `feat(customer): hooks for bookings, live codes, notifications and the profile`.

### Task 7: Customer routes, tabs and account shell

**Files:**

- Routes:
  - Create `src/app/(customer)/(tabs)/_layout.tsx` (Tabs: `bookings` "Bookings" `Ticket` icon, `account` "Account" `UserRound`; same token styling as the receptionist tabs, including the active-tab background; bottom bar only).
  - Create placeholders `(tabs)/bookings.tsx` and `(tabs)/account.tsx` (filled in later tasks).
  - Create `my-booking/[kind]/[id].tsx`, `tickets/[bookingId].tsx`, `check-in-code/[bookingId].tsx`, `notifications.tsx` (placeholders with EmptyState until their tasks).
  - Rewrite `src/app/(customer)/_layout.tsx`: Stack with `unstable_settings = { initialRouteName: '(tabs)' }`; the `tickets` and `check-in-code` screens use `presentation: 'fullScreenModal'`; keep `DensityProvider density="customer"`. When the `(customer)` layout unmounts, remove `['customer']` queries (mirrors `useDeskSession`).
- Delete `src/app/(customer)/home.tsx` and `src/features/customer/screens/CustomerShell.tsx` (+ tests). Keep `TourScreen` and `useTourSeen`: the tour gate moves into the tabs layout and stays off (`CUSTOMER_TOUR_ENABLED`).
- `src/features/mode/hooks/useRouteStore.ts`: `customer: '/bookings'`. Update the mode/app routing tests.
- Validate route params: `kind` ∈ `event|hotel|apartment`; ids are UUIDs (`z.uuid()`). Invalid params → `EmptyState` "This booking isn't on your account".

- [ ] Steps: implement, update tests, typed routes pass. Commit `feat(customer): bookings and account tabs replace the placeholder home`.

### Task 8: Bookings tab and booking details

**Files:**

- Create in `src/features/customer/ui/`:
  - `BookingRow.tsx`: date tile (weekday + day number, like the gate event tiles; reuse the gate's tile styling by copying into `shared/ui/DateTile.tsx` if it isn't already shared; check `src/features/gate/screens/EventListScreen.tsx`), title (or kind word when null), kind word + `next`, status chip, optional 56 pt thumbnail via `expo-image` when `imageUrl`.
  - `TodayCard.tsx`: card variant for `when === 'today'` with the main action: **Show tickets** for events that can show tickets, **Show check-in code** for hotels when allowed, else Open.
  - `chipTone.ts`: maps `ChipTone` to `StatusTone`.
  - `DetailRows.tsx`: label/value rows.
- Create in `src/features/customer/screens/`: `BookingsScreen.tsx`, `BookingScreen.tsx`.
- Wire `(tabs)/bookings.tsx` and `my-booking/[kind]/[id].tsx`.

**BookingsScreen** (spec §3, C3, C16, C17):

- Header "Bookings" + bell `IconButton` (`Bell`, label "Notifications, N unread" or "Notifications") with a small count badge, which opens `/notifications`.
- Today cards; `SegmentedControl` "Upcoming (n) · Past (n)"; FlatList of `BookingRow` (fake timers in tests; `windowSize` 7).
- Saved-data `Banner` (neutral): "Showing saved bookings — last updated 10:42. Pull to refresh."
- Empty states:
  - Upcoming empty, past has some: "No upcoming bookings".
  - Both empty: C16 with **Browse on bookhushly.com** (`WebBrowser.openBrowserAsync('https://bookhushly.com')`).
- `ErrorState` when there is no data and no wallet. Pull to refresh.

**BookingScreen** (C12): header with back.

- **Event:** title, "Sun 18 Oct · 7:00 pm", venue row (opens Maps with `Linking.openURL` to `https://maps.google.com/?q=<encoded venue>` on Android or `http://maps.apple.com/?q=` on iOS), packages from `ticket_details` ("2 × VIP, 1 × Regular"), tickets list (rows "Ticket 1 · VIP · Valid" / "Admitted 7:42 pm" / seat). Footer primary **Show tickets** (`canShowTickets === 'show'`), or a neutral "Your tickets are being issued — pull to refresh" banner (`issuing`).
- **Hotel:** name, address → Maps, Check-in "Wed 15 Oct · from 2:00 pm", Check-out "Fri 17 Oct · by 12:00 pm", Room type, Guests "2 adults, 1 child", Payment "Paid"/"Not paid". Footer **Show check-in code** when `showCheckInCode`.
- **Apartment:** name, "Area, City", address → Maps, dates + nights, check-in/out times, guests, payment.
- **All kinds:**
  - Pending → info banner "Finish paying on bookhushly.com" with the action **Open bookhushly.com** (in-app browser to `https://bookhushly.com/dashboard/customer`).
  - Footer note "To change or cancel, use bookhushly.com".
  - Hidden listing → title = kind word, plus the line "Details aren't available right now".
  - Offline → falls back to the wallet entry (dates, tickets, check-in code) with the saved-data banner.

- [ ] Steps: RNTL tests: segments and counts, Today card actions, empty states (both), saved banner, error state, row press navigation; detail per kind incl. hidden listing, pending banner, issuing, maps link. Implement. Commit `feat(customer): my bookings and booking details`.

### Task 9: Ticket viewer and check-in code

**Files:**

- Create in `src/features/customer/screens/`: `TicketsScreen.tsx`, `CheckInCodeScreen.tsx`.
- Create in `src/features/customer/ui/`: `TicketCard.tsx`, `CountdownRing.tsx` (react-native-svg circle, decorative, static under Reduce Motion), `LiveClock.tsx` (hh:mm:ss, ticks each second from the server clock, `accessibilityElementsHidden` on the ticking part).
- Wire `tickets/[bookingId].tsx` (`index` param) and `check-in-code/[bookingId].tsx`.

**TicketsScreen** (C7, C8, C11):

- White full-screen; close `IconButton` top-left; title + date line.
- Horizontal paging `FlatList` (`pagingEnabled`, `getItemLayout` with window width) of `TicketCard`; dots + "Ticket 2 of 3".
- Only the visible ticket's `useLiveCode(id, active)` is active; the others are inactive.
- `useBrightScreen(true)` while focused.
- `TicketCard` by state:

  | State                              | Shows                                                                                                                      |
  | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
  | `live`                             | `QrCode` (width − 2 × gutter, max 360) + "Live code · refreshes every 30 s" + `CountdownRing` to `expiresAt` + `LiveClock` |
  | `rateLimited` with a usable `last` | `last`'s QR, "Refreshing shortly"                                                                                          |
  | `fallback` and not `liveOnly`      | static QR of `staticTicketUrl(id)` + neutral note "Offline code — it works at the door"                                    |
  | `fallback` and `liveOnly`          | no QR; `Banner` neutral "Connect to the internet to show this ticket. This event only accepts live codes." + **Try again** |
  | `admitted`                         | success tone "Admitted at 7:42 pm" (`lagosTime`), no QR, polling stopped                                                   |
  | `notConfirmed`                     | "This booking isn't confirmed yet"                                                                                         |
  | `notYours`                         | "This ticket isn't on your account"                                                                                        |
  | `loading`                          | skeleton square                                                                                                            |

- Under the QR: "Ada Obi" is **not available** (bookings have contact names, which we don't select), so show the type, "Ticket 2 of 3" and the seat when present.
- The code text under the QR: for live codes show nothing (a token is long); for static codes show the ticket id's first 8 characters upper-cased as a reference.
- Offline open (no network): tickets come from the wallet entry via `useBooking`.

**CheckInCodeScreen** (C10):

- White full-screen; hotel name; `QrCode` of the raw code (max size); the code in `display` tabular text via `spacedCode`, selectable; dates line; "Show this at the front desk".
- When checked in: a success chip "Checked in".
- `useBrightScreen(true)`.
- Not allowed (`showCheckInCode` false) → `EmptyState` "No check-in code for this booking".
- Offline → from the wallet.

- [ ] Steps: RNTL tests:
  - only the visible ticket polls (swipe → the active id changes);
  - live / fallback (both `liveOnly` branches) / admitted / rate-limited-with-last;
  - check-in code gating;
  - brightness hook called.

  Implement. Commit `feat(customer): live tickets and the hotel check-in code`.

### Task 10: Notifications

**Files:**

- Create `src/features/customer/screens/NotificationsScreen.tsx` and `src/features/customer/ui/NotificationRow.tsx`.
- Wire `notifications.tsx`.

**Content (C13):**

- Header "Notifications" with back; right **Mark all as read** (`TextLink`, disabled when unread is 0).
- FlatList rows:
  - type icon in a circle: booking types `CalendarCheck`, payment types `CreditCard`, cancelled `CalendarX`, system/other `Bell`;
  - title (bold when unread), message (2 lines), relative time ("5 min ago", "Yesterday", or `shortDate`);
  - unread dot with accessibility "Unread".
- Tap a row → mark read, then navigate by `notificationTarget`: a booking target opens `/my-booking/[kind]/[id]`; a tab target goes to that tab; `null` does nothing beyond marking read.
- Long-press opens a `Sheet` with **Mark as unread**, **Delete**.
- After Mark all, show a neutral `Banner` "All marked as read" with **Undo**, for 5 s.
- Write errors:
  - stale → Banner "Couldn't update. Sign in again if this keeps happening.";
  - transient → "Couldn't update — try again".
- Empty → EmptyState "No notifications yet". Pull to refresh.

- [ ] Steps: RNTL tests:
  - unread styling and dot;
  - tap marks read and navigates (booking hit, tab, null);
  - mark all + undo;
  - stale rollback;
  - delete;
  - empty.

  Implement. Commit `feat(customer): notifications`.

### Task 11: Account tab

**Files:**

- Create in `src/features/customer/screens/`: `AccountScreen.tsx`, `ProfileFieldSheet.tsx` (one sheet, field-specific body).
- Wire `(tabs)/account.tsx`. The route passes `modeSwitcher`, `onSignOut`, `onDeleteAccount` (`router.push('/delete-account')`).

**Content (C14):**

- Header block: initials avatar (circle, `selectedWash` fill, violet-700 initials; derive from the name, fall back to the email's first letter), name and email.
- `modeSwitcher` slot.
- Section **Your details**: rows Name / Phone (`formatNigerianPhone`, or "Add") / State (or "Add") / Address (or "Add"). Each opens `ProfileFieldSheet`:
  - Name: `Input`, required, 2–80 chars.
  - Phone: `Input` `keyboardType="phone-pad"`, validated on blur with `parseNigerianPhone`; error "Enter a Nigerian number, like 0803 123 4567"; an empty value clears the phone.
  - State: a list of `NIGERIAN_STATES` with radio rows (`ListRow` `checked`) and a search field.
  - Address: multiline `Input`, max 200.
  - Footer **Save** (loading state).
  - Results: transient → neutral banner, input kept; stale → "Please sign in again" banner.
- Section **Help and legal**: Help (`https://bookhushly.com/help`), Terms (`/terms`), Privacy (`/privacy`), each opened in the in-app browser. Reuse the URLs already used by `TermsLine` in `features/auth/components/TermsLine.tsx` by reading that file; copy the constants into `shared/config`, since features can't import auth.
- Then **Sign out** (secondary button) and the **Delete account** `TextLink`.
- App version (`APP_VERSION` from `@/shared/api/instance`) in muted text.

- [ ] Steps: RNTL tests:
  - each row shows its value or "Add";
  - phone validation and E.164 save;
  - state picker;
  - name required;
  - save calls `useSaveProfile` with only four fields;
  - sign-out and delete callbacks;
  - the mode switcher slot renders.

  Implement. Commit `feat(customer): account tab with editable details`.

### Task 12: Requirement notes and phone checklist

**Files:**

- Modify `docs/MOBILE_APP_REQUIREMENTS.md` FR-2.7, FR-2.10, FR-2.15, FR-2.23 with short notes ("_4a 2026-10-13: …_"):
  - live code per visible ticket;
  - static fallback only when the event allows it;
  - in-app notification centre only;
  - profile fields without change-password or preferences;
  - guest bookings pending REQ-11.
- Create `docs/device-tests/2026-10-13-phone-checks-phase-4a-customer.md`, in the same style as the Phase 3 checklist:
  - Before you start: QA customer with a real paid event ticket (one live-only event if possible) and a paid hotel booking.
  - Parts: Bookings list; Ticket (live refresh, airplane-mode fallback for both event types, admitted after a gate scan with a second phone); Check-in code (scan it with the receptionist account); Notifications (mark read, undo, delete); Account (edit each field; sign out wipes the saved tickets: sign back in offline and they're gone); Comfort (largest text, TalkBack, brightness).
  - Clean-up.
- [ ] Step 1: Write, prettier, commit `docs(phase-4a): requirement notes and the customer phone checklist`.
