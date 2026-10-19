# Phone checks for customer extras (Phase 5)

**Build:** the Android preview build made after Phase 5 merges (link in the PR).
**Phones and accounts:**

- The Moto G06 signed in as the **QA customer**.
- A **second customer account** (on another phone or the web) for receiving transferred tickets.
- Email for both accounts that you can read.

**What's new:**

- **Add guest bookings to your account:** a card on Bookings, then a code by email.
- **Booking details:** a new **Manage booking** section with Cancel booking, Ask for a refund (events), Transfer tickets (events) and Write a review.
- **Under the hood:** live tickets now refresh once per booking instead of once per ticket.

Everything you create here must be cancelled or refunded by the end. The last part lists how.

---

## Before you start

Make these bookings on **bookhushly.com**:

- [ ] **Signed out**, with the **QA customer's email**: a paid event ticket (Booking A, for the claim check).
- [ ] **Signed in** as the QA customer:
  - **B:** a paid event with 2 tickets, for transfer.
  - **C:** a paid event, for the refund request.
  - **D:** an unpaid hotel booking (start checkout and stop at payment), for cancelling.
  - **E:** a paid hotel stay starting in a few days, for a paid cancel.
- [ ] **For the review check:** a past paid event or stay on the QA customer. If there isn't one, skip that part and tell me.

## Part A. Add guest bookings (about 5 min)

- [ ] Open the app as the QA customer. A **"Bookings made as a guest"** card says 1 booking can be added.
- [ ] **Add them**: the sheet shows your email partly hidden. Tap **Send code**; an email arrives with a 6-digit code.
- [ ] **Wrong code:** type a wrong code. It says the code is wrong or has expired, and the boxes clear.
- [ ] **Right code:**
  - "Added 1 booking", and **Booking A** now appears in Bookings.
  - Its live ticket works.
- [ ] **Resend timer:** **Send a new code** stays greyed out with a countdown at first.
- [ ] **Accounts that can't claim:** signed in as a **gate staff** or **receptionist** account, the card never appears.

## Part B. Cancel (about 10 min)

- [ ] **Unpaid booking D:**
  1. Open it → **Manage booking** → **Cancel booking**.
  2. The sheet says nothing is charged and that this can't be undone. You can also choose **Keep booking**.
  3. Cancel: it says the booking is cancelled, and the status changes.
- [ ] **Paid booking E:**
  1. The cancel sheet says a full refund goes to your payment method.
  2. Cancel. The result says what happened to the refund (in words).
  3. On the web, the booking shows as cancelled.
- [ ] **Lost connection:**
  1. On a cancellable booking, tap **Cancel booking** and switch **airplane mode on** within a second.
  2. It says it couldn't confirm.
  3. Airplane mode off, then **Check again**. It shows the true state (cancelled or not), never "Couldn't cancel" for a booking that did cancel.
- [ ] **No cancel where the server would refuse:** the option doesn't show on:
  - a booking on its event day;
  - a checked-in stay;
  - an already cancelled booking.

## Part C. Refund request (about 5 min)

- [ ] **Booking C** → **Ask for a refund**:
  1. Type a reason; the counter shows characters used. The button is disabled until there's a reason.
  2. Send. It says the request is sent and the organiser reviews it.
  3. The button now reads **Refund requested**.
- [ ] **Already asked:** asking again, after reinstalling or on the web, reads "You've already asked for a refund".

## Part D. Transfer tickets (about 10 min)

- [ ] **Booking B** → **Transfer tickets**.
- [ ] **Your own email** is refused. An invalid email says so.
- [ ] **Second account's email:**
  1. A review step shows the event, date, 2 tickets, the recipient's email and "You'll lose these tickets".
  2. Tap **Transfer tickets**. It says tickets sent.
  3. Booking B leaves your list, and its tickets no longer open offline.
- [ ] **On the second account:** the tickets show in its Bookings, and its live code works.
- [ ] **Lost connection** (with another ticket you can spare): turn on airplane mode right after Transfer, then **Check again** once back online. It ends on "Tickets sent", never an error.

## Part E. Write a review (about 5 min)

- [ ] **On the past event or stay:** Manage booking → **Write a review**.
  - Stars show a word under them ("Very good").
  - The comment needs at least 10 characters and has a counter.
- [ ] **Post:**
  - "Thanks, your review is live", and the button changes to **Reviewed**.
  - The review shows on the listing's page in Explore.
- [ ] **Not yet eligible:** an upcoming booking shows no **Write a review**.

## Part F. Comfort (about 5 min)

- [ ] **Largest text:** sheets scroll, and the buttons stay on screen.
- [ ] **TalkBack:**
  - Stars read "Rating, 4 of 5, Very good".
  - The Cancel and Transfer buttons are announced clearly.
- [ ] **Live tickets** still refresh about every 30 seconds, and admitted tickets say so.

---

## Clean up

- [ ] **Bookings A and C:** cancel them in the app (or refund them on the web if the app can't).
- [ ] **On the second account:** cancel or refund Booking B's transferred tickets.
- [ ] **Check the web:** nothing from this test is still active.

## Tell me

- Any box you couldn't tick: what happened instead.
- What the refund messages said for D and E, and whether the money actually came back.
- Whether the claim email arrived quickly, and in which folder.
- Anything confusing in Manage booking.
