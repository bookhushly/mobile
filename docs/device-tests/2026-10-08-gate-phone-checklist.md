# Gate scanning: phone checks for the new build

**Build:** Android preview, https://expo.dev/accounts/dnl-bookhushly/projects/book-h/builds/1c675070-0259-42fd-bb72-4a0f509f2b02
**Phone:** Moto G06 (a second Android phone for the two-phone tests).
**Covers:** Phase 1 (online), Phase 2a (offline), Phase 2b (lookup, override, activity, shift summary), the UI-A redesign (section 8) and accounts (UI-B, section 9).

Tick each box and note anything odd next to it: what you did, what you saw, and roughly when. Screenshots help.

---

## 0. Before you start

- [ ] Uninstall the old preview build, then install this one. The encrypted database is new, so start clean.
- [ ] **On the web**, as the vendor, set up the test event:
  - [ ] A public test event with **"require live ticket"** turned on, and a few free tickets.
  - [ ] A second test event (normal, live ticket not required), for the printed-code tests.
  - [ ] The scanner account assigned to both events (Gate staff tab).
  - [ ] **Offline override PIN** generated for the live-ticket event. Note it down, because it is shown only once.
- [ ] **As the QA customer**, book tickets on both events:
  - one booking with 2 tickets;
  - a few single tickets;
  - one booking left **unpaid/pending**, if the flow allows it.
- [ ] Keep the QA customer's tickets open on a second device (laptop or phone) so you can show live codes.
- [ ] Sign in on the Moto G06 as the **scanner** account.

---

## 1. Online scanning (Phase 1)

Do these with Wi-Fi or data **on**.

- [ ] **Event list** shows both test events, soonest first. Tapping one opens the scanner.
- [ ] **Valid live code** → green **Admitted**, a sound and a buzz, and the door counter goes up by 1.
- [ ] **Same code again on this phone** → amber **Already used — on this phone**, shown instantly.
- [ ] **Same ticket on a second phone** (signed in as a scanner) → **Already used**, with the time and the first phone's name.
- [ ] **Code left on screen past ~90 s** without refreshing → **Refused — code expired, ask them to refresh**. Refresh the ticket and scan again → Admitted.
- [ ] **Printed/static code** (the QR from the booking email or PDF) on the **live-ticket** event → **Refused — ask for the live ticket**.
- [ ] **Ticket from the other event** → **Refused — this ticket is for a different event**.
- [ ] **Two-ticket booking**: scan ticket 1 → "ticket 1 of 2 · 1 of 2 on this booking are in". Scan ticket 2 → "2 of 2".
- [ ] **Bad network** (very weak signal, or turn data off mid-scan) → **Couldn't check — try again** in grey. It must never be a red refusal.
- [ ] **Mute** (sound icon) stops the beeps but keeps the buzz.
- [ ] **Torch** works in a dark room. **Enter code** accepts a pasted ticket link or ID.
- [ ] **Recent** lists the last admissions, with "By me" on yours.
- [ ] The **screen stays on** while the scanner is open.

---

## 2. Offline list and sync bar (Phase 2a)

- [ ] On opening the scanner online, the **sync bar** shows "Downloading offline list…", then "Online · offline list N · just now".
- [ ] **"Refresh list"** works and the time resets to "just now".

### Airplane mode

Download the list first, then turn airplane mode **on**.

- [ ] **Precheck, live code offline:** scan a fresh live code.
  - **Admitted** with the tag **"Offline · will sync"** → good, carry on.
  - **"Can't check this code offline"** → the server is still issuing old-format codes. Stop the offline live-code tests and tell me; the web needs `TICKET_TOKEN_FORMAT=2`.
- [ ] Offline admission feels **instant** (target under 0.15 s from the camera seeing the code).
- [ ] The sync bar says **"Offline · deciding on this phone · N to sync"**.
- [ ] **Same ticket again offline** → **Already used — by you**.
- [ ] **Printed code on the live-ticket event offline** → **Refused — ask for the live ticket**.
- [ ] **Printed code on the normal event offline** → **Admitted (offline)**.
- [ ] **Ticket bought after the list was downloaded** (book a new one on the laptop while the phone is offline) → **Refused — Not in offline list**, with "Offline list updated N min ago".
- [ ] **Door counter** shows the local count with an "offline" caption.

### Crash safety

- [ ] Admit 2–3 tickets offline, then **force-close the app** (swipe it away). Reopen it, still offline → the sync bar still shows them as "N to sync".

### Back online

- [ ] Turn airplane mode **off**. Within about 30 s the bar goes "Syncing…" and then shows nothing waiting.
- [ ] **On the web**, the scan log shows those admissions at the **time you scanned them**, not the sync time.
- [ ] The door counter returns to the server's number.

### Two phones, same ticket

- [ ] Both phones download the list, then both go into airplane mode.
- [ ] Admit the **same ticket on both**.
- [ ] Reconnect both. One phone syncs it normally. The other shows **"1 needs attention"**. Tap it → Activity → **Needs attention** → "Also admitted by <name> at HH:MM".

### Phone clock

- [ ] With the scanner open, set the phone clock **back** by 5+ minutes (Settings → Date & time, automatic off), then return to the app.
  - The bar shows **"Phone time changed — connect to re-check"**.
  - A live code says **Couldn't check — phone time changed**.
  - A printed code on the normal event still works.
- [ ] Set the clock **forward** by 10 minutes → live codes say **"code expired"**. That's expected: it fails safe and never admits.
- [ ] Put the clock back to **automatic** afterwards.
- [ ] **Lock the phone for 10+ minutes** with the scanner open and offline, then unlock and scan a live code → it should be **admitted**, with **no** "time changed" warning.

### Sign-out with unsynced admissions

- [ ] Offline, admit a ticket, then go back to the event list → **Sign out** → blocked: "1 admission hasn't synced" with a **Sync now** button.
- [ ] Turn the network on and tap **Sync now** → it syncs and then signs you out (or tells you what's still waiting).

---

## 3. Find guest (Phase 2b)

- [ ] **Find guest** button on the scanner opens a search sheet, and the camera pauses.
- [ ] Type the **last 2–3 digits** of the QA customer's phone → their tickets appear. Type the **first 4 digits** → same.
- [ ] Type part of a **name** (if the booking has one) → it's found. Capital letters don't matter.
- [ ] Tap a result → the **booking view** lists every ticket on that booking, each marked "In" or "Not in".
- [ ] **Normal event:** tap **Admit** on a not-in ticket → the sheet closes and **Admitted** shows with the tag **"Lookup · will sync"**.
- [ ] **Live-ticket event:** tap **Admit** → the **Supervisor approval** sheet asks for the PIN and an approver name (reason optional). Correct PIN → Admitted.
- [ ] An **unpaid/pending** booking shows its status and **no Admit button**.
- [ ] Typing just "1" or "a" shows the hint "Type a name or 2–4 phone digits".
- [ ] Search speed feels instant. If your test event is small, note the number of tickets.

---

## 4. Supervisor override (Phase 2b)

Offline, on the **live-ticket** event, use a ticket that's **not in the offline list** (bought after the download).

- [ ] The refusal **"Not in offline list"** shows a **"Supervisor override"** button.
- [ ] Tap it. The sheet asks for the **PIN, approver name and reason**, and Confirm stays greyed out until all three are valid (the reason needs 3+ characters).
- [ ] The PIN check shows "Checking…" and finishes in **under 2 s**. Please time this one.
- [ ] Correct PIN → **Admitted** with the tag **"Override · will sync"**.
- [ ] Scan the same code again → **Already used — by you**, and no override offered.
- [ ] Reconnect → it syncs. **On the web**, the scan log shows it as an override with your reason and approver.
- [ ] **Wrong PIN** → "Wrong PIN — N tries left". After **5 wrong tries** → "Override locked — try again in 15 min", and the button disappears.
- [ ] While locked, **sign out and back in** (with nothing waiting to sync) → it is **still locked**.
- [ ] **Override approved more than 5 minutes after the refusal** (wait on the PIN sheet, then confirm) → it still syncs without landing under "needs attention".
- [ ] On the web, **remove the PIN**, then tap **Refresh list** on the phone online → the override button no longer appears.

---

## 5. Activity screen and export (Phase 2b)

- [ ] The sync bar's **"Activity"** link opens the screen. Check the three tabs: **To sync**, **Needs attention** and **Synced**.
- [ ] Lookup and override rows are marked **"Lookup"** / **"Override"**.
- [ ] **Sync now** works from here.
- [ ] **Export CSV** → the Android share sheet opens. Send it to yourself (email or Drive) and open it in a spreadsheet:
  - [ ] Columns: ticket_ref, ticket_type, ticket_number, scanned_at, mode, state, server_note, reason, approved_by.
  - [ ] **No guest names, no phone numbers**, and no full ticket IDs (only 8-character references).
- [ ] Cancel the share sheet once: no error, and you're back on Activity.

---

## 6. Shift summary (Phase 2b)

- [ ] After some scanning, **Sign out** → the dialog shows "This shift: N admitted · N already used · N refused…".
- [ ] **Reset counts** clears the numbers and keeps you signed in.
- [ ] **Sign out** completes as normal.

---

## 7. General feel

- [ ] Nothing is cut off at the top or bottom, including the notch area and the keyboard over the PIN sheet.
- [ ] With **large text** (Android display settings), the gate screens are still usable.
- [ ] A **10-minute session** of steady scanning has no slowdowns, no crashes and no stuck overlays.

---

## 8. Redesign (UI-A)

- [ ] **First scanner open** shows "Allow camera to scan tickets" before Android asks. "Enter codes by hand" opens Enter code without the camera.
- [ ] Deny the camera → "Camera is off for Bookhushly" with **Open settings**; allow it in Settings and return → the camera starts.
- [ ] **Event list:** date tiles, "Live now" / "Today" / "Upcoming" pills, "Offline list ready" on events you have opened before. Pull to refresh works. The account button shows your email, the mode switch (if you have two modes) and Sign out.
- [ ] **Scanner:** dark camera, door counter big enough to read at arm's length, one status pill under it. Tapping the counter opens Recent; tapping the pill opens Activity.
- [ ] **Outcomes:** green Admitted, amber Already used, red Refused (including "ask for the live ticket"), grey-violet Couldn't check. Titles are not in the serif font.
- [ ] **Sunlight:** outdoors, outcomes, the counter and the status pill are readable.
- [ ] **200 % text** (Settings → Display → Font size and Display size at max): the three bottom controls keep readable labels; outcome actions stay on screen; sheets scroll.
- [ ] **One hand:** Torch, Find guest and Enter code are reachable with the thumb holding the phone.
- [ ] **Reduce motion** (Settings → Accessibility → Remove animations): sheets appear without sliding; buttons don't scale.
- [ ] **Keyboard:** in the PIN sheet and Find guest, the keyboard never covers Confirm or the results.
- [ ] **10 minutes of scanning** on the new layout: no slowdown, no stuck sheet, battery drop similar to before.
- [ ] **Press feedback:** buttons shrink a touch when pressed, and not at all with Remove animations on.
- [ ] **PIN keyboard:** tapping the PIN boxes brings up the number keyboard.
- [ ] **Keyboard and buttons:** in the PIN sheet and Enter code (iPhone and Android), the Confirm / Check ticket button stays above the keyboard and there isn't an extra empty gap between the button and the keyboard.
- [ ] **Android sheets:** sheets look right on Android (top edge, Close button reachable, no content under the status bar).
- [ ] **Offline list pill:** after downloading a list in the scanner and going back, the event shows "Offline list ready" without restarting the app.
- [ ] **Sign-out guard:** sign out from the account sheet with an unsynced admission: the "hasn't synced" warning appears.
- [ ] **TalkBack status pill:** with TalkBack on, the status pill is read out when it changes (e.g. going offline), not every minute.
- [ ] **Long status pill:** at the largest text size, the long states (e.g. "2 need attention · 3 to sync", "Time last checked 13 h ago · 1 to sync") still show the whole text including "to sync".
- [ ] **VoiceOver outcomes:** on iPhone with VoiceOver on, an outcome (Admitted, Already used, Refused, Couldn't check) is read out when it appears.
- [ ] **VoiceOver Admit:** with VoiceOver on, the Admit button in Find guest → Booking can be reached by swiping, separately from the guest's row.

---

## 9. Accounts (UI-B)

Use a **throwaway email you own** for these (a new address you can read on the phone). It will be deleted at the end. Needs this new build.

- [ ] **Welcome:** signed out, you see Create account and Sign in. The terms and privacy links open.
- [ ] **Illustrations:** the picture on Welcome and the ones in the empty states look right, with nothing overlapping the text or the buttons.
- [ ] **Create account:** with the throwaway email, the password checklist ticks as you type. Create account sends a 6-digit code to that email; entering it signs you in to the customer screen.
- [ ] **Code autofill (iPhone):** when the code email arrives, the code is offered above the keyboard.
- [ ] **Open email app (iPhone):** the code screen shows "Open email app", and tapping it opens Mail.
- [ ] **Resend:** the Resend link waits 60 seconds, then sends a new code. The old code stops working.
- [ ] **Try again on the code screen:** turn airplane mode on, enter the code → it says it couldn't reach Bookhushly. Turn airplane mode off and press Try again: the same code is checked again without retyping it.
- [ ] **Existing email:** creating an account with the QA customer's email offers Sign in instead and Verify this email.
- [ ] **Forgot password:** with the throwaway account, Forgot password → code → new password → you're signed in. Sign out and sign in later with the new password: it works.
- [ ] **Leave the reset:** after entering a reset code, press Cancel on New password → you are signed out and back on Welcome. Do it once more, but close the app on New password instead → on reopening you are signed out.
- [ ] **Delete account:** from Account, a wrong password says so. The correct password plus typing DELETE deletes the throwaway account and returns to Welcome with "Your account was deleted". Signing in with it again says the account was closed.
- [ ] **Blocked delete (if you have one):** an account with an upcoming confirmed booking shows why it can't be deleted, in plain words, and is not deleted.
- [ ] **Airplane mode:** every account screen (sign in, create account, code, forgot password, new password, delete account) says it couldn't reach Bookhushly in grey, never in red.
- [ ] **Gate staff:** signed in as the scanner account, the account sheet shows Delete account; with an unsynced admission it warns first and lets you back out.
- [ ] **Delete from a gate account:** with a spare scanner account you don't need, deleting it returns to Welcome with "Your account was deleted". (Skip if you only have the one scanner account.)
- [ ] **Receptionist:** a receptionist account does not show Delete account.
- [ ] **Slow start:** on a slow connection (or just after airplane mode), opening the app shows "Loading your account…" instead of a frozen splash screen.
- [ ] **Every screen opens:** Create account, the code screen, Forgot password, New password and Delete account all open when you tap through to them; nothing stays on the same screen or shows an error page.

---

## Tell me

- Any box you couldn't tick: what happened instead.
- The PIN check time, and the rough time from the camera seeing a code to the result, online and offline.
- Whether the live-code precheck in section 2 passed. If it didn't, offline live codes need a web change first.
