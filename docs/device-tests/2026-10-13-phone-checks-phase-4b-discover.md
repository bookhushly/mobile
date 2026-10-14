# Phone checks for browsing (Phase 4b)

**Build:** the Android preview build made after Phase 4b merges (link in the PR).
**Phones:** Moto G06 signed in as the **QA customer**. A second phone (or the web) signed in as the same customer, for the Saved check.
**What's new:**

- The customer app now opens on **Explore**, with tabs **Explore · Saved · Bookings · Account**.
- You can browse and search hotels, apartments and events.
- You can open full listing pages, save listings, share them, and tap **Book on bookhushly.com** to finish on the website.
- The intro tour (Find · Pay · Show up) is switched on.

Run the parts in order. Tick each box and note anything odd. Screenshots help.

---

## Before you start

- [ ] Uninstall the old build, then install this one (the tour only shows on a fresh install or a new account).
- [ ] Know at least one live hotel, one apartment and one upcoming event on bookhushly.com, ideally in Lagos. Include one event with several ticket types, and a sold-out one if possible.

## Part A. First open and Explore (about 5 min)

- [ ] After signing in, the **tour** shows three screens. **Skip** works. It doesn't come back after you finish it.
- [ ] Explore shows a **search bar**, the chips **Hotels · Apartments · Events**, a **Where to?** chip, and the rails Happening soon, Hotels in …, Apartments in ….
- [ ] **Where to?** → pick Abuja. The stay rails change. Close and reopen the app: it still says Abuja.
- [ ] If you have a booking today, a slim **Today** banner at the top opens your ticket or check-in code.
- [ ] Cards show a photo, title, area, price and a heart.
  - Hotels without a priced room say **"See rooms for prices"** (never ₦0).
  - Free events say **Free**.
- [ ] Pull down to refresh.

## Part B. Search (about 5 min)

- [ ] Tap the search bar. You see **Recent searches** (after your first search) and **Popular places**.
- [ ] Typing does **not** search until you press the keyboard's search key.
- [ ] Search `Lagos, Lekki (Phase 1)`. Results load with no error; the commas and brackets are ignored.
- [ ] Remove a recent search with ×.
- [ ] Tap a popular place: results for that place.

## Part C. Results and filters (about 10 min)

- [ ] Results show **Sort** and **Filters** chips and, when known, a count ("124 results").
- [ ] Scroll to the bottom: more results load until the end.
- [ ] **Filters:**
  1. Set a price range (digits group as 20,000) and a minimum rating (hotels).
  2. Nothing changes until **Show results**.
  3. The chip then shows **Filters (2)**.
- [ ] Hotels never offer bed size, floor or dates.
- [ ] A filter with no matches: "No matches. Try a different place or fewer filters", with **Clear filters**.
- [ ] Choosing only a sort doesn't count as a filter.

## Part D. Listing pages (about 15 min)

- [ ] **Hotel:**
  - Gallery with "1/12", tap for full screen, swipe, close.
  - Amenities, room types with "from" prices, beds and guests.
  - Check-in/out times.
  - Reviews (first 3, See all).
  - Footer **Book on bookhushly.com**.
- [ ] **Apartment:**
  - Key facts, price per night (and week/month if set).
  - "Prices vary by date" if the host set seasonal prices.
  - Minimum stay, house rules.
- [ ] **Event:**
  - Date and time, venue (opens Maps), organizer.
  - Ticket types with prices, early-bird note, and "Few tickets left" or "Sold out" where true.
  - Footer **Get tickets on bookhushly.com**.
- [ ] **Sold out, ended or not on sale:** the footer button is disabled and says why.
- [ ] **No phone numbers** appear anywhere on any listing page.
- [ ] Descriptions show as clean text: no HTML tags or `&amp;`.
- [ ] **Share** opens the share sheet with the bookhushly.com link. The link opens the same listing on the web.
- [ ] **Book on bookhushly.com:**
  - The first time, a note says you may need to sign in on the website.
  - The website opens inside the app on that listing. Close it to return.

## Part E. Saved (about 5 min)

- [ ] Tap the heart on a hotel and an event. They appear in **Saved** under All, Stays and Events, with counts.
- [ ] Unsave from Saved: an **Undo** banner appears and goes away after a few seconds. Undo brings it back.
- [ ] **Saved lists sync:** on the second phone (or the web) with the same account, the same items are saved.
- [ ] **Airplane mode:** with it on, tapping a heart shows a grey "Couldn't save" message, never a red error, and the heart goes back. Turn airplane mode off.
- [ ] With nothing saved: "Tap the heart on anything you like to find it here", with a Browse button.

## Part F. Comfort and accessibility (about 5 min)

- [ ] **Largest text:**
  - Cards, listing pages and filters stay usable.
  - The footer button stays on screen.
- [ ] **TalkBack:**
  - Hearts read "Save <name>" / "Remove <name> from saved".
  - Gallery photos read "Photo 2 of 12".
  - Prices read as naira.
- [ ] **Weak signal:** lists show "Couldn't load — check your connection" with Try again, never a red refusal.
- [ ] **Data:** scrolling a long hotel list on mobile data doesn't stall. Note roughly how much data 2 minutes of browsing uses (Android Settings → Data usage).

---

## Clean up

- [ ] Unsave the test items, or leave them; they're only on the QA account.

## Tell me

- Any box you couldn't tick: what happened instead.
- Whether any listing looked wrong compared with the website (price, photos, sold-out state).
- How fast lists and listing pages felt on mobile data, and the data used.
- Anything confusing about **Book on bookhushly.com**.
