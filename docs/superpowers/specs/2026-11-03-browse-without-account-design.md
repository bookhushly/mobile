# Browse without an account: design

Date: 2026-11-03. Mockups (throwaway, gitignored): `.superpowers/brainstorm/`, newest session folder, `browse-flow.html`; note its sheet is shown over a listing, but it now opens on Select.

## Why

A new marketplace asking for an account before showing one listing gives people a reason to leave. A critique raised this and the owner agreed. The web already lets anyone browse and book with no account, so the app is currently stricter than the site.

**Success:** a signed-out person opens the app, sees real listings within one tap, and only meets sign-in when they try to save, book or use something account-only. If they sign in from there, they land back where they were with their selection intact.

## Goals

1. A signed-out person can use Explore, search, results, listing details and the Select screen, up to seeing the full price.
2. Save asks for an account at the tap. Book asks at Continue on the Select screen. Both use a sheet over the current screen.
3. After signing in or creating an account (including the email code step), the person returns to the same screen with the selection kept, and a pending save completes.
4. Saved, Bookings and Account explain themselves and offer sign-in when signed out.

## Non-goals

- Guest checkout. Booking and paying require an account for now (owner's decision, 2026-11-02). It may return later if drop-off shows it's needed; it needs web work first: no JSON hotel guest route, multipart-only apartment guest create, guest payments confirmable only through `/payment/verify`, and no live ticket codes for guests.
- Fixing web bugs. They get recorded, not fixed from this repo.
- Redesigning Explore or listing screens.
- Keeping guest data across launches (recent searches, or saves on the device).
- Universal links or deep links from outside the app.

## Anti-goals

- A signed-out person creating an unowned booking. `createEvent` sends no header when signed out and the server returns 201 with `customer_id: null`, so the app must never reach booking create without a session.
- A stale-session message for someone who was never signed in. Today an RLS refusal on save leads to "sign in again".
- Staff stranded in customer mode, or a recovery session treated as browsing.
- One person's data showing for the next: signing out or switching accounts must still clear everything it clears today.
- Rendering a failed listing read as "no listings". Transient failures keep the existing wording (429 per IP is more likely now that shared carrier IPs browse anonymously).

## Decided by the owner

- Browsing is open; sign-in is asked for only at save, book or pay.
- Account required at booking for now.

## Accepted from the mockup review (proposed by Claude, owner said continue)

**Welcome.** One new link under "Sign in": "Browse without an account", underlined, white. The rest of the screen is unchanged. Shown on launch when signed out and not already browsing.

**Browsing.** The normal `(customer)` tabs. Explore shows no Today banner or anything else based on the person's own bookings or profile. The first-run tour does not show until there is an account; it then follows its existing per-account rule.

**When it's asked (owner's decision).** Book, or choosing a room, goes to the Select screen as today, signed out or not. People pick dates, room, tickets and guests and see the real total. Only Continue asks for an account. This is the only place a booking can start, so Continue needs a hard guard before booking create.

**Contact fields on Select (Claude's call, owner agreed).** Name, email and phone stay hidden while signed out, and fill from the profile after sign-in as they do today.

**The prompt.** Continue on Select, or the heart, opens a sheet over the current screen, using the shared `Sheet`:
- "Sign in to book": "We keep your booking and tickets in your account. Your dates and room stay as you chose them."
- "Sign in to save": same shape, with copy saying the item will be saved once signed in.
- Buttons: violet "Create account", outlined "Sign in", text link "Not now". "Not now" closes the sheet and changes nothing.

Create account and Sign in open the existing auth screens, whose photo and sheet design is unchanged.

**Coming back.** After sign-in, or sign-up with code verification, the person returns to the screen they were on with dates, room, tickets and guests kept. A pending save is written automatically. A pending book returns to the Select screen with the selection intact; it does not auto-submit a booking, and the person taps Continue again, with their details now filled in.

Backing out of the auth screens at any point returns to browsing as before, with the sheet closed.

**Account-only tabs.** Saved, Bookings and Account each show a short heading and line of copy plus "Sign in" and "Create account". Bookings mentions that website bookings made with the same email can be added afterwards (the existing claim flow). The notifications bell is hidden or leads to the same prompt; the builder picks.

**Staff.** If a gate or receptionist account signs in from the prompt, they go to their own mode as today and the pending action is dropped. So does a web-only account.

**Remembering.** Choosing to browse is stored on the device, so reopening the app keeps browsing rather than showing Welcome. Signing out returns to Welcome and clears that choice. It holds no personal data.

## Constraints

- **The Select selection is the riskiest part.** Dates, guests, tickets, extras and promo live in local `useState` in `StaySelect` and `EventSelect`. They must survive sign-in, including `route === 'loading'` and the email code step, so they need to move somewhere the navigator reset can't reach, or that reset must not unmount them. Promo must be revalidated after sign-in, since it may depend on the user. `useProfile` and `useCreateBooking` must work with no user on this screen without writing anything.
- **Route resolution is the core change.** `src/features/mode/domain/route.ts` sends `signedOut` to `auth` and its test pins that. It needs a signed-out browsing outcome. `recovery` keeps priority over it. Pure logic, so tests first.
- **Guards are mutually exclusive** in `src/app/_layout.tsx`. A browsing person is in the customer group and also needs to reach `(auth)` screens, without losing their stack.
- **Sign-in passes through `route === 'loading'`** while mode resolves, which drops the customer guard and would discard the stack. The stack must survive this or the pending destination must live outside the navigator. The builder picks, and it must be tested. `redirectTo` doesn't exist in SDK 57 (`.claude/rules/routing.md`).
- **Hooks with no guard** would query with `userId = ''` and should fail: `useMyBookings`, `useProfile` (through `useExplorePlace`), `useUnreadCount`, `useNotifications`, `useBooking`. `useSavedWallet` is gated only on its `enabled` flag, which a failed load sets. `useSaved`'s `toggle` must not write. Every customer route derives `userId` as `''` or `null` when signed out; today that case never happens.
- **Query keys** are `['customer', userId, ...]`. Guest reads must not share a cache entry with a signed-in user. `discoverKeys` and `checkoutKeys` carry no user and are safe.
- **Always-wipes** run on `SIGNED_OUT` and on a cold start with no session, so anything guest-owned in those stores is erased on each launch, which is acceptable here (non-goal above). The stored browse choice must not be in a store that gets wiped on a signed-out cold start, or it would never persist.
- **`useCustomerSession`** removes `['customer']` when the customer layout unmounts, and sign-out previously relied on that layout unmounting. Sign-out needs an explicit destination and cache clear for guests and members alike.
- **Backend reads verified by code reading only** against web `origin/main` @ `8b4cbaaf` (fetched 2026-10-23): `/api/listings`, `/api/reviews/{id}`, room availability, service charges and promo validate work with no token; `hotels`, `hotel_room_types`, `hotel_room_rates`, `serviced_apartments`, `apartment_pricing_rules`, `listings`, `hotel_breakfast_options` have public read policies. Confirm with one real signed-out run on a dev build. Reviews are in the `user` tier (30 per 60 s per IP), so make sure a listing screen doesn't burn it.
- **Project rules:** tokens only, no raw hex, cross-feature imports blocked, pure logic free of React, server authorisation stays the truth. Native rebuild not needed unless a dependency is added.

## Backend gaps to record first

Add to `docs/BACKEND_STATUS.md` §9 before coding, as the checker's report words them, marked unverified live:
- `hotels` allows INSERT by `anon` with `WITH CHECK (true)` (baseline 9514), and a forged row would show in public browsing.
- The suspended-vendor clause probably has no effect for `anon` and customers, so those listings stay visible.
- The hotel checkout banner's "Create Account" pushes to `/auth/signup`, which doesn't appear to exist.
- Unclaimed hotel and apartment guest bookings are readable by id alone, with no token.
- `/api/listings` filters `promo_codes` on `expires_at`, but the baseline column is `valid_until`.
- Scope note: guest create exists for events (JSON) and apartments (multipart); hotel guest create is a web server action only. Mobile requires an account pending a later decision.

Also supersede: UI-B §2 decision 1 ("Welcome every time signed out"), and resolve FR-2.5 and `.claude/rules/payments-customer.md`, which say guest checkout is allowed.

## Left to the builder

- How the group guards change, and whether the pending return lives in a small store or in route params.
- Exactly how a pending save is written after sign-in, reusing `useSaved`.
- Where the prompt state lives so listing, results and Explore can all raise it from one hook.
- The exact copy for "Sign in to save" and the Saved and Account empty states, in the app's existing voice.
- What the Account tab keeps for a signed-out person, such as the store links and legal pages.
