# Trip planning (Phase 6, last item)

**Owner, 2026-11-26:** "copy the web's version". Status: built 2026-11-26 (branch `feat/trip-planning`).

## What the web does (web `origin/main` @ `1d5891ae`, read 2026-11-26)

- `/plan-trip`: four steps — Where (a state, optional), When (a date range, optional), Services (at least one of hotel, apartment, events under "Book instantly"; car rental, logistics, security under "Get quotes"), Name (suggested `"{place} trip, {Month}"` or `"My trip"`; plus optional notes). Creates `trips` + one `trip_services` row per service (`planned`).
- My trips: open trips (not `cancelled`), newest first, with each service's state.
- A trip: name, where, dates, "n/total booked" progress, notes, one card per service (planned → a "Browse hotels" / "Request a car" link; booked/confirmed → done), "Add a service" for the missing ones, "Mark complete" once all are booked (status `completed`), archive (status `cancelled`).
- Linking: every booking or request create route takes `trip_service_id` (validated server-side: own trip, same type, still `planned`); payment confirmation flips the row to `booked` (`lib/trips/sync.js`). The web offers it as an optional "Link to a trip" select on the hotel and car-rental forms, listing open (`planning`) trips that still have a planned service of that type.

## The app

- **Data:** `trips` / `trip_services` under RLS (own rows: select, insert, update, delete), as the web's `createTrip` does with the user-scoped client. No web routes exist and none are needed. `services_needed` is kept in step with the rows on add, as the web does.
- **Screens:** `/trips` (list), `/trips/new` (the four steps, the request-flow pattern: StepHeader, FlowFooter, round back arrow, one primary), `/trips/[id]` (detail). Entry: a "Your trips" row at the top of Bookings (signed in). No Explore tile yet: its tiles are photos and a new photo needs the owner's download OK.
- **Linking:** an optional "Part of a trip" choice on the hotel/apartment/event checkout and on the car/logistics/security check step, shown only when an open trip has a planned service of that type. "Browse hotels" / "Request a car" on a trip preselects that trip's service (a small in-memory store, wiped on sign-out). The chosen id is sent as `trip_service_id`; the server checks it.
- **Pure logic** (`domain/trips/trips.ts`, TDD): services and words, draft steps and readiness, the suggested name, progress, missing services, can-complete, link targets.

## Added after (2026-11-26, PR after #26)

- Explore: a wide "Plan a trip" tile (Unsplash photo, owner's OK to download; credits in `assets/images/trips/SOURCES.md`) opening `/trips/new`.
- The web's cross-sell after a booking: on "You're booked" (hotel, apartment, event), two suggestions by what was booked, then "Add to “{trip}”" (the newest trip still planning) or "Plan a full trip"; it can be hidden.
