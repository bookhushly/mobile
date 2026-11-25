# Test listings on production (web handoff)

**Owner's decision (2026-11-23):** two test listings in each category, live and public on production, each fully detailed like a real listing, and each carrying a visible **"Test listing"** badge. Mobile sessions can't write to production (no admin keys, by design) or edit `../web`, so a session in the web repo does the data and server parts. This mobile repo then shows the badge.

## 1. Mark them (migration)

Add `is_test boolean not null default false` to `hotels`, `serviced_apartments` and `listings` (events). Expose it wherever a listing is read:
- `GET /api/listings`, `GET /api/listings/{id}`, and the hotel and apartment detail reads;
- RLS select stays as it is.

Real rows stay `false`. Never set `is_test` from the vendor dashboard: admin or migration only.

## 2. Stop real money on them (server, required)

These are public, so a stranger can find them. Real money must never be taken for a stay, ticket or room that doesn't exist.
- **Payment:** `POST /api/payment/initialize` refuses a booking on an `is_test` listing with `409 { code: "test_listing", error: "This is a test listing and can't be paid for." }`.
- **Booking create:** the booking routes may create the booking (so the flow can be tested up to Pay), but the booking must be marked so it never counts in vendor payouts or stats.
- **Owner's call (open):** if you'd rather test a real payment end to end, use a ₦100 price and refund it from the Paystack dashboard. Say which, and the app follows.

## 3. The data (production, through the admin route or a one-off script)

- **One test vendor:** business name "Bookhushly Test Vendor", approved, owned by an admin-controlled account (not a customer's).
- **Two listings per category,** with `is_test = true`:
  - **Hotels (2):** Lagos and Abuja. Full description, address, city and state, 6+ photos (the web's own storage, not hot-linked), amenities, policies, check-in/out times, breakfast, generator and inverter details, and 2–3 room types each with price, capacity, beds and available rooms.
  - **Serviced apartments (2):** Lagos (Lekki) and Port Harcourt. Type, bedrooms, bathrooms, guests, price per night/week, minimum stay, power/water/internet, security, house rules, caution deposit, caretaker name, 6+ photos.
  - **Events (2):** one in each of two cities, dated 3–6 weeks ahead. Title, description, venue, time, 2–3 ticket packages with prices and counts, `require_dynamic_ticket` on one of them (to test rotating codes), poster plus photos.
- **Names and text:** made-up names that read like real places but are clearly ours, ending in "(Test)", e.g. "Harbour Point Suites (Test)". Use no real business's name, logo or photos, and no fake reviews or ratings.
- **Photos:** licence-free (Unsplash), uploaded to Supabase Storage.

## 4. Web badge

The web's listing card and detail show "Test listing" for `is_test` rows, the same as the app.

## 5. Mobile (this repo, after 1 ships)

- Parse `is_test` in `schemas/listings.ts` (default `false`).
- Show an ink-on-white "Test listing" badge on `ListingCard` and the detail hero.
- Map `409 test_listing` to "This is a test listing and can't be paid for" (never "try again").

## 6. Test customer account

The owner signs up in the app with an email they control (a `+test` alias is fine) and picks the password. Agents don't create production accounts or set passwords.

## 7. Clean-up

Keep a list of the created ids (vendor, listings, room types, ticket packages). Removing the data later means setting `active = false` / unpublished, never a hard delete with bookings attached.

**Prompt for the web session:** "Implement `../mobile/docs/superpowers/specs/2026-11-23-test-listings.md`: the `is_test` migration and API field, the payment refusal, and the web badge as a PR against `main`; then, after it's merged and deployed, create the test vendor and the six listings on production as in §3, and report the ids."
