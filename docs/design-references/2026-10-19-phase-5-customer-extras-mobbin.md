# Phase 5 customer extras: Mobbin references

Collected 2026-10-19 for Phase 5: claiming guest bookings, cancelling a booking, requesting a refund, transferring an event ticket, and writing a review. All iOS, from Mobbin; each link opens the exact screen. For every app: **what we take** and **what we leave out**. Colours, type and spacing come from `docs/DESIGN_SYSTEM.md` (customer density). Earlier references: 4a (`2026-10-13-phase-4a-customer-bookings-mobbin.md`) and 4b (`2026-10-13-phase-4b-customer-discover-mobbin.md`).

---

## 1. Claim guest bookings

| App          | Screen                                                                                         | What we take                                                                                                            | What we leave out                                                             |
| ------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| GetYourGuide | [Import your booking](https://mobbin.com/screens/f7255e44-96c4-4fd0-b25a-d7e7fc123f7a)         | One sentence on why ("Enter the email used… we'll send you a verification code"), then **Send code**.                   | Typing an email — ours is the account's own verified email, shown, not typed. |
| StubHub      | [Don't see your orders?](https://mobbin.com/screens/66fe9926-397d-4a53-a499-31b7ac3be49a)      | A help block in the empty bookings list explaining _why_ orders can be missing (checked out as a guest) and what to do. | The multi-step manual "sign out and back in" path.                            |
| Beli         | [Verify your reservation](https://mobbin.com/screens/86b1c518-92e5-4dc8-b774-37d126b49a97)     | Large left-aligned title, one field, a short explainer, one primary action at the bottom.                               | Serif-heavy styling.                                                          |
| Agoda        | [Get booking confirmation](https://mobbin.com/screens/0d9d36cf-675a-42e0-bb37-30edb40b255e)    | Bottom sheet with the email pre-filled and one action.                                                                  | —                                                                             |
| Polarsteps   | [Add your stay automatically](https://mobbin.com/screens/32abe6cb-424a-4bf4-bb3a-81cb060030d1) | Numbered steps showing what happens next.                                                                               | Email forwarding.                                                             |

**Ours:**

- **Where it shows:** Bookings shows a **"Bookings made as a guest"** card when `GET /api/bookings/claim` reports any ("3 bookings made with ada@… can be added to your account").
- **Flow:** **Add them**, then a sheet reading "We'll email a 6-digit code to a•••@gmail.com", then **Send code**. The code screen reuses the UI-B `CodeField`, with a resend countdown.
- **Result:** "Added 3 bookings", and the list refreshes.
- **Empty bookings:** the state now offers the same path. If nothing can be claimed, the card doesn't appear.
- **Who sees it:** gate-staff and receptionist accounts never see the card (the server answers `not_customer`).

## 2. Cancel a booking

| App          | Screen                                                                                   | What we take                                                                                                                                     | What we leave out                                     |
| ------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Airbnb       | [Confirm cancellation](https://mobbin.com/screens/ebc6e8b6-4379-4812-ad23-c8174f7a8869)  | Booking card at top, then **"You've paid ₦… / Your refund ₦…"** as two big lines; one pinned destructive button.                                 | Photo.                                                |
| Tripadvisor  | [Cancel for any reason](https://mobbin.com/screens/260c5b5c-96e2-4be8-8b89-df68c4a7238b) | Numbered plain-language facts incl. **"Cancellations can't be reversed"** and where the refund goes; **Confirm cancellation** + **No, go back**. | —                                                     |
| Booking.com  | [Cancel this booking?](https://mobbin.com/screens/29a791f9-1617-4b04-8c16-cd31c83f209f)  | Dialog with what's being cancelled (date, title, quantity) and what you'll get back; optional reason.                                            | Required reason dropdown (the routes take no reason). |
| Navan        | [Confirm cancellation](https://mobbin.com/screens/41f3c954-558c-43b0-b0a8-9a1270720887)  | Sheet with paid amount and refundability in one card.                                                                                            | —                                                     |
| GetYourGuide | [Cancel your booking](https://mobbin.com/screens/5c9c5a24-76e9-447c-8740-6a5fc0352819)   | Refund destination choice.                                                                                                                       | Credit option (we have no credits).                   |
| Peerspace    | [Cancel booking](https://mobbin.com/screens/742d468b-7e25-4610-abfe-a8599785aab2)        | Fine print that it can't be undone, under the button.                                                                                            | Credit-only refund.                                   |

**Ours:**

- **Cancel sheet:** what's being cancelled (title, dates or event time), then what happens to the money, in honest words:
  - Paid hotel: "A full refund will be sent to your payment method."
  - Paid event or apartment: "We'll refund you if the payment can be reversed."
  - Unpaid: "You haven't paid, so nothing is charged."
- **Then:** "This can't be undone", a destructive **Cancel booking** button and **Keep booking**.
- **Result:** the server's refund outcome is shown in words.
- **No amounts shown:** we don't have the refunded amount from the server.

## 3. Transfer an event ticket

| App         | Screen                                                                                 | What we take                                                                                          | What we leave out                               |
| ----------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Live Nation | [Recipient details](https://mobbin.com/screens/bd6ede8f-0eeb-4f60-b1f8-e0c299a48785)   | Recipient email field in a sheet, primary **Transfer 1 ticket**.                                      | Name fields (the route takes only `new_email`). |
| Posh        | [Confirm details](https://mobbin.com/screens/9742a4eb-ff59-4987-913f-8517cae6dc5a)     | **Review step** — event, what's sent, and **To** — before sending; **"All good, let's send"** + Back. | Flyer art.                                      |
| Cash App    | [Close and transfer](https://mobbin.com/screens/e13e7331-339b-49df-9c48-64d805b2d49d)  | Plain consequence sentence above two buttons.                                                         | —                                               |
| One         | [Ready to send](https://mobbin.com/screens/77394f78-9a6d-495e-af02-823d62349a56)       | **"This can't be cancelled. Make sure … is someone you know."**                                       | Dark dialog.                                    |
| Binance     | [Protect your assets](https://mobbin.com/screens/afaeaf01-c716-456c-88df-dd0c01942f07) | "Double-check the recipient's address; can't be reversed".                                            | —                                               |

**Ours:**

- **Step 1, the email:** with "Transfer tickets" as the title, the sheet asks for the email with an on-blur check and blocks your own email.
- **Step 2, the review:** event, date, number of tickets and the recipient's email, with the warning "You'll lose these tickets. This can't be undone." Buttons: **Transfer tickets** and Back.
- **Result:** "Tickets sent to b•••@…". The booking leaves your list.

## 4. Write a review

| App         | Screen                                                                            | What we take                                                                                           | What we leave out               |
| ----------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Turo        | [Rate trip](https://mobbin.com/screens/a154977d-2271-4c5c-8dc9-eb0364b68ccd)      | Five large stars with a **word under them** ("Great"), one "Write a public review" box, Submit pinned. | Extra optional questions.       |
| Peerspace   | [Rate your host](https://mobbin.com/screens/ad7cd7a2-b6ec-4acd-bd5d-81109d7fa693) | What you're reviewing (title + date) at the top; experience text; stars.                               | Host photo.                     |
| Agoda       | [Review](https://mobbin.com/screens/d3c5f385-1fe1-46cb-89f5-8ef69ec97e82)         | Stay summary line in the header.                                                                       | Title field and traveller type. |
| Tripadvisor | [More details](https://mobbin.com/screens/be7e2e33-16c1-4603-a5bb-ff968e4017dc)   | **Character counter** under the text box.                                                              | Sub-ratings.                    |
| Shangri-La  | [Feedback](https://mobbin.com/screens/b68a6db4-8f88-4661-b6f1-174b176509c2)       | —                                                                                                      | Alert dialog for "thank you".   |

**Ours:**

- **Opening it:** **Write a review** appears on past stays and events that qualify. Eligibility is decided by the server; the app shows the button only after the stay or event ends and when paid.
- **Sheet:** the title and dates at the top; five 44-pt stars with a word ("Poor … Excellent"); a comment box with a counter (max 1000, required); **Post review**.
- **Errors:** "already reviewed" means the button changes to "Reviewed". A `no_completed_booking` answer gives the message "You can review after your stay or event."

## 5. Request a refund (events)

No direct Mobbin match. We reuse the cancel sheet's layout. The sheet shows a reason box (required, max 500 characters with a counter) and the line "The organiser reviews refund requests; we'll notify you." A **Request refund** button sends it. A duplicate request gives "You've already asked for a refund for this booking".

---

## Not taken from anywhere

- Credits instead of refunds, sub-ratings, required cancellation reasons, social or host photos.
- Waitlist and follow-organiser (left out of this phase; see BACKEND_STATUS §9 Customer 5 (d)(e)).
