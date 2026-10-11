# Phone checks for the 9 October build (redesign + accounts)

**Build:** Android preview, https://expo.dev/accounts/dnl-bookhushly/projects/book-h/builds/d54345f7-fce7-446b-8430-cab1fcf326b8
**Phone:** Moto G06. A second Android phone helps for one gate check. Items marked **(iPhone)** need an iOS build and can wait for it.
**What changed in this build:**

- **Redesign (UI-A):** every gate screen was redesigned.
- **Accounts (UI-B):** new welcome screen, create account, email code, forgot password, delete account.

The scanning logic itself did not change, so part A is a short check that nothing broke.

Run the parts in order. Tick each box and note anything odd: what you did, what you saw, roughly when. Screenshots help.

---

## Before you start

- [ ] Uninstall the old build, then install this one.
- [ ] Have these ready:
  - **Scanner account:** the gate staff account you used before, assigned to a test event.
  - **QA customer:** used only to sign in and to book a ticket.
  - **Two throwaway email addresses you can read on the phone.** You will create accounts with them and delete those accounts at the end. Don't use your real address.
  - **A test event with a few tickets.** One of them must be booked after you download the offline list, for the "not in offline list" check.
- [ ] The web test event still has its **offline override PIN** (or generate a new one and note it).

---

## Part A. Signed out: welcome and sign in (about 5 min)

- [ ] **First screen:** opening the app signed out shows the Welcome screen with **Create account** (first) and **Sign in**.
- [ ] **Links:** Terms and Privacy open the bookhushly.com pages.
- [ ] **Picture:** the Welcome illustration looks right; nothing overlaps the text or the buttons.
- [ ] **Sign in:** Sign in opens. The eye icon shows and hides the password. Tapping right next to the eye still lets you type in the password field.
- [ ] **Wrong password:** a wrong password says the email or password isn't right, in red.
- [ ] **Airplane mode:** with airplane mode on, Sign in says it couldn't reach Bookhushly **in grey, not red**. Turn airplane mode off.
- [ ] **Slow start:** after signing in on a weak connection, you see "Loading your account…" rather than a frozen splash screen.

## Part B. Gate scanning still works (about 15 min)

Sign in as the **scanner account**.

- [ ] **Event list:**
  - Events show date tiles and "Live now" / "Today" / "Upcoming" pills.
  - Pull down to refresh.
  - The account button (top right) shows your email, the mode switch (if you have two modes) and Sign out.
- [ ] **Camera permission:** the first time you open the scanner, you see "Allow camera to scan tickets" **before** Android asks.
  - **Enter codes by hand** opens Enter code without the camera.
  - Then allow the camera.
- [ ] **Scanner:**
  - The camera is dark full-screen.
  - The door counter is big enough to read at arm's length.
  - There is one status pill under the counter.
  - There are three buttons at the bottom: Torch, Find guest, Enter code.
- [ ] **Recent and Activity:** tapping the door counter opens Recent; tapping the status pill opens Activity.
- [ ] **Admitted:** a valid live code shows a **green** screen with a tick, a sound and a buzz, and the counter goes up.
- [ ] **Already used:** the same code again shows **amber** "Already used" with the time.
- [ ] **Refused:** a printed QR on the live-ticket event (or a ticket from another event) shows **red** "Refused" with the reason. "Ask for the live ticket" is red too, not amber.
- [ ] **Couldn't check:** scanning in very weak signal shows **grey-violet**, never red.
- [ ] **Titles:** result titles are in the plain font, not the serif font.
- [ ] **Offline:**
  1. After the offline list downloads, the event list shows **"Offline list ready"** when you go back. You shouldn't need to restart the app.
  2. Turn airplane mode on and admit a ticket. It shows "Offline · will sync".
  3. The status pill says "Offline · 1 to sync".
  4. Turn airplane mode off. The pill goes back to Online and Activity shows the admission as synced.
- [ ] **Find guest:**
  - Search the QA customer's phone digits.
  - The **Not in / In** tabs show counts.
  - Admit from the booking view (the PIN is needed on a live-ticket event).
  - A tab with nobody in it says so instead of being blank.
- [ ] **Override:**
  - Offline, scan the ticket booked after the list download. You get "Not in offline list".
  - Use **Supervisor override**, enter the PIN in the six boxes, the approver and a reason.
  - Result: Admitted, marked "Override · will sync".
- [ ] **Keyboard:** in the PIN sheet and Enter code, the keyboard never covers the Confirm / Check ticket button, and there's no big empty gap above the keyboard.
- [ ] **Sign out with something unsynced:** offline, admit a ticket, then Sign out from the account sheet. The "hasn't synced" warning appears. Go back online and sync.

## Part C. Create an account (about 10 min)

Sign out. Use **throwaway email 1**.

- [ ] **Create account:** from Welcome, tap Create account.
  - The password checklist ticks each rule as you type.
  - Create account stays disabled until every rule is met.
- [ ] **Code email:** you get an email with a 6-digit code. The code screen shows your email partly hidden, with **Change**.
- [ ] **Resend:**
  - "Send a new code" is greyed out with a countdown for 60 seconds.
  - Then it sends a new code. The **old code no longer works**.
- [ ] **Wrong code:** typing a wrong code says "That code is wrong or has expired" and clears the boxes.
- [ ] **Try again:**
  1. Turn airplane mode on and type the right code. You get "couldn't reach Bookhushly", in grey.
  2. Turn airplane mode off and tap **Try again**.
  3. The same code is checked without retyping.
- [ ] **Signed in:** entering the right code signs you in to the customer screen.
- [ ] **Existing email:**
  1. Sign out.
  2. Tap Create account and use the **QA customer's email**.
  3. You get "This email already has an account", with **Sign in instead** and **Verify this email**.

## Part D. Forgot and reset password (about 5 min)

Use the throwaway 1 account.

- [ ] **Reset:** Sign in → Forgot password → enter the email → enter the code → set a new password. You're signed in.
- [ ] **New password works:** sign out and sign in with the new password.
- [ ] **Cancel the reset:** start a reset again. After the code, press **Cancel** on New password. You're signed out and back on Welcome.
- [ ] **Close the app mid-reset:** start a reset once more. After the code, **close the app** on New password and reopen it. You're signed out, not signed in.

## Part E. Delete accounts (about 10 min)

- [ ] **Wrong password:** signed in as throwaway 1, go to Account → Delete account. A wrong password says so.
- [ ] **Delete:** the correct password plus typing DELETE deletes the account.
  - You land on Welcome with "Your account was deleted".
  - Signing in with that account again says it was closed.
- [ ] **Network cut mid-delete:**
  1. Create an account with **throwaway email 2** and sign in.
  2. Go to Delete account, enter the password and DELETE.
  3. Press Delete account and switch **airplane mode on within about a second**. It says it couldn't reach Bookhushly.
  4. Turn airplane mode off and press Delete account again.
  5. You end on Welcome with "Your account was deleted", **never** "That password isn't right".
- [ ] **Blocked delete (only if you have such an account):** an account with an upcoming confirmed booking shows why it can't be deleted and is not deleted.
- [ ] **Gate staff:** signed in as the scanner account, the account sheet shows Delete account.
  - With an unsynced admission it warns first.
  - **Back out, don't delete the scanner account.**
- [ ] **Receptionist (if you have one):** a receptionist account doesn't show Delete account.

## Part F. Comfort and accessibility (about 10 min)

- [ ] **Sunlight:** outdoors, the outcome screens, the door counter and the status pill are readable.
- [ ] **Large text:** set the largest font and display size (Settings → Display).
  - The scanner's three bottom labels stay readable.
  - Outcome buttons stay on screen.
  - Long status-pill text (for example "… · 3 to sync") isn't cut off.
  - Sheets and account screens scroll.
- [ ] **Remove animations** (Settings → Accessibility): sheets appear without sliding, and buttons don't shrink when pressed. With it off, buttons shrink slightly when pressed.
- [ ] **One hand:** Torch, Find guest and Enter code are reachable with the thumb of the hand holding the phone.
- [ ] **TalkBack:** with TalkBack on:
  - The status pill is read out when it changes (for example going offline), not every minute.
  - Error and info banners on the account screens are read out.
- [ ] **Long session:** 10 minutes of steady scanning: no slowdown, no stuck sheet.

## Part G. iPhone only (when an iOS build is ready)

- [ ] **Code autofill:** the code from the email is offered above the keyboard.
- [ ] **Open email app:** the code screen shows **Open email app**, and it opens Mail.
- [ ] **Gate sheet → Delete account:** from the scanner account sheet, tapping Delete account closes the sheet and opens the Delete account screen. Try it three times.
- [ ] **VoiceOver outcomes:** with VoiceOver on, scan results are read out when they appear.
- [ ] **VoiceOver feedback:** a wrong code, "Verifying…", "couldn't reach" banners and the password checklist are read out.
- [ ] **VoiceOver Admit:** with VoiceOver on, the **Admit** button in Find guest → Booking can be reached by swiping, separately from the guest's row.
- [ ] **Keyboard:** in the PIN sheet and Enter code, the button stays above the keyboard.

---

## Tell me

- Any box you couldn't tick: what happened instead (a screenshot if you can).
- Whether the throwaway accounts were deleted (so no test data is left behind).
- Anything that felt slow, confusing or hard to read at the door.
