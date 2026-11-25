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
