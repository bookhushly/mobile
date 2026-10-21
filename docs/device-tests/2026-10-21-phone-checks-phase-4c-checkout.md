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
- Hotels and apartments too (Part H): stays are switched on.

Everything you book here must be cancelled or refunded by the end. The last part lists how.

---

## Before you start

- [ ] Pick a **paid event** with at least 2 tickets left, and a **free event** (Booking B). If there isn't a free one, skip Part B and tell me.
- [ ] Pick an **event with a Standard and a VIP package**, if one exists, for the quantity check in Part A.
- [ ] For Part E, use a **hotel or apartment** with dates a week or more away.

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
- [ ] Back in the app it says **Checking your payment** and **This can take a few minutes**. Note how many seconds it takes.
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
- [ ] **Second try, before paying:** start a booking, tap **Pay**, close the app on the Paystack page without paying, reopen. Open the booking from Bookings. It must not start a second charge silently: at first it shows **Checking your payment…** with no button; later (once that payment is settled or 15 min old) **Pay now**.

## Part D. Payment fails (about 10 min, plus an optional 15-min wait)

A payment that started less than 15 minutes ago is never called a failure: a bank transfer or USSD can take minutes to land.

- [ ] Start a paid event booking and tap **Pay**. Pay with the **declined test card**, then close the Paystack page.
- [ ] The app shows **We couldn’t confirm this payment yet.** and **If you paid by bank transfer or USSD it can take a few minutes. Check Bookings before paying again.** with **Check again** and **Go to Bookings**. It must never say "You weren’t charged".
  - If it says **We’re still checking. If you paid, it’ll show in Bookings shortly.** instead, that is fine too; note which one you saw.
- [ ] **Bank transfer or USSD (if Paystack test mode offers it):** start another booking, choose transfer or USSD on the Paystack page, come back to the app before it completes. It shows **We couldn’t confirm this payment yet.** (or still checking), never a failure. Cancel that booking at the end.
- [ ] **Optional, after 15 minutes:** on the screen above, wait 15 minutes and tap **Check again**. If the server now says the payment failed, it shows **Payment didn’t go through.** and **If money left your account, it’ll be confirmed or refunded — check Bookings.** with **Try again** and **Go to Bookings**.
  - **Try again** goes back to **Review and pay**; nothing opens until you tap **Pay**. Pay with the **success card**: **You’re booked**.
- [ ] **Review warning:** when you reach Review for a booking whose last payment started under 15 minutes ago, it says **If you already paid by bank transfer or USSD, wait a few minutes — paying again could charge you twice.** above Pay.
- [ ] **Paystack dashboard:** one failed and (if you did the optional step) one successful test charge, never two successful ones.

## Part E. Back out of Review (about 5 min)

- [ ] Start a booking for a hotel or apartment **a week or more away** and reach **Review and pay** straight from Select.
- [ ] Leave with **Cancel booking** (or the back button). Never tap **Pay**.
- [ ] **On the web**, signed in as the QA customer: the booking shows **cancelled**.
- [ ] **Not now:** for a booking where nothing would be cancelled (one you started paying for, or one opened with **Pay now** from Bookings), the button reads **Not now** and the booking stays.

## Part F. Pay now from Bookings (about 5 min)

- [ ] Start a paid **event** booking, reach Review, close the app **before** tapping Pay. (Events have no hold, so it stays pending.)
- [ ] Reopen. In the Bookings list the row reads **Finish paying to confirm**. Open it: the booking details say **Finish paying to confirm this booking** with **Pay now**.
- [ ] **Pay now** opens Review with **Not now** (not Cancel booking). Press back once: you are back on the booking and it is **still pending**, not cancelled.
- [ ] **Pay now** again. Pay with the success card: **You’re booked**.
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

## Part H. Stays (about 35 min, most of it waiting)

Hotels and apartments are switched on (web #219/#221 are live).

- [ ] **Hotel with breakfast:**
  1. Choose a room type, then dates. The footer shows nights and a price.
  2. Add breakfast for 1 or 2 guests. The total goes up on Review.
  3. Pay with the success card: **You’re booked**, with **View booking**.
- [ ] **Apartment with a minimum stay:** in the dates sheet, pick fewer nights than the minimum. The sheet says "At least … nights" and its **Choose** button stays off, so a short stay can't be picked. Pick enough nights and book.
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
