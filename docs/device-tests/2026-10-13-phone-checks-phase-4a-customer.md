# Phone checks for customer bookings and tickets (Phase 4a)

**Build:** the Android preview build made after Phase 4a merges (link in the PR). It adds two native modules (screen brightness, screen-capture blocking), so an older build won't do.
**Phones:** Moto G06 as the customer. A second phone signed in as gate staff and one as a receptionist, for the "admitted" and "check-in code" checks.
**What's new:**

- A customer now lands on **Bookings**, with tabs **Bookings · Account**.
- Bookings shows hotel, apartment and event bookings.
- Event tickets have a **live code**; hotel stays have a **check-in code**.
- Notifications are behind the bell.
- Account lets you edit name, phone, state and address.

Run the parts in order. Tick each box and note anything odd: what you did, what you saw, roughly when. Screenshots help, except on the code screens, which block them on purpose.

---

## Before you start

- [ ] Sign in as the **QA customer** (never a real customer).
- [ ] On the web, signed in as the QA customer, book and **pay** for:
  - **Event A:** an event that accepts printed tickets, with **2 tickets**.
  - **Event B (if available):** an event set to **live tickets only**.
  - **Hotel C:** a hotel stay starting today or tomorrow.
- [ ] Keep one unpaid booking too: start a booking on the web and leave it unpaid.
- [ ] Have the gate staff account assigned to Event A, and a receptionist for Hotel C's hotel.
- [ ] Decide how you'll refund or cancel these afterwards, so nothing is left behind.

## Part A. Bookings list (about 5 min)

- [ ] Signing in lands on **Bookings**. Bookings happening today sit in a card at the top.
- [ ] **Upcoming (n)** lists A, B and C. Each row shows:
  - a date tile
  - the kind with its icon ("Event", "Hotel stay")
  - what's next ("Sat 18 Oct · 7:00 pm", "Check-in Thu 15 Oct from 2:00 pm")
  - a status chip
- [ ] The unpaid booking says **Pending payment** and "Finish paying on bookhushly.com", which opens the website inside the app.
- [ ] **Past** shows older bookings, newest first.
- [ ] Pull down to refresh.

## Part B. Event ticket (about 10 min)

- [ ] Open Event A → **Show tickets**.
  - The screen goes bright and white, with a large QR.
  - "Ticket 1 of 2", dots, and Previous / Next.
- [ ] The ring counts down and **the QR changes about every 30 seconds**. The clock under it ticks every second.
- [ ] Swipe slowly to ticket 2. Its code appears and keeps refreshing (only the ticket on screen refreshes).
- [ ] Try to take a **screenshot**. It's blocked, or saves a blank image.
- [ ] **Offline, Event A:**
  1. Turn airplane mode on.
  2. The current code stays for up to about a minute.
  3. Then it switches to an **offline code** with the note "Offline code — it works at the door".
- [ ] **Offline, Event B (live only):** with airplane mode on, it says to connect to the internet. **No QR** is shown.
- [ ] **Admitted:** with the second phone (gate staff), scan ticket 1. Within a refresh, the customer's ticket 1 says **"Admitted at …"** and stops changing.
- [ ] Leave the ticket screen. Brightness goes back to normal.

## Part C. Hotel check-in code (about 5 min)

- [ ] Open Hotel C → **Show check-in code**.
  - Bright white screen with a QR, the code as "AB12 CD34", the dates, and "Show this at the front desk".
- [ ] Screenshots are blocked here too.
- [ ] Scan it with the **receptionist** phone (front desk → Check in a guest → Scan QR). The booking preview opens.
- [ ] After the desk checks the guest in, the customer's code screen shows **"Checked in"** (after a refresh).
- [ ] The unpaid hotel booking (if you have one) shows **no** check-in code.

## Part D. Offline (about 5 min)

- [ ] With the bookings loaded, turn airplane mode on and **close and reopen the app**.
  - Bookings shows a grey "Showing saved bookings — last updated …" note.
  - Upcoming bookings and Event A's tickets still open.
- [ ] Past says it shows when you're back online.
- [ ] Turn airplane mode off and pull to refresh. The note goes away.

## Part E. Notifications (about 5 min)

- [ ] The bell shows a number when there are unread notifications.
- [ ] Open the list:
  - Unread rows are bold with a dot.
  - Tapping one marks it read and opens the related booking (or the Bookings tab).
- [ ] **Mark all as read** → "All marked as read" with **Undo**. Undo brings the unread ones back.
- [ ] Long-press → **Delete** removes it.

## Part F. Account (about 5 min)

- [ ] Account shows your initials, name and email, and the mode switcher if you have another mode.
- [ ] Edit **Phone**:
  - `0803 123 4567` saves.
  - `12345` says to enter a Nigerian number.
  - Clearing it removes it.
- [ ] Edit **State** (search works) and **Address**. Check the change on the web profile.
- [ ] Help, Terms and Privacy open the website inside the app.
- [ ] **Sign out wipes saved tickets:**
  1. Sign out.
  2. Turn airplane mode on.
  3. Sign in again: no bookings are shown from before.
  4. Turn airplane mode off.

## Part G. Comfort and accessibility (about 5 min)

- [ ] **Largest text:**
  - Rows, ticket and code screens stay usable.
  - The QR still fits.
  - Edit sheets scroll.
- [ ] **TalkBack:**
  - Status chips are read as words.
  - The bell reads "Notifications, 3 unread".
  - The ticket pager reads "Ticket 2 of 3".
  - The live clock doesn't chatter.
- [ ] **Remove animations:** the pager jumps instead of sliding, and the ring is static.

---

## Clean up

- [ ] Refund or cancel bookings A, B, C and the unpaid one the usual way on the web.
- [ ] Check out the hotel guest on the receptionist phone if you checked them in.

## Tell me

- Any box you couldn't tick: what happened instead.
- Whether the gate accepted the live code every time, and how fast "Admitted" appeared.
- Whether screenshots were blocked or saved blank on this phone.
- Anything that felt slow, confusing or hard to read.
