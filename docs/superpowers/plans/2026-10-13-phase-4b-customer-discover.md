# Phase 4b Customer Discover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers browse, search, filter and open hotels, apartments and events, save them, share them, and hand off to bookhushly.com to book.

**Architecture:**

- **Pure rules** live in `src/features/customer/domain/discover.ts`: search sanitising, listing params, price/stock/rating labels, place map, web URLs.
- **Data:**
  - Lists come from the public `/api/listings` route, sent without auth.
  - Detail, saved and reviews are read under RLS or a small route.
  - TanStack infinite queries feed the screens.
- **Screens and tabs:** screens use the UI-A kit. Tabs are Explore · Saved · Bookings · Account.

**Tech Stack:** Expo SDK 57, expo-router 57, React 19.2 + Compiler, TanStack Query 5 (`useInfiniteQuery`), supabase-js 2.117, zod v4, expo-image, expo-web-browser, Jest + RNTL v14.

**Spec:** `docs/superpowers/specs/2026-10-13-phase-4b-customer-discover-design.md` (rulings D1–D17). Contract: `docs/BACKEND_STATUS.md` §7 Listings and Saved rows, §9 "Customer 4b".

## Global Constraints

- **Code rules (hooks enforce):**
  - TS strict + `noUncheckedIndexedAccess`.
  - No `any`, `@ts-ignore`, `console.log`, raw hex, `fontWeight` or animated layout props.
  - Tokens only.
- **Imports:** `features/customer` imports no other feature, and `shared` imports no feature. Domain code imports no React or React Native.
- **`/api/listings`:** never sent with `Authorization` (use the new `auth: false` client option).
- **Detail reads:** explicit column constants only. Never select or render `vendor_phone`, `caretaker_*`, `agent_*`, `whatsapp_number`, `custom_questions`, `seats_config`, `views_count`, `security_deposit_notes`.
- **Search text:** always passes through `sanitizeSearch`. Searches run on submit, never per keystroke.
- **Prices:** display only. Hotel price 0 is never "₦0" or "Free". Event 0 is "Free".
- **Saved writes:** `.select('id')` plus the 4a zero-row stale-session guard. Upsert is idempotent.
- **Copy and accessibility:**
  - Sentence case, 12-hour times, curly apostrophes.
  - "Check your connection" for transient errors.
  - Word + colour.
  - Targets ≥ 44 pt.
  - `customer` density.
- **Tests:** RNTL v14 async. Test QueryClients use `{ retry: false, gcTime: Infinity }` and are cleared. Fake timers for FlatList batching. Output must be pristine.
- **Before each commit:**
  - `npx tsc --noEmit`, `npx expo lint`, the touched tests and prettier.
  - Stage specific paths. Never stage `CLAUDE.md` or `.claude/skills/update-docs/`.
  - No co-author or "Generated with" trailers.

## Review Focus

1. **Search text with commas or brackets:** `Lagos, Lekki (Phase 1)` never reaches the route raw (Task 1 tests).
2. **Hotel with price 0:** the card says "See rooms for prices" (Task 1 + 5).
3. **Event sold out or ended:** the footer never offers tickets (Task 1 + 7).
4. **Saved after a lost response:** a retry never unsaves (Task 2 + 8).
5. **Private vendor phone numbers:** none appear in any request select or on screen (Task 2 tests assert the column constants).

---

### Task 1: Discover rules and listing schemas (pure)

**Files:**

- Create `src/features/customer/domain/discover.ts` + tests.
- Create `src/features/customer/schemas/listings.ts` + tests.

**Schemas** (zod; only the fields we use; unknown keys stripped):

```ts
// list items
hotelItem: { id, title, location, price: number, media_urls: string[] | null, city, state, avg_rating: number | null, review_count: number | null, breakfast_offered: string | null, generator_available: string | null }
apartmentItem: { id, title, location, price, media_urls, city, state, area, apartment_type, bedrooms, bathrooms, max_guests, minimum_stay, avg_rating, review_count, furnished }
eventItem: { id, title, location, price: number | null, media_urls, vendor_name, event_date: string | null, event_time: string | null, category_data: unknown }
listingsPage: { items, nextPage: number.optional(), totalCount: number.nullable() }
```

Every field is nullable or optional as appropriate. Contract §1 has the full field lists; agent fields are not in our schema, so they're stripped.

**Detail column constants:**

```ts
export const HOTEL_COLUMNS =
  'id, name, description, address, city, state, image_urls, amenities, checkout_policy, policies, check_in_time, check_out_time, breakfast_offered, breakfast_type, generator_available, generator_hours, inverter_available, airport_transfer_enabled, avg_rating, review_count, nihotour_certified';
export const ROOM_TYPE_COLUMNS =
  'id, hotel_id, name, description, max_occupancy, base_price, size_sqm, amenities, image_urls';
export const ROOM_RATE_COLUMNS = 'id, room_type_id, beds, price_per_night, is_default, label';
export const APARTMENT_COLUMNS =
  'id, name, description, address, city, state, area, landmark, image_urls, amenities, apartment_type, bedrooms, bathrooms, max_guests, square_meters, price_per_night, price_per_week, price_per_month, minimum_stay, furnished, kitchen_equipped, parking_spaces, utilities_included, electricity_included, generator_available, generator_hours, inverter_available, solar_power, water_supply, internet_included, security_features, check_in_time, check_out_time, cancellation_policy, house_rules, caution_deposit, status, avg_rating, review_count';
export const PRICING_RULE_COLUMNS = 'id, label, start_date, end_date, price_per_night';
export const EVENT_COLUMNS =
  'id, title, description, price, price_unit, location, media_urls, active, availability, vendor_name, event_date, event_time, event_end_date, total_tickets, remaining_tickets, ticket_packages, category_data, cancellation_policy';
```

Detail schemas mirror these columns with tolerant parsing:

- `amenities`: a JSON value normalised by a helper to `string[]` (accepts `{items:[]}`, string arrays, or `{key:true}` objects).
- `ticket_packages`: an array of `{name, price, total?, remaining?, description?, early_bird_price?, early_bird_end?, is_single_tier?, max_per_order?}`, with `.catch([])` on a bad shape.

A schema test asserts no constant contains `phone`, `caretaker`, `agent`, `whatsapp`, `custom_questions`, `seats_config`, `views_count` or `security_deposit_notes`.

**Domain** (`discover.ts`). Exports and rules (one test per row):

| Function                                                                                                                                                                                                                                                                                             | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sanitizeSearch(raw)`                                                                                                                                                                                                                                                                                | trim; remove `, ( ) % * \ " '`; collapse whitespace; max 60 chars; `''` stays `''`. `'Lagos, Lekki (Phase 1)'` → `'Lagos Lekki Phase 1'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `type Category = 'hotels' \| 'serviced_apartments' \| 'events'`                                                                                                                                                                                                                                      | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `type Filters = { sort: 'newest'\|'price_asc'\|'price_desc'\|'top_rated'; priceMin?: number; priceMax?: number; minRating?: 3\|4\|4.5; breakfastIncluded?: boolean; generator24h?: boolean; bedrooms?: 1\|2\|3; furnished?: boolean; generator?: boolean; eventDate?: 'today'\|'weekend'\|IsoDate }` | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `buildListingParams(cat, { q, state, city, page }, filters, todayLagos)`                                                                                                                                                                                                                             | Returns a `URLSearchParams`-ready record. `search` = sanitised `q` when non-empty; `state`/`city` sanitised. Filter mapping: priceMin/priceMax → `price_min`/`price_max` (positive ints); hotels: minRating → `min_rating`, breakfastIncluded → `breakfast_offered=included`, generator24h → `hotel_has_generator=true`; apartments: bedrooms → `bedrooms`, furnished → `furnished=true`, generator → `generator_available=true`; events: `today` → `event_date=today`, a date → `event_date=<date>`, `weekend` → no server param (client keeps only Fri–Sun of this week: return `{ params, clientFilter: 'weekend' }`). **Never** emits `bed_sizes`, `floor`, `avail_checkin` or `avail_checkout`; minRating is ignored for non-hotels. |
| `filterCount(cat, filters)`                                                                                                                                                                                                                                                                          | Number of active non-default filters (sort ≠ newest counts as 1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `POPULAR_PLACES`                                                                                                                                                                                                                                                                                     | `[{label:'Lagos', state:'Lagos'}, {label:'Abuja', state:'FCT'}, {label:'Port Harcourt', city:'Port Harcourt'}, {label:'Ibadan', city:'Ibadan'}, {label:'Enugu', state:'Enugu'}, {label:'Kano', state:'Kano'}, {label:'Uyo', city:'Uyo'}, {label:'Calabar', city:'Calabar'}]`                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `hotelPriceLabel(price)`                                                                                                                                                                                                                                                                             | `> 0` → `{ amount: price, unit: 'night', prefix: 'From' }`; else `{ text: 'See rooms for prices' }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `roomTypeFrom(roomType, rates)`                                                                                                                                                                                                                                                                      | minimum of positive `price_per_night` across that type's rates and a positive `base_price`; `null` when none.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `apartmentPriceLabel(apt, rules)`                                                                                                                                                                                                                                                                    | `{ amount: price_per_night, unit: 'night' }` + `week`/`month` when set + `varies: rules.length > 0`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `effectivePackagePrice(pkg, nowMs)`                                                                                                                                                                                                                                                                  | `early_bird_price` when it's a number and `Date.parse(early_bird_end) > nowMs`, else `price`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `eventPriceLabel(event, nowMs)`                                                                                                                                                                                                                                                                      | packages non-empty → minimum effective price → `0` gives `{ text: 'Free' }`, else `{ amount, prefix: 'From' }` (no "From" when a single tier); no packages → `price` (null or 0 → "Free").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `eventStock(event, nowMs, todayLagos)`                                                                                                                                                                                                                                                               | ended: event end (`event_end_date ?? event_date` day) < today → `'ended'`; `active === false` or `availability !== 'available'` → `'notOnSale'`; sold out (packages: every `remaining === 0`; else `remaining_tickets === 0 && total_tickets > 0`) → `'soldOut'`; low: remaining/total ≤ 0.3 → `'almostSoldOut'`, ≤ threshold (`category_data.low_stock_threshold` ?? 50) → `'fewLeft'`; else `'onSale'`. Per-package version `packageStock(pkg)` → `'soldOut' \| 'fewLeft' \| 'onSale'`.                                                                                                                                                                                                                                                 |
| `ratingLabel(avg, count)`                                                                                                                                                                                                                                                                            | count > 0 and avg → `'4.6 (23)'` (one decimal); else `null`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `webListingUrl(kind, id)`                                                                                                                                                                                                                                                                            | hotel → `https://bookhushly.com/services/hotels/${id}`; apartment → `/services/serviced-apartments/${id}`; event → `/services/${id}` (encode ids).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `normalizeAmenities(value)`                                                                                                                                                                                                                                                                          | `string[]` from `{items:[]}`, `string[]`, or `{key:true}` (keys with true values, underscores → spaces, sentence case); anything else → `[]`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

- [ ] Tests first (RED), implement (GREEN). Commit `feat(customer): discover rules and listing schemas`.

### Task 2: Discover data access

**Files:**

- Modify `src/shared/api/client.ts`: request option `auth?: false` skips the token and the 401 refresh. Add a test.
- Create in `src/features/customer/api/`: `listingsApi.ts`, `listingDetailDb.ts`, `reviewsApi.ts`, `savedDb.ts`, plus tests.
- Create `src/features/customer/offline/recentSearches.ts` + test.

**Produces:**

```ts
fetchListings(c, cat, params): Promise<Result<ListingsPage<Item>, ApiError>> // GET /api/listings?category=…, auth:false, schema per category
listingDetailDb.hotel(id) → Result<{ hotel, roomTypes, rates } | null>    // three RLS reads (hotel by id maybeSingle; room types .eq('hotel_id').order('base_price'); rates .eq('hotel_id'))
listingDetailDb.apartment(id) → Result<{ apartment, rules } | null>       // serviced_apartments .eq('id').eq('status','active') maybeSingle; apartment_pricing_rules .eq('apartment_id').order('start_date')
listingDetailDb.event(id) → Result<EventDetail | null>                    // listings .eq('id').maybeSingle()
fetchReviews(c, id, type: 'hotel'|'apartment', page, limit) → Result<{ reviews: Review[]; hasMore: boolean; total: number }> // GET /api/reviews/{id}?type&page&limit, auth:false
savedDb.list(userId) / save(userId, item) / unsave(userId, key) / isSaved
// saved_listings: select 'id, listing_id, listing_type, listing_title, listing_image, listing_location, created_at' .eq('user_id') order created_at desc limit 200;
// save = upsert({user_id, listing_id, listing_type, listing_title, listing_image, listing_location}, { onConflict: 'user_id,listing_id,listing_type', ignoreDuplicates: true }).select('id') — 0 rows after ignoreDuplicates is SUCCESS (already saved): verify with a follow-up select only when the guard needs it;
// unsave = delete().match({user_id, listing_id, listing_type}).select('id') — 0 rows = already gone = success.
// listing_type values: 'hotel' | 'apartment' | 'event' (DB CHECK allows hotel|apartment|event|listing — confirm and pin in a test).
recentSearches: get(userId) / add(userId, entry) / remove(userId, entry) / clear(); plainKv key `bh.recent.<userId>`; max 8; registerAlwaysWipe → clear all users' keys.
```

**Stale session for saved writes:** a stale session can't be told apart from "already saved/gone" by row counts alone. Ruling: on 0 rows, re-select the row with the session. If the state matches the intent, it's a success. If it doesn't, refresh once and retry (reuse `withSessionRetry`'s pattern). Then `staleSession`.

**Tests:**

- No `Authorization` header on listings and reviews calls.
- Exact select constants, and the forbidden-field assertion from Task 1.
- Upsert options.
- Unsave match.
- Saved retry semantics.
- Recent searches cap and wipe.

- [ ] Commit `feat(customer): listings, listing detail, reviews and saved data access`.

### Task 3: Discover hooks

**Files:** in `src/features/customer/hooks/`:

- `useListings.ts` (`useInfiniteQuery`; key includes category, query, place and filters; `getNextPageParam` from `nextPage`; applies the weekend client filter; keeps pages on 429 with `retryAfterSec`)
- `useListing.ts`
- `useReviews.ts` (infinite)
- `useSaved.ts` (list + `isSaved(kind, id)` + `toggle(item)` optimistic with rollback and Undo support)
- `useRecentSearches.ts`
- `useExplorePlace.ts` (remembered place: plainKv `bh.explore.place.<userId>`; default is the profile state mapped to a place, else Lagos)
- tests

**Rules:**

- Queries are keyed by userId for saved; listings aren't user-specific (key without user).
- Lists aren't persisted.
- `useListing` returns `{ data: … | null | undefined, error, refetch }`.
- `useSaved.toggle` writes through `savedDb` and invalidates the saved list.

- [ ] Commit `feat(customer): hooks for listings, detail, reviews, saved and recent searches`.

### Task 4: Tabs, routes and the Today banner

**Files:**

- `src/app/(customer)/(tabs)/_layout.tsx`: four tabs **Explore** (`Compass`), **Saved** (`Heart`), **Bookings** (`Ticket`), **Account** (`UserRound`), in that order. Keep styling and the 1.3× label cap.
- Create `(tabs)/explore.tsx` and `(tabs)/saved.tsx` (placeholders until Tasks 5/8), `search.tsx`, `results.tsx`, `listing/[kind]/[id].tsx` (params validated: kind ∈ hotel|apartment|event, id UUID).
- `src/features/mode/hooks/useRouteStore.ts`: `customer: '/explore'`; update tests.
- `src/shared/config/features.ts`: `customerTour: true` (D15); update the test that pinned it off so it pins **on**. Update `TourScreen`'s "Pay" copy to say payment happens on bookhushly.com for now.
- Pure `todayBanner(bookings)` in `features/customer/domain/` → the first Today booking with its action (ticket or check-in code) or null; tests.

- [ ] Commit `feat(customer): explore and saved tabs, discover routes, tour on`.

### Task 5: Listing card, rails and Explore

**Files:** `features/customer/ui/ListingCard.tsx` (variants `row`, `rail`, `grid`), `Rail.tsx`, `PriceTag.tsx`, `RatingLine.tsx`, `HeartButton.tsx`, `TodayBanner.tsx`; `features/customer/screens/ExploreScreen.tsx`; wire `(tabs)/explore.tsx`.

**Content** (spec §3):

- **Card:**
  - image: `expo-image`, wash placeholder, `recyclingKey`, https only, 4:3 for rail/grid, 96 pt square for row
  - title (2 lines), area line, rating line (only with reviews), `PriceTag`, heart
  - event cards show a date tile chip ("Sat 18 Oct · 7:00 pm") instead of a rating
- **Explore:**
  - Today banner, then the search pill (→ `/search`)
  - category chips (→ `/results?category=…`)
  - "Where to?" place chip (opens a sheet with `POPULAR_PLACES` + all states via `NIGERIAN_STATES`)
  - rails: Happening soon (events, `sort=top_rated`); Hotels in <place>; Apartments in <place>
  - rail headers with **See all**
  - skeleton rails; per-rail error with retry; an empty rail hides with a one-line note
  - pull to refresh
- **Heart:**
  - an `accessibilityRole="button"` toggle with `accessibilityState.selected` and the labels "Save X" / "Remove X from saved"
  - optimistic; Undo `Banner` on unsave

- [ ] RNTL tests (rails render per category, Today banner action, place chip changes the query, heart toggles + undo, a hotel with price 0 says "See rooms for prices"). Commit `feat(customer): explore with rails and listing cards`.

### Task 6: Search, results and filters

**Files:** `features/customer/screens/SearchScreen.tsx`, `ResultsScreen.tsx`, `features/customer/ui/FiltersSheet.tsx`; wire `search.tsx`, `results.tsx`.

**Content:**

- **Search:**
  - autofocused field (`returnKeyType="search"`); category segment
  - empty field: Recent searches (× to remove) and Popular places
  - submit → `/results` with params; also saved to recent
- **Results:**
  - header: back + query summary ("Hotels · Lagos")
  - chips: **Sort**, **Filters (n)**, and the count when `totalCount` is known ("124 results")
  - `FlatList` of row cards with `onEndReached` → `fetchNextPage`, footer spinner, "Load more" after 429
  - empty → "No matches. Try a different place or fewer filters" + **Clear filters**
  - error → `ErrorState`
- **Filters sheet:**
  - per D8: sort radio list, price min/max (`Input`, number-pad, naira), category-specific toggles/boxes
  - footer **Clear all** (secondary) and **Show results** (primary)
  - nothing applies until Show results

- [ ] RNTL tests (submit-only search, recent add/remove, filter count chip, hotel never shows bed/floor/date options, pagination, empty + clear, 429 load more). Commit `feat(customer): search, results and filters`.

### Task 7: Listing detail

**Files:**

- `features/customer/screens/ListingScreen.tsx`.
- In `features/customer/ui/`: `Gallery.tsx` (horizontal pager + "2/12" counter; tap → `GalleryViewer` full-screen modal route or in-screen modal, only one Modal at a time), `RoomTypeCard.tsx`, `TicketTypeRow.tsx`, `FactsGrid.tsx`, `AmenityList.tsx`, `ReviewList.tsx`, `ListingFooter.tsx`.
- Wire `listing/[kind]/[id].tsx`.

**Content (spec §3, D4, D5, D10–D13):**

- **Header actions:** share (`Share.share({ message: title + url, url })`) and heart.
- **Hotel:** amenities (first 6 + "All amenities" sheet), room types (from-price, max guests, beds from the default rate's `beds`, size), breakfast/generator facts, check-in/out times, policies text.
- **Apartment:** facts grid, price block (night/week/month), "Prices vary by date" with the rules list, minimum stay, house rules, times, caution deposit (amount only).
- **Event:**
  - date and time (12-hour), venue (→ Maps), organizer (`vendor_name`)
  - ticket types with effective price, early-bird note ("Early bird until Fri 10 Oct") and stock word; stock state banners (sold out / ended / not on sale)
- **Description:** plain text. Strip HTML tags safely: no WebView, no HTML rendering.
- **Reviews:** first 3 + See all (hotel and apartment only).
- **Footer:**
  - price summary
  - primary **Book on bookhushly.com** / **Get tickets on bookhushly.com**, opened in the in-app browser
  - a one-time info note before the first handoff: "You may need to sign in on the website" (remembered in plainKv)
  - sold out / ended / not on sale → a disabled button with the reason
- **Not found:** EmptyState "This listing isn't available right now".

- [ ] RNTL tests per kind (prices, sold out/ended footer, early bird, hidden listing, reviews only for stays, share called with the web URL, HTML stripped, no phone text anywhere). Commit `feat(customer): listing detail for hotels, apartments and events`.

### Task 8: Saved tab

**Files:** `features/customer/screens/SavedScreen.tsx`; wire `(tabs)/saved.tsx`.

**Content:**

- Segments All · Stays · Events with counts.
- 2-column grid of `ListingCard` grid variant built from snapshots (title, image, location).
- Tap → listing detail.
- Heart unsaves with Undo.
- Empty state (Marriott copy): "Tap the heart on anything you like to find it here."
- Pull to refresh.
- Stale-session banner with **Sign in again**.

- [ ] RNTL tests (segments, unsave + undo, a retry never unsaves, empty, stale banner). Commit `feat(customer): saved listings`.

### Task 9: Docs

- `docs/MOBILE_APP_REQUIREMENTS.md`: FR-2.1/2.2/2.3/2.13/2.17 4b notes (no location permission; submit-only search; detail under RLS; booking hands off to the web; saved via RLS).
- `docs/device-tests/2026-10-13-phone-checks-phase-4b-discover.md`: Explore, Search, Results/Filters, each detail kind, Saved on two devices, share, Book handoff, offline/429 behaviour, comfort.

- [ ] Commit `docs(phase-4b): requirement notes and the discover phone checklist`.
