# Phase 4a customer bookings and tickets: Mobbin references

Collected 2026-10-13 for Phase 4a: my bookings, booking details, event tickets with the live code, the hotel check-in code, notifications, and the account tab. All screens are iOS on Mobbin; each link opens the exact screen. Each app lists **what we take** and **what we leave out**. Colours, type and spacing still come from `docs/DESIGN_SYSTEM.md` (customer density). Earlier customer notes are in `DESIGN_SYSTEM.md` §"Mobbin references" (ticket wallet, my bookings).

---

## 1. My bookings

| App         | Screen                                                                               | What we take                                                                                                                                                          | What we leave out                                                              |
| ----------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| IHG         | [Stays](https://mobbin.com/screens/e84d2315-5b01-4d81-a46c-36d2bb39256a)             | **"2 upcoming stays · Past stays"** tabs, with the count in the tab label. Each card is the place name with a date range under it.                                    | Full-width hotel photos on every card (too heavy on data and a low-end phone). |
| Booking.com | [Upcoming trip](https://mobbin.com/screens/4d774ab6-9a0c-4a09-b14a-902ecdf089b2)     | Card shows the place, "Mar 19–20 · **Confirmed**" with the status as a coloured word, and a check-in time line.                                                       | Upsell rails (taxi, rewards) under the trip.                                   |
| Beli        | [Your reservations](https://mobbin.com/screens/03cb7619-68e6-4030-91ec-70b6a18cae7c) | A **date tile** (SAT 27) leading each row, with a relative time ("Tomorrow…") and the party size. It matches our gate event tiles, so the app feels like one product. | —                                                                              |
| Turo        | [Trips](https://mobbin.com/screens/0817b979-f444-4c88-8151-b1ff15891f4b)             | A status chip that says **what happens next** ("Starting at 10:00 AM", "Ending at 12:30 PM").                                                                         | Vehicle thumbnail.                                                             |
| Agoda       | [All bookings](https://mobbin.com/screens/d6870702-3eb0-4cc9-b2af-47f64ece0e83)      | Upcoming / Completed / Cancelled tabs; a booking ID and "Confirmed" chip per card.                                                                                    | Support banners and a full-width button on every card.                         |
| Freenow     | [Trips](https://mobbin.com/screens/6f3a247a-f1ac-4d5b-977c-ac8d6dffec8c)             | "In progress" section above history: the live booking gets its own card.                                                                                              | Colour fills.                                                                  |

**Ours:** segmented **Upcoming · Past** (counts in labels) · an **"Today"** card first when something is happening today (event today, or a stay that has started) · rows: date tile, title, kind icon + word ("Event", "Hotel stay", "Apartment"), what's next ("Starts 7 pm", "Check-in from 2 pm", "Checked in · Room 204"), status chip (Confirmed / Pending payment / Cancelled / Completed) · row opens the details. Light thumbnails only if the listing has an image, at 56 px.

## 2. Empty bookings

| App             | Screen                                                                            | What we take                                                                                                                                   | What we leave out                              |
| --------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Marriott Bonvoy | [Trips empty](https://mobbin.com/screens/cf4b3cf1-5e65-46d4-873c-a15a43267996)    | **"Missing an upcoming stay?"** help line above the empty state. We need this, because web guest bookings aren't linked until claim (FR-2.22). | Big photo illustration.                        |
| Skyscanner      | [Bookings empty](https://mobbin.com/screens/d903f8a3-c5a5-4292-b787-cbb7123030fe) | **"Can't see a booking? Learn why"** info banner, plus one primary action.                                                                     | Cartoon illustration.                          |
| Airbnb          | [Past trips](https://mobbin.com/screens/c9c2f44d-1906-4857-bb94-1838ac1e1c8d)     | Plain sentence that says when this list will fill.                                                                                             | —                                              |
| Agoda           | [My trips empty](https://mobbin.com/screens/7a4629b6-4449-4937-baa4-451c025f992a) | —                                                                                                                                              | Mascot, floating WhatsApp button over content. |

**Ours:** kit `EmptyState` with our illustration · "No bookings yet" · "Bookings you make with this email show up here." · secondary line **"Booked as a guest before signing up?"** explaining guest bookings appear once claiming arrives (FR-2.22, web pending) · primary **Browse on bookhushly.com** until in-app browsing lands (4b).

## 3. Event ticket (QR)

| App          | Screen                                                                              | What we take                                                                                                  | What we leave out                                                          |
| ------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Luma         | [Ticket](https://mobbin.com/screens/fd60dbd4-6f2f-43e8-a2a8-dbf6954b3f59)           | QR **as large as the width allows**, white card, ticket type and count under it ("1× Standard").              | Dark backdrop (our brief: ink on white, light UI).                         |
| Eventbrite   | [Ticket](https://mobbin.com/screens/9aa88ec6-82a1-46e0-ae92-df1a9c9f7306)           | Date + time top-left, event title, then the QR, then **"Alex Smith · Ticket 1 of 1"** and the tier.           | Wallet-only button (Android dominates; skip).                              |
| Posh         | [Your order](https://mobbin.com/screens/70c99608-be00-4a4a-8d05-48bc9e9697bb)       | Under the QR, a plain action list: **View event, Add to calendar, Get directions** (Transfer later, 4c/5).    | Dark theme.                                                                |
| Meetup       | [Ticket](https://mobbin.com/screens/427c632f-e3ad-471e-8652-1d95b622e4f3)           | Ticket "stub" card: QR, dashed divider, then label/value rows (Name, Group).                                  | Download button as the only action.                                        |
| GetYourGuide | [Ticket #1](https://mobbin.com/screens/bf9fe40d-1a73-4a01-8d89-ad7325339b0e)        | The **code printed in text under the QR** (staff can type it if the camera fails).                            | Dark screen.                                                               |
| DICE         | [Hidden QR](https://mobbin.com/screens/8dce9185-ebcd-4c03-9055-234e433bc030)        | **"Current time: … " live clock** under the ticket. It proves to door staff that it's live, not a screenshot. | Hiding the QR until 2 h before (our rotating code already handles resale). |
| Transit      | [Scan your ticket](https://mobbin.com/screens/c4e98f62-bb31-4627-826a-9f7e15de6d72) | A big **live clock** under the code as anti-screenshot proof.                                                 | Colour block.                                                              |

**Ours:** full-screen ticket sheet:

- white card with the QR at max width
- below it, "Ada Obi · Ticket 2 of 3 · VIP"
- **swipe** between tickets with dots
- the code in text under the QR
- for live (rotating) codes, a thin ring that counts down to the next refresh, plus "Live code · refreshes every 30 s"
- **brightness boost + keep awake** while open
- offline: a static code with a neutral notice

Status per ticket: "Valid" or "Admitted 7:42 pm".

## 4. Hotel stay details and check-in code

| App               | Screen                                                                                 | What we take                                                                                                                | What we leave out                     |
| ----------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| World of Hyatt    | [Reservation details](https://mobbin.com/screens/832d27db-33f7-4c3f-818b-87e6a48bc4f3) | **Confirmation number** at the top as its own row; Check-in / Checkout with times; **Map · Call · Add · Share** action row. | Wallet room key.                      |
| IHG               | [Reservation](https://mobbin.com/screens/28300257-7af7-4709-9159-c03724701513)         | Big "Reservation #…" header, address as a link to Maps, then label/value rows (Room, Dates "Check in at 4 pm", Guests).     | Photo carousel in the middle.         |
| Booking.com       | [Stay details](https://mobbin.com/screens/55a408fc-b5a0-4f4a-a262-30b6c08df874)        | Icon-led sections: dates with check-in/out windows, **Property address + Get directions**, Contact (call).                  | Change dates (not supported).         |
| Marriott Bonvoy   | [Reservation details](https://mobbin.com/screens/0755538b-3a5d-40b4-9518-ceee7c8006c1) | Small caps section labels ("STAY INFORMATION") over plain rows; calm hierarchy.                                             | —                                     |
| Shangri-La Circle | [Reservation details](https://mobbin.com/screens/d58a396e-e7e0-4fec-87ab-69fd16863ed6) | **Add to calendar** next to the details; cancellation policy in words.                                                      | Cancel button (cancel is Phase 5).    |
| Navan             | [Hotel](https://mobbin.com/screens/1fb4ea0c-d252-4598-b9bf-93ef1e70b75d)               | "Payment: Paid" row.                                                                                                        | Upsell card, stacked outline buttons. |
| adidas            | [Pass](https://mobbin.com/screens/06a7325f-a9c6-4835-b559-54861e3b914d)                | Bare white full-screen QR with the date line above and the name below: nothing else to distract the scanner.                | —                                     |

**Ours:**

- Stay details: hotel name, address (opens Maps), dates with check-in/out times, room type and room (once assigned), guests, and payment status.
- A **"Show check-in code"** primary button opens a full-screen white sheet. It shows the QR, the 8-character code large in a monospace-like tabular style, the guest name and the dates, with brightness up and the screen kept awake.
- Actions: Directions, Call (WhatsApp number if that's all there is), Add to calendar.

## 5. Notifications

| App     | Screen                                                                                 | What we take                                                                                                                     | What we leave out |
| ------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Expedia | [Inbox](https://mobbin.com/screens/1fb9a102-d56f-4ecf-b16f-72e93d5e13c2)               | Bold title per notification ("Booking confirmed"), a sentence, and "15 minutes ago". A row menu offers **Mark unread · Delete**. | —                 |
| Agoda   | [Notification center](https://mobbin.com/screens/e21cd3cd-b851-4928-b1b7-a72c743a17d0) | An **unread dot** at the right and a direct "View booking details" link.                                                         | Tinted cards.     |
| Linear  | [Inbox](https://mobbin.com/screens/0248e978-f201-4ecc-b2aa-19ff8c38e2e5)               | Read items in muted text; a type icon in a circle on the left.                                                                   | —                 |
| Canva   | [Mark all read](https://mobbin.com/screens/2a66d379-9fb8-4f0a-bef7-2e0233f86250)       | "All notifications marked as read" toast with **Undo**.                                                                          | —                 |

**Ours:** a bell with an unread count in the Bookings header (no extra tab). The list shows a type icon, title, sentence and relative time, with a dot when unread; read rows are muted. Tapping opens the linked booking. **Mark all as read** sits in the header. Swipe or long-press opens Delete.

## 6. Account tab

| App       | Screen                                                                      | What we take                                                                                                                                              | What we leave out                                |
| --------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Hers      | [Account](https://mobbin.com/screens/0bc07b02-1738-4269-922b-3935a90e5099)  | Initials avatar + name + email header; plain rows (Contact information, Help centre, Privacy); app version at the bottom.                                 | —                                                |
| Airwallex | [Profile](https://mobbin.com/screens/954439e9-dbf0-4606-9dc4-c1b511cb39e1)  | Centred name and email, then rows with an icon each: Manage notifications, About, Contact support (external link icon), **Log out** in the accent colour. | Face ID toggle (biometric lock is out of scope). |
| Tiimo     | [Settings](https://mobbin.com/screens/86a6704a-2235-4bb4-b1ac-bbaf383a60dc) | Grouped sections (Profile / Account / Other) with **Delete account** and Sign out at the end of Account; Privacy and Terms under Other.                   | —                                                |
| Me+       | [Account](https://mobbin.com/screens/e6d9331c-a9fb-46b0-9872-0e5b01f076cb)  | Name row showing its value and a chevron (tap to edit).                                                                                                   | Photo avatar upload.                             |

**Ours:** the **Account** tab has three groups:

- **Header:** initials avatar, name and email, with the mode switcher under it if the user has another mode.
- **Your details:** Name, Phone, State, each showing its value with a chevron to edit.
- **Help and legal:** Help (bookhushly.com/help), Terms, Privacy.

Then **Sign out** and **Delete account** (from UI-B), with the app version last.

---

## Not taken from anywhere

- Wallet-only tickets, confetti, fake urgency, upsell rails inside bookings.
- Hiding the QR until shortly before the event (the rotating code covers resale).
- Booking changes or cancellation (Phase 5).
