# Browse without an account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-out person use Explore, search, results, listings and Select, and ask for an account only at save or at Continue, returning them to the same screen with their selection intact.

**Architecture:** A stored "browsing" choice makes `resolveRoute` return `customer` for a signed-out person, and also while a browsing person's mode is loading after sign-in. The `(customer)` guard therefore never drops, so the stack, and Select's local state, stay mounted. Auth screens are pushed on top and removed by their guard the moment a session exists, which is what returns the person. Nothing about the selection needs saving anywhere.

**Tech Stack:** Expo Router 57 `Stack.Protected`, zustand, TanStack Query, `plainKv`.

**Spec:** `docs/superpowers/specs/2026-11-03-browse-without-account-design.md`

## Global Constraints

- Booking and paying require an account. No booking create may run without a session (`createEvent` would return 201 with `customer_id: null`).
- `recovery` keeps priority over browsing. Update gate keeps priority over everything.
- Sheet copy: titles "Sign in to book" and "Sign in to save"; book body "We keep your booking and tickets in your account. Your dates and room stay as you chose them."; buttons "Create account", "Sign in", "Not now". Welcome link: "Browse without an account".
- Never render a transient failure as a business refusal. Never show "sign in again" to someone who was never signed in.
- Routes only in `src/app/`. Features can't import each other; route files may import both. No raw hex, `fontWeight`, `any`, `console.log`. Domain code imports no React.
- No new native dependencies, so no new build.
- Web is read-only. Commits: specific paths, no co-author trailer, leave the owner's `CLAUDE.md` Commands edit and `.claude/skills/update-docs/` out.
- Before done: `npx tsc --noEmit`, `npx expo lint`, `npx jest` all pass.

## Review Focus

- Sign-in fails, or the person backs out of the auth screens: they're back browsing with the selection kept and any pending save dropped (test in Task 4).
- A gate, receptionist or web-only account signs in from the sheet: they reach their own mode and the pending save never runs (test in Task 4).
- A password reset started from the sheet: recovery takes over the stack, and after the new password they land on Explore without a crash; the selection is lost, which is acceptable (test in Task 2, device check in Task 7).
- The signed-out person pulls to refresh on Explore or returns to the foreground: no booking, profile or notification read goes out with an empty user id (test in Task 3).
- The profile read fails after signing in on Select: the contact fields appear empty and editable, the selection is kept, and Continue validates them (test in Task 5).

---

### Task 1: Record backend gaps and replaced decisions

**Files:**
- Modify: `docs/BACKEND_STATUS.md`, `docs/MOBILE_APP_REQUIREMENTS.md:457`, `docs/superpowers/specs/2026-10-08-ui-b-entry-accounts-design.md:13`, `docs/superpowers/specs/2026-10-21-phase-4c-checkout-design.md:30`, `.claude/rules/payments-customer.md`

- [ ] **Step 1: Create the branch.** `git switch -c feat/browse-without-account` from `feat/phase-4c-web-fixes`.
- [ ] **Step 2: Add to `BACKEND_STATUS.md` §9**, marked unverified live, the items under the spec's "Backend gaps to record first". Update the header note: browse and guest paths re-checked 2026-11-02 against web `origin/main` @ `8b4cbaaf`, code only.
- [ ] **Step 3: Mark the old decisions.** One line at each: "Replaced 2026-11-03 by `2026-11-03-browse-without-account-design.md`." For FR-2.5 and the rule: mobile requires an account at booking for now; the web allows guests.
- [ ] **Step 4: Commit** with the spec and this plan. Message: `docs: browse without an account design; record backend gaps`.

### Task 2: Browsing as a route

**Files:**
- Create: `src/features/mode/hooks/useBrowseChoice.ts`
- Modify: `src/features/mode/domain/route.ts`, `src/app/_layout.tsx:48-99`, `src/app/(auth)/welcome.tsx`, `src/features/auth/screens/WelcomeScreen.tsx`
- Test: `src/features/mode/domain/__tests__/route.test.ts`, `src/features/mode/hooks/__tests__/useBrowseChoice.test.ts`, `src/features/auth/screens/__tests__/WelcomeScreen.test.tsx`

**Interfaces:**
- Produces: `resolveRoute` input `browsing: boolean | null` (`null` means not read yet); `authScreensAllowed(route: AppRoute, auth: AuthKind): boolean`; `useBrowseChoice` store `{ browsing: boolean | null; load(): Promise<void>; choose(): void; clear(): void }`, stored at key `bh.browse` in `plainKv`; `WelcomeScreen` prop `onBrowse: () => void`.

- [ ] **Step 1: Write the failing tests.** Add `browsing: false` to existing `resolveRoute` inputs, then:

```ts
const base = { versionOk: true, chosenMode: null, recovery: false };
it('browsing keeps a signed-out person in customer', () => {
  expect(resolveRoute({ ...base, auth: 'signedOut', mode: { status: 'idle' }, browsing: true })).toBe('customer');
});
it('waits for the stored choice before showing Welcome', () => {
  expect(resolveRoute({ ...base, auth: 'signedOut', mode: { status: 'idle' }, browsing: null })).toBe('loading');
});
it('holds customer while a browsing mode loads, so the stack survives sign-in', () => {
  expect(resolveRoute({ ...base, auth: 'signedIn', mode: { status: 'loading' }, browsing: true })).toBe('customer');
  expect(resolveRoute({ ...base, auth: 'signedIn', mode: { status: 'loading' }, browsing: false })).toBe('loading');
});
it('a staff mode wins once known, even while browsing', () => {
  expect(resolveRoute({ ...base, auth: 'signedIn', mode: single, browsing: true })).toBe('gate');
});
it('recovery wins over browsing', () => {
  expect(resolveRoute({ ...base, recovery: true, auth: 'signedIn', mode: { status: 'idle' }, browsing: true })).toBe('auth');
});
it('auth screens open over browsing only while signed out', () => {
  expect(authScreensAllowed('customer', 'signedOut')).toBe(true);
  expect(authScreensAllowed('customer', 'signedIn')).toBe(false);
  expect(authScreensAllowed('auth', 'signedOut')).toBe(true);
});
```

Store: `load` reads `bh.browse`, and a read failure gives `false`; `choose` sets `true` and writes `'1'`; `clear` sets `false` and deletes the key. Welcome: `calls onBrowse from Browse without an account`, with role link.

- [ ] **Step 2: Run them to confirm they fail.** Run: `npx jest src/features/mode src/features/auth/screens/__tests__/WelcomeScreen`. Expected: FAIL.

- [ ] **Step 3: Implement.** In `resolveRoute`: after the `loading` check, `signedOut` returns `'loading'` for `null`, `'customer'` for `true`, else `'auth'`; in the mode switch, `idle` and `loading` return `i.browsing === true ? 'customer' : 'loading'`. In `Navigator`: call `load` once; pass `browsing`; use `authScreensAllowed(route, auth.status)` as the `(auth)` guard; add an effect that calls `clear()` once `auth.status === 'signedIn' && mode.status === 'ready'`. Declare `(auth)` after `(customer)` so it stacks on top. Welcome gets an underlined white `TextLink` (`tone="onInverse"`) under "Sign in". `welcome.tsx`: `onBrowse` calls `choose()`, and an effect does `router.replace('/explore')` when `useRouteStore` route becomes `customer`.

- [ ] **Step 4: Verify.** Run: `npx tsc --noEmit && npx jest src/features/mode src/features/auth`. Expected: pass.

- [ ] **Step 5: Commit.** Message: `feat(mode): browsing as a route for signed-out people`.

### Task 3: Hooks that need a user stay quiet when signed out

**Files:**
- Modify: `src/features/customer/hooks/{useMyBookings,useProfile,useUnreadCount,useNotifications,useBooking}.ts`, `src/features/customer/screens/ExploreScreen.tsx`
- Test: the matching files in `src/features/customer/hooks/__tests__/`, `src/features/customer/screens/__tests__/ExploreScreen.test.tsx`

**Interfaces:**
- Produces: all five hooks accept `userId === ''`: no read, `loading: false`, empty data, and `refetch` that does nothing.

- [ ] **Step 1: Write the failing tests.** For each hook, `reads nothing with no user`: the mocked `customerDb` call has `not.toHaveBeenCalled()` and `loading` is `false`. In `ExploreScreen.test.tsx`: `signed out: shows listings, no Today banner, and pull to refresh reads no bookings or profile`, with `userId=""`, firing the `RefreshControl`'s `onRefresh`, and asserting `customerDb.events` and `customerDb.profile` were not called while `fetchListings` was.

- [ ] **Step 2: Run them to confirm they fail.** Run: `npx jest src/features/customer/hooks src/features/customer/screens/__tests__/ExploreScreen`. Expected: FAIL.

- [ ] **Step 3: Implement.** Add `enabled: userId !== ''` to each query. A disabled query's explicit `refetch` still runs, so each hook returns a no-op `refetch` for `''`. Check `useFocusRefetch` and `useSavedWallet` don't fire for `''`: gate `useSavedWallet` on `userId !== ''` too, and leave `useLoadFailed` returning `false`.

- [ ] **Step 4: Verify and commit.** Run: `npx tsc --noEmit && npx jest src/features/customer`. Expected: pass. Message: `feat(customer): account hooks stay quiet when signed out`.

### Task 4: The sign-in sheet, and save

**Files:**
- Create: `src/features/customer/hooks/useSignInPrompt.ts`, `src/features/customer/ui/SignInPromptSheet.tsx`
- Modify: `src/features/customer/hooks/useSaved.ts:161-167`, `src/app/(customer)/_layout.tsx`, `src/app/(auth)/_layout.tsx`, `src/app/_layout.tsx`
- Test: `src/features/customer/hooks/__tests__/useSignInPrompt.test.tsx`, `src/features/customer/ui/__tests__/SignInPromptSheet.test.tsx`, `src/features/customer/hooks/__tests__/useSaved.test.tsx`

**Interfaces:**
- Produces: store `useSignInPrompt` `{ reason: 'book' | 'save' | null; pendingSave: SavedInput | null; ask(reason: 'book' | 'save', save?: SavedInput): void; dismiss(): void; clearPending(): void }`; `<SignInPromptSheet onCreateAccount={() => void} onSignIn={() => void} />`; hook `useCompletePendingSave(userId: string): void`. `dismiss` closes the sheet and clears `pendingSave`; pressing Create account or Sign in closes the sheet but keeps it.

- [ ] **Step 1: Write the failing tests.**
  - Sheet: `shows the book copy`, `shows the save copy`, `Not now closes and forgets the pending save`, `Sign in closes, keeps the pending save, and calls onSignIn`.
  - `useSaved`: `toggle with no user asks to sign in and writes nothing`: `ask` called with `'save'` and the item, `savedDb` write not called, returns `'ok'`.
  - `useCompletePendingSave`: `saves the pending item once a user appears, once only`, and `does nothing without a pending item`.
  - Layout rules as a small exported function `shouldDropPending(route: AppRoute, auth: AuthKind): boolean` in `useSignInPrompt.ts`: `true` for a staff or webOnly route once signed in, `false` for `customer`.
  - Backing out: `clears the pending save when the auth screens close while still signed out`, by rendering `(auth)/_layout`, unmounting with auth `signedOut`, and asserting `pendingSave` is `null`; unmounting with `signedIn` keeps it.

- [ ] **Step 2: Run them to confirm they fail.** Run: `npx jest useSignInPrompt SignInPromptSheet useSaved`. Expected: FAIL.

- [ ] **Step 3: Implement.** The sheet uses shared `Sheet`, with `Button` for "Create account", secondary `Button` for "Sign in", `TextLink` for "Not now". Save body: "We'll save this to your account as soon as you've signed in." Navigate after the modal closes: on iOS through `onDismissed`, on Android straight away, since two modals can't overlap on iOS. `(customer)/_layout.tsx` renders the sheet with `router.push('/sign-up')` and `router.push('/sign-in')`, and calls `useCompletePendingSave`. `toggle` asks when `userId === ''`. `useCompletePendingSave` writes through `useSaved(userId).toggle` once, then clears. `(auth)/_layout.tsx` clears on unmount while signed out. `Navigator` clears when `shouldDropPending` is true.

- [ ] **Step 4: Verify and commit.** Run: `npx tsc --noEmit && npx jest src/features/customer src/features/mode`. Expected: pass. Message: `feat(customer): sign-in sheet at save, completing after sign-in`.

### Task 5: Select works signed out

**Files:**
- Create: `src/features/customer/hooks/useRecheckPromoOnSignIn.ts`
- Modify: `src/features/customer/domain/checkout/selection.ts`, `src/features/customer/screens/SelectScreen.tsx:37-55`, `src/features/customer/ui/checkout/StaySelect.tsx`, `src/features/customer/ui/checkout/EventSelect.tsx`, `src/features/customer/hooks/useCreateBooking.ts:334`
- Test: `src/features/customer/domain/checkout/__tests__/selection.test.ts`, `src/features/customer/screens/__tests__/SelectScreen.test.tsx`, `src/features/customer/hooks/__tests__/useCreateBooking.test.tsx`

**Interfaces:**
- Consumes: `useSignInPrompt.ask('book')`.
- Produces: `withoutContactProblems<P>(problems: P[]): P[]`, dropping `'guestName' | 'guestEmail' | 'guestPhone'`; `StaySelect` and `EventSelect` prop `guestReady: boolean`.

- [ ] **Step 1: Write the failing tests.**
  - Domain: `withoutContactProblems(['dates', 'guestName', 'guestPhone'])` equals `['dates']`.
  - `useCreateBooking`: `submit with no user sends nothing`; `createEvent`, `createHotel` and `createApartment` mocks not called, and state stays idle.
  - `SelectScreen`, one per kind where the setup exists:
    - `signed out: hides the contact fields and shows the total`
    - `signed out: Continue with dates missing shows the dates problem, not the sheet`
    - `signed out: valid Continue asks to sign in and creates nothing`
    - `keeps the selection when a user appears`: rerender with `userId="u1"` while the profile is pending; the chosen date or quantity is still shown and no skeleton appears
    - `fills contact fields from the profile after sign-in`
    - `profile read failure after sign-in: fields empty and editable, selection kept`
    - `already signed in: skeleton then form, as today`
    - `rechecks an applied promo once when a user appears`

- [ ] **Step 2: Run them to confirm they fail.** Run: `npx jest selection SelectScreen useCreateBooking`. Expected: FAIL.

- [ ] **Step 3: Implement.** In `SelectScreen`, `const [startedSignedOut] = useState(userId === '')`. Show the skeleton for `profile.loading` only when `!startedSignedOut`, because replacing the form would unmount it and lose the selection. `guestReady = userId !== '' && !profile.loading`. In both selects, when `guestReady` goes from false to true, set `sel.guest` from the `guest` prop once. Render `GuestFields` only when `guestReady`. `onContinue`: with `userId === ''`, use `withoutContactProblems(problems)`; if none, `ask('book')` and return. Signed in but `!guestReady`: Continue is disabled. `useCreateBooking.submit` returns at once when `userId === ''`, as the hard guard. `useRecheckPromoOnSignIn(userId, promo, amount)` re-applies the applied code once when `userId` goes from `''` to a value.

- [ ] **Step 4: Verify and commit.** Run: `npx tsc --noEmit && npx jest src/features/customer`. Expected: pass. Message: `feat(customer): Select works signed out and asks at Continue`.

### Task 6: Saved, Bookings and Account when signed out

**Files:**
- Create: `src/features/customer/ui/SignedOutTab.tsx`
- Modify: `src/app/(customer)/(tabs)/{saved,bookings,account}.tsx`
- Test: `src/features/customer/ui/__tests__/SignedOutTab.test.tsx`

**Interfaces:**
- Produces: `<SignedOutTab tab="saved" | "bookings" | "account" onSignIn={() => void} onCreateAccount={() => void} />`. Route files render it when signed out, so the screens' account hooks never mount. The route files call `router.push('/sign-in')` and `router.push('/sign-up')`.

- [ ] **Step 1: Write the failing tests.** `bookings copy mentions adding website bookings`, asserting "Your bookings live here" and "Booked on the website with this email? We'll help you add them."; `saved and account show their own heading`; `Sign in and Create account call their handlers`.
- [ ] **Step 2: Run them to confirm they fail.** Run: `npx jest SignedOutTab`. Expected: FAIL.
- [ ] **Step 3: Implement.** Follow `EmptyState`'s layout. Account also keeps the help and legal links if `AccountScreen` has them, by rendering them from the same config. The bell lives in `BookingsScreen`, which no longer mounts signed out, so it needs no change.
- [ ] **Step 4: Verify and commit.** Run: `npx tsc --noEmit && npx jest src/features/customer`. Expected: pass. Message: `feat(customer): signed-out Saved, Bookings and Account`.

### Task 7: Docs, reviews and the real run

**Files:**
- Modify: `CLAUDE.md`, `docs/DESIGN_SYSTEM.md`, `.claude/rules/routing.md`

- [ ] **Step 1: Update the docs** with signed-out browsing: how the route works, and that a browsing person's `(customer)` guard holds through sign-in. Stage only these lines of `CLAUDE.md`, not the owner's Commands edit.
- [ ] **Step 2: Full gate.** Run `/verify`. Expected: typecheck, lint, tests and doctor pass.
- [ ] **Step 3: Reviews.** Dispatch `rn-code-reviewer`, `mobile-security-reviewer` (routing, session, unowned bookings), `ux-design-reviewer`. Fix real findings.
- [ ] **Step 4: Run it signed out on the iOS simulator against production reads.** No booking is created and no test data left behind. Confirm:
  - The Welcome link reaches real listings; relaunching keeps browsing.
  - The listing, Select and total load with no session.
  - **The stack question this design depends on:** the owner signs in from Select's sheet on a device, with their own account, because this session doesn't enter credentials or create accounts on production. Confirm Select is still there with its selection. **If the stack doesn't survive, stop and report to the owner.** This has no unit test, because the navigator is real only on a device.
  - Backing out of sign-in returns to Select.
  - Android through the existing dev client, or a new build link for the owner.
- [ ] **Step 5: Commit the docs.** Message: `docs: signed-out browsing`.
