# Phase 3 receptionist screens: Mobbin references

Collected 2026-10-11 for Phase 3 (front desk: today, check-in by code or QR, current guests and check-out, room board). All iOS, from Mobbin; each link opens the exact screen. For every app: **what we take** and **what we leave out**. Colours, type and spacing always come from `docs/DESIGN_SYSTEM.md`; the receptionist uses `work` density. Earlier references: `2026-10-08-ui-a-gate-mobbin.md` (gate), `2026-10-08-ui-b-entry-accounts-mobbin.md` (accounts).

---

## 1. Today (front-desk home)

| App        | Screen                                                                               | What we take                                                                                                 | What we leave out                                                               |
| ---------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Reminders  | [Smart lists](https://mobbin.com/screens/84be367a-1f4e-48ac-8740-541510d01dad)       | A small grid of count tiles at the top (number large, label small) that each open their list.                | Saturated tile fills (violet is never a large fill; our tiles are white cards). |
| monday.com | [My work](https://mobbin.com/screens/669c934e-c45f-4d9f-a558-b4a72f04c6ea)           | Horizontal row of count tiles with the selected one outlined; a list underneath.                             | Floating "+" button (the desk doesn't create bookings).                         |
| Asana      | [Home project card](https://mobbin.com/screens/0181c618-16c6-4cfb-808e-fe2ba2207a4d) | Three equal count cells (Completed / Overdue / Due) inside one card, with only the problem number coloured.  | Carousel of task cards.                                                         |
| Jobber     | [Business health](https://mobbin.com/screens/5097dfd2-931a-4947-9e84-1e629562b152)   | Label-left, number-right rows grouped under a short heading with a date line ("This week (Nov 30 – Dec 6)"). | Percentage-change chips (we show no trends, no fake stats).                     |
| Flighty    | [Daily performance](https://mobbin.com/screens/11973472-7293-48ee-8732-f66c606655fc) | One headline count for the day with a short breakdown below it (On time / Delayed / Cancelled).              | Charts and bars.                                                                |
| ClickUp    | [Dashboard](https://mobbin.com/screens/c7500e36-3d73-4b27-99b0-fd489a7cb2d4)         | —                                                                                                            | Big empty "0 tasks completed" cards; pie charts.                                |

**Ours:** hotel name + date in the header · one card with four count cells (Arriving, In house, Leaving, Free rooms), each opening its list · a **Check in a guest** primary button (scan or type code) · today's arrivals list under it.

## 2. Check in: confirm before acting

| App               | Screen                                                                                  | What we take                                                                                                         | What we leave out                                                        |
| ----------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| World of Hyatt    | [Reservation details](https://mobbin.com/screens/832d27db-33f7-4c3f-818b-87e6a48bc4f3)  | Label/value rows: Check-in date, Checkout date, room type; the confirmation number as its own labelled row.          | Photo header and map/call/share row.                                     |
| Shangri-La Circle | [Upcoming reservation](https://mobbin.com/screens/341c4ec6-cb77-4b99-9cb9-bac4058a1ea3) | Check-in and check-out dates side by side with "1 night" between them; one full-width action under them.             | Disabled grey "Mobile check-in" (we explain why instead of greying out). |
| Trip.com          | [Booking confirmation](https://mobbin.com/screens/d7294f0b-8a69-4a99-bbf4-a1195d03e073) | Check-in / Check-out / Rooms / Nights in a four-cell row; guest name under it.                                       | Dense voucher layout and language tabs.                                  |
| Agoda             | [Booking detail](https://mobbin.com/screens/ea109fdc-34d5-4a79-a9be-21b314372bd4)       | A status headline at the top ("Your booking is confirmed") before the details.                                       | Pay now button and mascot.                                               |
| Posh              | [Scan tickets](https://mobbin.com/screens/d227b61a-b14b-4edc-a5e7-8ee8a8a81812)         | Guest card at the top (name, contact) then the order, then the one action pinned at the bottom with Cancel under it. | Dark theme.                                                              |
| Yazio             | [Captured barcode](https://mobbin.com/screens/c452e85a-3d34-44dd-a6a9-92460c86d5b4)     | After a scan, show what was captured as a row with **Scan again**, then one primary button.                          | —                                                                        |

**Ours:** status line ("Ready to check in" / why not) · guest name large · code as a labelled row · check-in and check-out dates with nights · room type and room number · paid status · warnings (early arrival) as an info banner · **Check in** pinned at the bottom with Cancel.

## 3. Scan and type a code

| App    | Screen                                                                         | What we take                                                                                                                                | What we leave out                                      |
| ------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Luma   | [Scan](https://mobbin.com/screens/6f2ca8bd-8c6a-4bf5-9ac7-7e2336d30ef9)        | **List / Scan** segmented switch at the bottom; a short toast "Guest checked in." at the top after success, then straight back to scanning. | Dark camera chrome (we reuse the gate scanner chrome). |
| Meetup | [List / Scan](https://mobbin.com/screens/31e93f37-6471-40fc-969c-e2396f9ad6a4) | List and Scan as two tabs of one check-in place; a one-line hint under the viewfinder.                                                      | —                                                      |
| Meetup | [Attendees](https://mobbin.com/screens/3dda809f-fb8e-42b8-a42d-7f40e9741f87)   | Count chips ("Not checked in 0") and a search field pinned at the bottom of the list.                                                       | Avatars (we have no guest photos).                     |

**Ours:** the check-in sheet opens on **Type code** (the desk has a keyboard and a guest standing there) with **Scan QR** next to it; both lead to the confirm screen; success shows a short banner and returns to Today.

## 4. Lists: arrivals, in house, leaving

| App               | Screen                                                                              | What we take                                                                                       | What we leave out                                                          |
| ----------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Partiful          | [Check in guests](https://mobbin.com/screens/1103e00c-2084-4264-b872-2e8cb313769c)  | Search at the top, one row per guest with a **Check in** button on the right and a tick once done. | Gradient background, avatars.                                              |
| Agoda             | [All bookings](https://mobbin.com/screens/d6870702-3eb0-4cc9-b2af-47f64ece0e83)     | Segmented tabs (Upcoming / Completed / Cancelled) and a status pill per booking.                   | Cards with photos and a full-width button each (too tall for a desk list). |
| Trip.com          | [All bookings](https://mobbin.com/screens/af915440-f5a4-4632-b003-6b125fc3e2ff)     | The status word leads the row in its colour ("Awaiting payment", "Confirmed").                     | Price per row (the desk doesn't handle money).                             |
| Airwallex         | [Cards](https://mobbin.com/screens/3420554f-b00c-433b-a634-d7f847c8c870)            | Tabs + search field + a filter button on one line; compact rows with a status pill on the right.   | —                                                                          |
| Zomato            | [Your bookings](https://mobbin.com/screens/b2da1a7b-4031-4299-88e6-4942956cd1bc)    | —                                                                                                  | Card per booking with repeated labels.                                     |
| Shangri-La Circle | [All reservations](https://mobbin.com/screens/4bd1d5a6-d1ec-4a8d-9259-220bf7827ecb) | —                                                                                                  | Hero photo per reservation.                                                |

**Ours:** one **Guests** screen with segmented tabs **Arriving · In house · Leaving** (counts in the labels) and a search field · `ListRow` per booking: guest name, room number or type, dates, status pill · row opens the booking; In house and Leaving rows offer **Check out** inside the booking, never as a one-tap row button.

## 5. Room board

| App        | Screen                                                                      | What we take                                                                          | What we leave out                                                           |
| ---------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Attio      | [Contacts](https://mobbin.com/screens/294bb80d-1bc4-4cf7-b0b0-396cccad7bc7) | A small coloured dot + word for status per row ("● Negotiation"), never colour alone. | Spreadsheet columns.                                                        |
| Jira Cloud | [Board](https://mobbin.com/screens/6a847e41-d3f0-446b-bb98-09faf22c2f8e)    | Filter chips (Status) above the board; count beside each group heading.               | Horizontal-scrolling columns on a phone.                                    |
| Asana      | [List](https://mobbin.com/screens/04f565e9-e2d7-4dc0-bbda-35d6d8fb8200)     | Collapsible group headings (To do / Doing / Done) with rows under them.               | Coloured priority blocks.                                                   |
| monday.com | [Board](https://mobbin.com/screens/da2427e0-c65a-4016-8ceb-6c4ba89fb6e4)    | —                                                                                     | Solid coloured status cells (too loud for a room board under our 70/20/10). |

**Ours:** filter chips by status (All · Available · Occupied · Cleaning · Maintenance) with counts · a grid of room tiles (number large, status dot + word) on tablets, a list on phones · tapping a room opens a sheet to change its status; occupied rooms can't be set from here (the server refuses; we say why).

---

## Not taken from anywhere

- Revenue, occupancy % and trend charts (no fake or vanity stats; the desk needs counts it can act on).
- Swipe-to-check-out (an irreversible action needs a confirm step).
- Offline mode (DECISION-2: the receptionist is online-only).
