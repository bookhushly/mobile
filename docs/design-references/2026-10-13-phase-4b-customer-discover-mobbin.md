# Phase 4b customer discover: Mobbin references

Collected 2026-10-13 for Phase 4b: Explore home, search, results and filters, listing detail for hotels, apartments and events, and Saved. All iOS on Mobbin; each link opens the exact screen. **What we take** and **what we leave out** for every app. Colours, type and spacing come from `docs/DESIGN_SYSTEM.md` (customer density). Earlier notes: `DESIGN_SYSTEM.md` §"Mobbin references" (home/discover, listing detail, ticket selection).

---

## 1. Explore (home)

| App            | Screen                                                                         | What we take                                                                                                                                             | What we leave out                                       |
| -------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| World of Hyatt | [Home](https://mobbin.com/screens/e9a169af-e2bf-4220-9ee8-e8747b8537a0)        | **Search pill first** ("Where can we take you?"), then a "Recommended for you" rail of photo cards with the name and city on the card, then **See all**. | Promo banners between rails.                            |
| Booking.com    | [Search home](https://mobbin.com/screens/fbbc0b89-c2c0-418a-9333-38e71d8131aa) | **Category tabs above search** (Stays, Attractions…) with an icon each; a one-field search card.                                                         | Loyalty and Genius cards above the fold.                |
| GetYourGuide   | [Discover](https://mobbin.com/screens/afb02ff9-e534-4dd4-8af5-cb0b1a0d2800)    | Category strip ("Nature, Culture, Food…") switching the rails below; heart on each card.                                                                 | Full-bleed hero image (data cost, no fake inspiration). |
| Trip.com       | [Home](https://mobbin.com/screens/596abac7-c270-4fbd-94a7-5b2fcc42e3c0)        | Category grid with icons leading into each vertical.                                                                                                     | Busy promo tiles and chatbot bubble.                    |
| Agoda          | [Home](https://mobbin.com/screens/26acc2f0-1b0c-4ee6-ae3d-674dff0d63e0)        | —                                                                                                                                                        | Coloured category blocks, coupon cards (fake urgency).  |
| Air NZ         | [Book](https://mobbin.com/screens/271573ae-2488-4544-a2c6-98a4fef90f84)        | Two-column category cards with icon + word.                                                                                                              | Dark theme.                                             |

**Ours:**

- **Top:** a search pill ("Search hotels, stays and events"), then three category chips (**Hotels · Apartments · Events**).
- **Rails:** "Happening soon" (events) and "Stays in <your state or Lagos>" (hotels and apartments). Each rail has a See all.
- **Cards:** 4:3 thumbnail, title, area, price "from ₦…", plus a heart.
- No promo banners.

## 2. Search

| App             | Screen                                                                      | What we take                                                                                              | What we leave out                             |
| --------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Marriott Bonvoy | [Search](https://mobbin.com/screens/1fb8d228-2c72-4ea9-90d6-77c2127f8691)   | Matches with the typed part **bold**; **Recent searches** with an × to remove each; quick chips (Nearby). | "Recently viewed" rail inside search (later). |
| Expedia         | [Going to](https://mobbin.com/screens/31d203f3-2c95-4680-97ca-828176c4fd04) | Big "Going to" field, **Current location** row first, recent searches with their details.                 | —                                             |
| Shangri-La      | [Find](https://mobbin.com/screens/973072d4-00f1-455a-97e7-f7b2fab2ccac)     | **Popular destinations** list as a starting point.                                                        | A–Z index (we have few cities).               |
| Vrbo            | [Going to](https://mobbin.com/screens/4edc384b-af7b-4101-95e1-2b966ac9bcf0) | Clean sheet with close × and recent rows.                                                                 | —                                             |

**Ours:**

- **Search screen:** a field plus a category segment.
- **Empty field:** shows **Recent searches** (on-device, removable) and **Popular places**, a short fixed list (Lagos, Abuja, Port Harcourt, Ibadan, Enugu, Kano, Uyo, Calabar).
- **Typing:** shows result rows directly. The search runs as the listings `search` parameter.

## 3. Results, filters and sort

| App             | Screen                                                                             | What we take                                                                                                                             | What we leave out                           |
| --------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Booking.com     | [Results](https://mobbin.com/screens/e8b417ce-4f0a-4bfe-887c-47eb4ec9b208)         | **Sort · Filter · Map** bar under the search summary; photo-left card with name, rating + review count, area, per-night and total price. | Promo cards and "only 1 left" urgency.      |
| Tripadvisor     | [Hotels](https://mobbin.com/screens/399f74db-5790-4cc8-b8cc-d6b0c5e9b052)          | Filter chips row (Price, Amenities) + **result count** ("1,170+ results") + sort dropdown on one line.                                   | Cashback banner.                            |
| Agoda           | [Results](https://mobbin.com/screens/47677fd6-7742-49d4-b2b1-5d90b4600b39)         | "Filters 6" chip showing **how many filters are on**; price range chip.                                                                  | Sponsored placement, sale banner.           |
| World of Hyatt  | [Select a hotel](https://mobbin.com/screens/260110c8-9645-4c08-bf51-5ac501a0ccb7)  | "9 Properties" count + Filter + Sort, price block "Avg/night".                                                                           | Points pricing.                             |
| Expedia         | [Sort & filter](https://mobbin.com/screens/4d01f378-f63e-408e-a1b5-e221ffaa6a58)   | Sheet: price range, star rating as tappable boxes, amenities as icon tiles; **Clear** top-right; **Done** pinned.                        | —                                           |
| Skyscanner      | [Sort and filter](https://mobbin.com/screens/c78596a3-6724-4522-a904-e5f987283191) | Sort as a select at the top of the same sheet; primary button says **"Show 1165 results"**.                                              | —                                           |
| Airbnb          | [Filters](https://mobbin.com/screens/a79788d5-b71c-408e-b07c-a6ad904c331b)         | **Clear all** (left) + **Show 1,000+ homes** (right) pinned footer.                                                                      | Price histogram (needs data we don't have). |
| Marriott Bonvoy | [Filter](https://mobbin.com/screens/57a62345-4c33-4907-87ae-6aa276627359)          | Calm list layout: small caps section labels, checkbox rows with icons.                                                                   | —                                           |

**Ours:**

- **Results:** a header with the query and category, then a row of **Sort** and **Filters (n)** chips plus the result count.
- **Rows:** 96 pt thumbnail left; title, area, rating "4.6 (23)" when there are reviews; price "₦45,000 / night" or "From ₦5,000".
- **Filters sheet:**
  - Sort list at the top.
  - Price minimum and maximum as two inputs (no slider: sliders are poor for exact naira on small phones).
  - Minimum rating as tappable boxes.
  - Category-specific options where the API supports them.
  - Footer: **Clear all** and **Show results**.
- **Filters apply on the button**, not live (data saver, DESIGN_SYSTEM).

## 4. Hotel and apartment detail

| App             | Screen                                                                           | What we take                                                                                                                        | What we leave out                               |
| --------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Agoda           | [Hotel](https://mobbin.com/screens/0b5d9312-19e7-4616-8fed-25640efc54a3)         | Gallery with **"1/69" counter**; name, area with map icon, rating + review count; **sticky footer "Start at ₦… · Choose my room"**. | "In high demand" / "Hurry" urgency boxes.       |
| Marriott Bonvoy | [Hotel](https://mobbin.com/screens/ad3fd9ea-a370-4995-98b1-cc130b769708)         | Short description with **Read more**; gallery strip with labelled groups; footer "FROM ₦… / Night · Select room".                   | —                                               |
| Booking.com     | [Rooms](https://mobbin.com/screens/c9d615e3-9836-4fc1-850b-8df81de1de82)         | Room card: name, beds, size, amenity icons with words, price for N nights.                                                          | Free-cancellation claims (we don't offer them). |
| Shopee          | [Room](https://mobbin.com/screens/db041c61-ac92-4208-800e-4164f3652542)          | Room photo with count, room size, **max guests**, price "includes taxes & fees".                                                    | —                                               |
| Vrbo            | [Unit options](https://mobbin.com/screens/86437508-33c2-42fd-9b35-5c07678fa9d6)  | Extras (breakfast) listed with their price added; total in the footer.                                                              | —                                               |
| Insight Timer   | [Accommodation](https://mobbin.com/screens/50720c0c-8a3b-4957-b459-3d34ea302933) | Horizontal room cards with price per unit; "From $950" footer.                                                                      | Serif-heavy layout.                             |

**Ours:**

- **Header:** a gallery with a counter and full-screen view.
- **Overview:** title, area (opens Maps), rating with review count, then a description with **Read more**.
- **Amenities:** icon and word, first six, then "All amenities".
- **Hotels: room types as cards.** Each shows name, max guests, beds and size when known, and price per night. Breakfast is shown as an extra with its price, if offered.
- **Apartments:** price per night, minimum nights, house rules and check-in/out times.
- **Footer:** sticky, with "From ₦… / night" and the primary **Book on bookhushly.com**. The web flow opens in the in-app browser until 4c. The label never promises in-app booking.

## 5. Event detail

| App        | Screen                                                                     | What we take                                                                                                                                           | What we leave out                             |
| ---------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Meetup     | [Event](https://mobbin.com/screens/6dc52154-97d5-4988-8955-6dac3cf75475)   | Cover image, title, **date row with add-to-calendar icon**, **venue row**, organizer card, description; save heart top-right with "Event saved" toast. | "+331 going" social proof (we don't have it). |
| Eventbrite | [Event](https://mobbin.com/screens/c3702bdb-009d-4406-aced-4ef3dbc1b1c6)   | Location section with address and copy; **Organized by** card; sticky footer **price range "₦0 – ₦17,850" + date + Get tickets**.                      | Followers counts.                             |
| DICE       | [Venue](https://mobbin.com/screens/c107d011-1317-4492-9bdd-f718dec30524)   | "Doors open at 7:00 pm" line; **Add to calendar** row; footer "From $0 · BUY NOW".                                                                     | Dark theme, embedded map.                     |
| Shazam     | [Concert](https://mobbin.com/screens/0ab1f7ac-46ef-4bda-a39b-8320060cc74e) | Date and venue in one grouped card with icons on the right (calendar, map).                                                                            | Full-bleed dark hero.                         |
| Posh       | [Event](https://mobbin.com/screens/16e44e79-ec4d-4498-a036-fe884afde00a)   | "Buy tickets from ₦…" as one primary button.                                                                                                           | Flyer-only info (text must be real text).     |
| Mindtrip   | [Event](https://mobbin.com/screens/cc43c22f-4e88-4a05-9395-9fc5b4c9fab1)   | Date tile on the cover ("Aug 5"); Overview/Location tabs.                                                                                              | AI chat box.                                  |

**Ours:**

- **Header:** a 16:9 cover image, then the title.
- **Info card:** the date and time (with an add-to-calendar icon, or skipped if out of scope) and the venue (opens Maps).
- **Organizer:** the vendor's business name.
- **Description:** with Read more.
- **Tickets:** a list of ticket types, each with its price and "Sold out" or "Few left" (only when the API gives remaining counts).
- **Footer:** sticky, with "From ₦… · Sat 18 Oct" and **Get tickets on bookhushly.com**. It reads "Sold out" when every ticket type is gone.

## 6. Saved

| App             | Screen                                                                       | What we take                                                                        | What we leave out                                    |
| --------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Viator          | [Wishlist](https://mobbin.com/screens/69c05c70-017f-4ec0-ae96-f87d1c1c49ef)  | Two-column grid of saved cards with a filled heart, location, rating and "From $…". | Recently-viewed segment (later).                     |
| Agoda           | [Saved](https://mobbin.com/screens/f8c06e81-b9e0-47ec-99a4-c52788cc6c20)     | Tabs per kind with counts ("Properties (4)").                                       | Offer blocks inside saved.                           |
| Marriott Bonvoy | [Wishlists](https://mobbin.com/screens/c707a28e-4602-49dc-b0cd-82c9625c8fdb) | Empty state: heart icon + "As you search, tap the heart icon to save…".             | Multiple named wishlists.                            |
| Airbnb          | [Wishlists](https://mobbin.com/screens/5baaf464-ca69-4ec6-8ccc-03307c1ed34f) | —                                                                                   | Named collections (one Saved list is enough for v1). |

**Ours:**

- **Saved tab:** a two-column grid of the same listing card. Segments **All · Stays · Events** carry counts.
- **Unsaving:** tapping the heart unsaves and offers Undo.
- **Empty state:** "Tap the heart on anything you like to find it here."
- **Storage:** the server's saved-listings route if it works for the app, otherwise on the device (decided after the contract check).

---

## Not taken from anywhere

- Urgency boxes, "only N left at this price", sponsored rows, sale banners, loyalty upsells, social-proof counts we can't back with data.
- Embedded live maps (data cost): a static "Open in Maps" link instead (DESIGN_SYSTEM low-end rules).
- Price histograms and sliders for naira.
