# Vendor mode: build plan

**Decision:** DECISION-11 (requirements §13). Design approved in the "Vendor Mode Directions" artifact (v13, 2026-11-25): https://claude.ai/artifact/5zrE4ijLttFT1etq7XXpem
**Web dependency:** `docs/superpowers/specs/2026-11-25-vendor-web-routes.md`. Until those routes ship, vendor screens run on sample data in dev builds only.

## Ground rules

- **Off in production until the web routes land.** `vendorModeEnabled()` is true in `__DEV__` or when `EXPO_PUBLIC_VENDOR_MODE=1`. When it's off, a vendor account still gets "Use the web dashboard", as today.
- **Sample data behind one interface.** Each vendor read goes through a `VendorSource` (`api/vendorSource.ts`). It has one sample implementation now and the HTTP implementation later. Screens and hooks never import sample data directly. Sample data is never bundled into a production build path.
- **Identity:** the vendor row is read under RLS with explicit columns (`vendors`: id, business_name, business_category, approved, status, suspended_at, rejection_reason). Service states come from `vendor_service_areas`. This is replaced by `GET /api/vendor/me` once it exists.
- **Money:** request-for-quote vendors have a wallet (withdraw). Hotels, apartments and events are paid to their bank by Paystack (web `RAIL_A`), so they get no withdraw.
- **Reuse:** hotel check-in opens the front-desk check-in flow, and events "Scan tickets" opens gate mode. These are not rebuilt.

## Slices (each one reviewable and shippable on its own)

1. **Mode and shell.**
   - `resolveMode` gains `vendor`: role `vendor` → modes `[vendor, customer]`, plus `gate` when they have scannable events. This applies only when vendor mode is enabled.
   - Route `vendor` → `/vendor/today`.
   - The `(vendor)` route group with tabs per kind (request-for-quote: Today, Requests, Jobs, Earnings, Account; hotel: Today, Bookings, Rooms, Earnings, Account; apartment: Today, Bookings, Calendar, Earnings, Account; event: Today, Events, Scan, Earnings, Account).
   - Vendor identity hook and the states: not set up, waiting for approval, suspended.
2. **Request-for-quote Today:** summary rows, "Up next" job card with route, new requests strip, this month against the same days last month (two numbers and two lines).
3. **Requests:** list (new, quoted, won), request detail, send quote (amount, what you keep, vehicle pick, message), withdraw quote.
4. **Jobs:** list grouped by day, running job (progress, customer call, next step, logistics photos), start and complete.
5. **Earnings:** month headline, month bars on Earnings only, to withdraw / on hold, activity, withdraw (idempotent, needs the web fix first). Hotel, apartment and event variant: paid to your bank.
6. **Account:** business card, settings rows (web-only ones open the web), "Switch to booking".
7. **Hotel, apartment and event Todays,** plus the apartment confirm / decline (route exists) and calendar.
8. **Swap sample data for HTTP** per route as the web ships, verifying each contract first.

Push notifications come after these (owner, 2026-11-25).

## Status (2026-11-26)

Slices 1–7 are built. Slice 8 is partly done: live data for request-for-quote vendors, the wallet, and hotel and apartment bookings. Events, the apartment calendar and the fleet are still on sample data. Hotel owners also get the front desk. Vendor mode itself stays dev-only until it's checked with a real vendor account.

## Follow-ups from the pre-PR reviews (not in this PR)

- **Virtualise the long lists:** Requests (Quoted/Won), Jobs (Done), Bookings (Past) and Earnings activity use `ScrollView` + `.map()`, and `/rfq/offers`, `/rfq/jobs` and `/api/vendor/bookings` aren't paged. Move them to FlashList/SectionList, with headers as their own row type and `recyclingKey` on photos.
- **Split long files:** `mapVendor.ts`, `vendorHttp.ts`, `JobScreen.tsx`, `RequestScreen.tsx`, `VendorListingContainers.tsx`, `EarningsScreen.tsx` and `QuoteScreen.tsx` are over ~200 lines, and the containers files hold several components.
- **Measure:** count requests per minute on a low-end Android release build with live data. The budget is under 30 a minute; Today is now about 6 calls, shared between screens for 20 s. Profile the Jobs and Requests lists with 200+ rows.
- **Confirm with the owner:** whether the Today screens' mid-page primary buttons (Check a guest in, Scan tickets, apartment Confirm/Decline) are an accepted exception to "one full-width primary at the bottom". They were drawn that way in the approved design.
- **Web:** `expected_status` on the apartment status route (the app's re-read-then-post leaves a small window), the fee rate in `/api/vendor/me`, a fleet route, an events-with-capacity route, room type and paging on `/api/vendor/bookings`, and the suspended-owner and apartment-refund fixes in BACKEND_STATUS §9.
