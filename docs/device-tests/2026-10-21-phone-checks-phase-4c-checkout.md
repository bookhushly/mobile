# Phone checks for booking and paying in the app (Phase 4c)

**Build:** the Android preview build made after Phase 4c merges (link in the PR).
**Phones and accounts:**

- The Moto G06 signed in as the **QA customer**. An iPhone too, if you have one: repeat Parts A and C on it.
- Paystack is in **test mode** on production. Use only test cards: open Paystack's test-cards page and use its **success** card and its **declined** card. Real cards are never needed.
- Access to the **Paystack test dashboard** (to check there is one charge, not two) and to bookhushly.com signed in as the same customer.

**What's new:**

- **Get tickets** on an event, then pick tickets, then **Review and pay**, all inside the app.
- **Pay ₦…** opens Paystack in the app. A **Checking your payment** screen waits for the server, then **You’re booked**.
- **Pay now** on an unpaid booking in Bookings.
- Hotels and apartments are included too, but only once the switch is flipped (Part H).

Everything you book here must be cancelled or refunded by the end. The last part lists how.

---

## Before you start

- [ ] Pick a **paid event** with at least 2 tickets left, and a **free event** (Booking B). If there isn't a free one, skip Part B and tell me.
- [ ] Pick an **event with a Standard and a VIP package**, if one exists, for the quantity check in Part A.
- [ ] For Part E, use a **paid event** while stays are switched off. Once stays are on (Part H), use a **hotel or apartment** with dates a week or more away.

## Part A. Pay for an event (about 10 min)

- [ ] Open the paid event in Explore. The button reads **Get tickets**.
- [ ] **Select screen:**
  1. Choose **2 tickets**. The bottom line reads the choice back (for example "2 tickets · ₦…").
  2. Your name, email and phone are filled in. Change one and check it sticks.
  3. Any questions from the organiser must be answered before you can go on.
  4. Tap **Continue**.
- [ ] **Review and pay:**
  1. It shows the event, your details and **Price details**. The total is the server's.
  2. The button reads **Pay ₦…** with the same total.
- [ ] Tap **Pay**. Paystack opens in the app. Pay with the **success test card** (any future expiry; if it asks for a PIN or code, use the test values Paystack lists).
- [ ] Back in the app it says **Checking your payment**. Note how many seconds it takes.
- [ ] **You’re booked:**
  1. It shows the event, the time and "Confirmation sent to" your email, partly hidden.
  2. Tap **View tickets**: both tickets are there and the **live code** moves.
  3. Go back and tap **Done**: you land on Explore.
- [ ] **Bookings** lists the booking as paid. **On the web** it shows paid too.
- [ ] **Paystack dashboard:** one successful test charge.

## Part B. Free event (about 3 min)

- [ ] Open the free event, **Get tickets**, choose 1 ticket, **Continue**.
- [ ] It goes straight to **You’re booked** with no payment step.
- [ ] **View tickets** shows a live code.

## Part C. Close the app while paying (about 10 min)

- [ ] Start a paid event booking as in Part A and tap **Pay**. On the Paystack page, pay with the success test card.
- [ ] **Straight after paying**, swipe the app away from recent apps (don't wait for the app to come back).
- [ ] Reopen the app. Open **Bookings** (give it a minute, and pull down to refresh).
- [ ] The booking shows **paid**. While it was still working it may have said **Checking your payment…**.
- [ ] **Paystack dashboard:** only **one** charge for this booking. If there are two, tell me at once.
- [ ] **Second try, before paying:** start a booking, tap **Pay**, close the app on the Paystack page without paying, reopen. Open the booking from Bookings. It must not start a second charge silently: **Pay now** or **Check again** only.

## Part D. Payment fails (about 5 min)

- [ ] Start a paid event booking and tap **Pay**. Pay with the **declined test card**.
- [ ] The app shows **Payment didn’t go through. You weren’t charged.** with **Try again** and **Go to Bookings**.
  - If it says **We’re still checking. If you paid, it’ll show in Bookings shortly.** first, that is fine; tap **Check again** until it changes or note what it said.
- [ ] **Try again** goes back to Review. Pay with the **success card** this time and finish: **You’re booked**.
- [ ] **Paystack dashboard:** one failed and one successful test charge.

## Part E. Back out of Review (about 5 min)

- [ ] Start a booking for a hotel or apartment **a week or more away** and reach **Review and pay**. (If stays are still switched off, use a paid event instead.)
- [ ] Leave with **Cancel booking** (or the back button). Never tap **Pay**.
- [ ] **On the web**, signed in as the QA customer: the booking shows **cancelled**.
- [ ] **Not now:** for a booking where nothing would be cancelled (one you started paying for), the button reads **Not now** and the booking stays.

## Part F. Pay now from Bookings (about 5 min)

- [ ] Start a paid **event** booking, reach Review, close the app **before** tapping Pay. (Events have no hold, so it stays pending.)
- [ ] Reopen. In Bookings, the booking says **Finish paying to confirm this booking** with **Pay now**.
- [ ] **Pay now** opens Review. Pay with the success card: **You’re booked**.
- [ ] A stay older than the hold (see Part H) says **This hold has ended** with **Book again** instead.

## Part G. Comfort (about 5 min)

- [ ] **Largest text:** on Select, Review and You’re booked, text is readable, screens scroll and **Continue**, **Pay** and **Done** stay on screen.
- [ ] **TalkBack:**
  1. On Select, ticket steppers say what they change and the current number.
  2. On Review, the **Pay ₦…** button reads its amount.
  3. On You’re booked, the heading is read and the buttons are announced in order.
- [ ] **Airplane mode:**
  1. Turn it on and tap **Continue** on Select. It says **Couldn’t confirm your booking** with **Check again**.
  2. Turn it off and tap **Check again**.
  3. Don’t assume nothing was booked: look in Bookings, or on the web, to see whether a booking exists.

## Part H. Stays (only after the owner flips the switch)

Hotels and apartments are **off** until web PR #221 is live and `CHECKOUT_STAYS_ENABLED` is turned on. Until then, the listing keeps its old hand-off to bookhushly.com. **Skip this part and tell me so.**

- [ ] **Hotel with breakfast:**
  1. Choose a room type, then dates. The footer shows nights and a price.
  2. Add breakfast for 1 or 2 guests. The total goes up on Review.
  3. Pay with the success card: **You’re booked**, with **View booking**.
- [ ] **Apartment with a minimum stay:** pick fewer nights than the minimum. It says "At least … nights" and **Continue** stays off. Pick enough nights and book.
- [ ] **Hold ended:**
  1. Start a hotel booking and stop on Review. It says "We’re holding this for you until …".
  2. Wait **25 minutes** (don't leave Review).
  3. **Pay** is replaced by **Start again**, and it says **This hold has ended. Start again to book these dates.**

---

## Clean up

- [ ] **Every paid test booking** (Parts A, C, D, F, H): cancel or ask for a refund in the app, or refund it on the web.
- [ ] **Free booking (Part B):** cancel it.
- [ ] **Every unpaid or pending booking** left behind (Part C second try, Part E, Part F, Part G, Part H hold ended): open it in Bookings and cancel it, or confirm on the web that it shows **cancelled**. Nothing may stay active.
- [ ] **Paystack test dashboard:** nothing left half-open.
- [ ] **Check the web:** no test booking is still active or pending.

## Tell me

- Any box you couldn't tick: what happened instead.
- What each payment screen said (checking, failed, still checking, booked), word for word if it differs from above.
- How many seconds **Checking your payment** took, for the success card.
- Whether the Part C reopen showed paid on its own, and whether Paystack showed one charge.
- Anything confusing on Select or Review.
