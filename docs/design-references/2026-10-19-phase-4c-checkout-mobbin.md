# Phase 4c checkout: Mobbin references

Collected 2026-10-19 for Phase 4c: choosing dates and guests, picking tickets, reviewing and paying, waiting for payment, and the confirmation. All iOS, from Mobbin; each link opens the exact screen. For every app: **what we take** and **what we leave out**. Colours, type and spacing come from `docs/DESIGN_SYSTEM.md` (customer density). Earlier references: 4a, 4b and Phase 5 (`2026-10-19-phase-5-customer-extras-mobbin.md`).

---

## 1. Dates and guests (hotels, apartments)

| App         | Screen                                                                          | What we take                                                                                         | What we leave out                                             |
| ----------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Agoda       | [Edit dates](https://mobbin.com/screens/92ae6687-d3b8-4a34-9adc-5eadd722539c)   | **Check-in → Check-out** header that fills as you tap; button reads the nights: **"OK (3 nights)"**. | —                                                             |
| Booking.com | [Select dates](https://mobbin.com/screens/42dd45a2-1924-4e6e-b0ac-36c76bca8721) | Bottom sheet calendar; range shaded between the two ends; summary line above the button.             | "I'm flexible" tab and ±days chips.                           |
| CRED        | [Change dates](https://mobbin.com/screens/4ea5f3ab-7acd-4150-b778-64e8c4134375) | Minimum stay in the subtitle ("Min. 2 nights"); unavailable days struck through.                     | Per-day prices (we don't have them per day), cashback banner. |
| IHG         | [Dates](https://mobbin.com/screens/b7527bfe-63dd-4a2d-9d0f-7e25f2c50dba)        | Guests as a tappable line beside the main button ("1 room, 1 guest").                                | Orange accent.                                                |
| Marriott    | [Dates](https://mobbin.com/screens/45a863f1-2134-452b-9a58-ced150255b80)        | Footer reads the choice back: "Jul 9–10 (1 night)".                                                  | Points / rate pills.                                          |

**Ours:** a dates sheet (month grid, past days off, Lagos "today"), a header showing Check-in → Check-out, and a button reading **"Choose · 3 nights"**. Guests use a stepper capped at the room's or apartment's maximum. A minimum stay shows as a line ("At least 2 nights") and the button stays off until it is met.

## 2. Tickets (events)

| App        | Screen                                                                            | What we take                                                                                   | What we leave out              |
| ---------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------ |
| Eventbrite | [Tickets](https://mobbin.com/screens/da112b9a-44ec-4dc7-a91c-517565e308cb)        | One card per ticket type, **− n +** stepper on the right, "Sold out" tag replaces the stepper. | Apple Pay; fees in each price. |
| Trip.com   | [Quantity](https://mobbin.com/screens/1663e8ba-144e-4918-8748-fcd12e8536f9)       | **"Max. 6 can be booked"** shown up front; − disabled at 0; total + Next pinned.               | Sessions picker.               |
| Swiggy     | [Choose tickets](https://mobbin.com/screens/87600b37-6137-41a0-87f5-9765d05f7b40) | "18 tickets left" under a type when stock is low; footer "1 ticket · ₦…" + **Proceed**.        | Dark theme, cashback.          |
| Luma       | [Select tickets](https://mobbin.com/screens/d57ffe57-0592-42de-9ff8-c2e0eeb97abe) | Plain list of types in a sheet with one Next.                                                  | Glass styling.                 |
| DICE       | [Checkout](https://mobbin.com/screens/cba1e7c8-4699-4eae-8cc7-0b9a952e137c)       | Big stepper for the single-type case.                                                          | Neon.                          |

**Ours:** one row per package, using the existing `TicketTypeRow` with a stepper. A row out of stock reads "Sold out". Low stock reads "{n} left", only below the organiser's threshold. A 20-ticket cap is shown ("Up to 20 tickets per booking"). The footer shows "{n} tickets · ₦{subtotal}" and **Continue**.

## 3. Review and pay

| App         | Screen                                                                                | What we take                                                                                                     | What we leave out                                 |
| ----------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Airbnb      | [Confirm and pay](https://mobbin.com/screens/a28898c6-3abf-48d9-8d2d-7cdd41662620)    | Order: what you're booking → payment method → coupon → **Price details** → one pinned **Confirm and pay**.       | Saved cards (Paystack's page handles card entry). |
| Tripadvisor | [Confirm and book](https://mobbin.com/screens/d5830480-393e-4fa4-af0b-3e6077825386)   | Pay-with list as radio rows; **Price breakdown** with a bold Total.                                              | Trip Cash.                                        |
| Navan       | [Checkout](https://mobbin.com/screens/d5ea2cc7-531c-4a40-86a7-663a2eb56b12)           | Fees line with an info dot explaining it.                                                                        | Agreement toggle.                                 |
| Marriott    | [Review reservation](https://mobbin.com/screens/3ba91323-9304-4e51-92ce-bf40a2fefaf0) | Guest information block (name, email, phone) with an edit chevron; button carries the amount: **"Book now ₦…"**. | —                                                 |
| Booking.com | [Payment info](https://mobbin.com/screens/a0452ea2-6e5e-440d-af45-13b025f114c0)       | Check-in / Check-out side by side; "Add a promo code" as a link-row.                                             | "Pay at the property".                            |
| IHG         | [Review reservation](https://mobbin.com/screens/03352113-eef2-496c-9809-da36889c9883) | Terms line directly above the button.                                                                            | "Prices may increase" urgency.                    |
| StubHub     | [Order summary](https://mobbin.com/screens/325be104-aea2-406e-8e60-13f1b627a782)      | A visible hold countdown in the header.                                                                          | Demand meter, urgency.                            |

**Ours:**

- **Review screen, top to bottom:**
  - what you're booking (title, dates or event time, room or tickets);
  - your details (name, email, phone, prefilled from the profile and editable);
  - **Pay with**: Card / bank (Paystack) or Crypto;
  - **Price details**, using only server numbers: subtotal, service charge (with its label) and total.
- **The price:** shown first from the listing as an estimate. After the booking is created, it is replaced by the server's figures. The button reads **"Pay ₦{server total}"**.
- **No urgency copy:** a countdown appears only if the server holds the booking for a fixed time.

## 4. Waiting for the payment

| App         | Screen                                                                                  | What we take                                                                                   | What we leave out          |
| ----------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------- |
| Starbucks   | [Processing](https://mobbin.com/screens/bb80f6f0-6750-4d4f-a4e0-cfa824b8a562)           | "Checking…" with a **Check again** button and a line that you'll be notified.                  | Gift art.                  |
| Temu        | [Still processing](https://mobbin.com/screens/89815c70-f0b7-411a-b145-13c467a5f5fc)     | **"Already paid? Update"**, and the promise **"We will NOT charge you if the payment fails."** | Upsells, orange.           |
| Blue Bottle | [Something went wrong](https://mobbin.com/screens/0900deaa-0c70-4297-9567-a208a55b7736) | Plain failure sheet with one **Try again**.                                                    | Illustration.              |
| Gojek       | [Processing](https://mobbin.com/screens/618d26c9-5e94-4e66-b18e-84c3d7137ee1)           | —                                                                                              | Ads during a payment wait. |

**Ours:** after the payment page closes, a **"Checking your payment"** screen polls the server and never trusts the redirect.

- **Paid:** we go to the confirmation.
- **Failed:** "Payment didn't go through. You weren't charged." with **Try again**, which reuses the same booking.
- **Still checking:** "We're still checking. If you paid, it will show in Bookings shortly." with **Check again** and **Go to Bookings**.
- **Crypto:** the waiting states are spelled out (waiting for payment, confirming on the network, partly paid, expired).
- **No ads or upsells.**

## 5. Confirmation

| App         | Screen                                                                               | What we take                                                                                                | What we leave out                 |
| ----------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Tripadvisor | [You're all set](https://mobbin.com/screens/b8fde94c-e6f3-4836-b357-0eaaf7608ba7)    | Check mark, **"You're all set"**, "An email confirmation will be sent to…", key facts, one **My bookings**. | Photo header.                     |
| Agoda       | [Confirmed](https://mobbin.com/screens/5f6087e4-303f-4d30-b1f7-ac09fd2c4840)         | Dates card with an arrow between check-in and check-out; **View booking details** primary.                  | Cross-sell carousels.             |
| Viator      | [Booking confirmed](https://mobbin.com/screens/2c12d3a4-efe9-402a-af46-7a679f33fcd8) | **View tickets** as its own row, and "you can access your booking offline".                                 | Rewards, add to calendar (later). |
| Turo        | [Trip booked](https://mobbin.com/screens/baf50986-c586-47c5-83d8-126ec4ae68bc)       | Short "Next steps" list.                                                                                    | Illustration.                     |

**Ours:** a full-screen "You're booked", using the success tone with an icon, text and haptic. It shows the title, dates or event time, and "Confirmation sent to {masked email}".

- **Main action:** **View tickets** for events, or **View booking** for stays.
- **Second action:** **Done**, which goes back to Explore.
- **No cross-sell, no confetti:** motion is limited to the tier-1 success tick from `MOTION.md`.

## 6. Crypto

No good like-for-like on Mobbin; the wallet apps are buy/sell flows. Taken from Crypto.com's [Buy with](https://mobbin.com/screens/445d4f61-8d15-479f-a278-8f146a396771): a plain list of coins as radio rows. **Ours:** pick **Crypto** in Pay with, then a short list of coins from the server. The line "Crypto payments can take up to an hour to confirm" is always shown, because crypto is never presented as instant.

---

## Not taken from anywhere

- Saved cards and Apple Pay or Google Pay: Paystack's hosted page takes the card.
- Urgency copy ("prices may increase", demand meters), cross-sell after paying, confetti, and illustrations on payment states.
