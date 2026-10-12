# Phone checks for the front desk (Phase 3)

**Build:** the Android preview build made after Phase 3 merges (link in the PR).
**Phones:** Moto G06, plus a second phone (any) for the "two desks at once" check. A tablet is optional; if you have one, do Part A on it too.
**What's new:** receptionist mode. A front-desk account now opens on **Today**, with tabs **Today · Guests · Rooms**. Staff check guests in by typing or scanning their code, check them out, move a booking to another room, and change room status.

The front desk is online-only. With no connection it says it couldn't confirm or couldn't load. It never says a guest was refused because the network dropped.

Run the parts in order. Tick each box and note anything odd: what you did, what you saw, roughly when. Screenshots help.

---

## Before you start

- [ ] **Create the receptionist through the real flow:** on the web, sign in as the hotel's vendor → your hotel → **Staff** → add a receptionist with an email you can read. The password is shown **once**; keep it somewhere private, not in chat.
- [ ] The hotel has **at least 4 rooms**, so each status case can be tried.
- [ ] Book, as a customer, and **pay** (Paystack test mode if you use it):
  - **Booking A**, checking in **today**.
  - **Booking B**, checking in **tomorrow** (for the early-arrival check).
  - **Booking C**, checking in today; you'll use it for the "two desks" check.
- [ ] Note each booking's 8-character check-in code (on the customer's booking page; the QR there carries the same code).
- [ ] Decide how you'll cancel or refund the test bookings afterwards (as you do on the web today), so nothing is left behind.

## Part A. Sign in and Today (about 5 min)

- [ ] Signing in with the receptionist lands on **Today**, showing the hotel name and today's date.
- [ ] The four counts (**Arriving, In house, Leaving, Free rooms**) match the web dashboard.
- [ ] Tapping **Arriving** opens Guests on the Arriving tab. Tapping **Free rooms** opens Rooms filtered to Available.
- [ ] The **Account** button shows the email and hotel, **Shift activity** and **Sign out**. There is **no** Delete account.
- [ ] **Tablet only:** the tabs sit in a rail on the left, and Guests shows the list and the details side by side.

## Part B. Check in by code (scenario 16, about 5 min)

- [ ] **Check in a guest** → type Booking A's code in **lower case**. **Find booking** shows the guest, dates, room and "Paid".
- [ ] **Check in** shows a green tick and "Checked in · Room …", with a buzz.
- [ ] On **Rooms**, that room now says **Occupied**. On the web it shows checked in.
- [ ] **Shift activity** lists "Checked in …".

## Part C. Scan a QR (about 5 min)

- [ ] **Check in a guest** → **Scan QR**. The first time, "Allow camera to scan check-in codes" appears **before** Android asks.
- [ ] Scanning Booking C's QR from the customer's phone opens its preview straight away. **Don't** check it in yet; press **Cancel**.
- [ ] Scanning an **event ticket** QR says "That's an event ticket, not a hotel check-in code".

## Part D. Refusals and lost connections (scenarios 17–21, about 15 min)

- [ ] **17, another hotel:** a code from a different hotel says "No booking with code … at <your hotel>".
- [ ] **18, already in:** Booking A's code again says "Already checked in at …".
- [ ] **19, unpaid:** an unpaid booking (start a booking and don't pay) says payment hasn't been completed, with no Check in button.
- [ ] **20, early:** Booking B shows a blue note: "Booked for … — 1 day early. You can still check them in." You can check them in. (Afterwards, check B out again in Part F.)
- [ ] **21, two desks:** on both phones, open Booking C's preview, then press **Check in** on both at the same moment. One shows "Checked in". The other shows "Already checked in at …" (after a moment of "Checking…"). The web shows one check-in.
- [ ] **Lost connection:** on a confirmed booking, press Check in and switch **airplane mode on within a second**.
  - You see "Couldn't confirm the check-in…" in **grey**, never red.
  - Airplane mode off → **Check again** says "Checked in" (or, if it never went through, lets you press Check in again).
- [ ] **Network down at lookup:** with airplane mode on, Find booking says it couldn't look up the code, in grey.

## Part E. Choose another room (about 5 min)

- [ ] Set a confirmed booking's room to **Maintenance** (on Rooms).
- [ ] Opening its preview shows a note that the room is under maintenance. If the server refuses the check-in, it offers **Choose another room**.
- [ ] **Choose another room** stays inside the same sheet. Same-type rooms come first.
- [ ] **Move** → the preview shows the new room → **Check in** works.

## Part F. Check out (about 5 min)

- [ ] Open an in-house guest → **Check out**. The sheet says "Room … will be marked dirty". For a guest leaving before their date it shows "Booked until … — leaving N days early."
- [ ] **Check out** → "Checked out". On Rooms the room says **Dirty**. Activity lists it.
- [ ] **Leaving** on Guests lists guests due out today, and overdue ones.

## Part G. Rooms (scenario 22, about 5 min)

- [ ] An **occupied** room's sheet names the guest and says to check them out first. There is no Save.
- [ ] Change a Dirty room to **Available** → Save.
  - Today's **Free rooms** goes up.
  - On the second phone the change appears within about 30 seconds without pulling to refresh.
- [ ] Filter chips show counts, and the selected chip is a light violet.

## Part H. Comfort and accessibility (about 5 min)

- [ ] **Largest text and display size:**
  - Sheets scroll.
  - Check in / Check out stay on screen.
  - The tab labels can still be read.
- [ ] **TalkBack:**
  - The count cells read like "Arriving, 2".
  - "Checked in" and refusals are read out.
  - Room options read as radio buttons.
- [ ] **Pull to refresh** works on Today, Guests and Rooms.

---

## Clean up

- [ ] Check out every test guest you checked in.
- [ ] Cancel or refund bookings A, B, C and the unpaid one the usual way.
- [ ] Set any room you changed back to its real status.
- [ ] If the receptionist account was only for testing, remove it from the hotel's Staff panel on the web.

## Tell me

- Any box you couldn't tick: what happened instead (a screenshot if you can).
- Whether "two desks at once" gave exactly one check-in.
- Whether live updates on the second phone took longer than about 30 seconds. If they did, Realtime is probably off for these tables (web ask (h)).
- Anything that felt slow, confusing or hard to read at the desk.
