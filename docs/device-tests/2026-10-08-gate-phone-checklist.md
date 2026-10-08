# Gate scanning: phone checks for the new build

**Build:** Android preview, https://expo.dev/accounts/dnl-bookhushly/projects/book-h/builds/1c675070-0259-42fd-bb72-4a0f509f2b02
**Phone:** Moto G06 (a second Android phone for the two-phone tests).
**Covers:** Phase 1 (online), Phase 2a (offline), Phase 2b (lookup, override, activity, shift summary).

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

## Tell me

- Any box you couldn't tick: what happened instead.
- The PIN check time, and the rough time from the camera seeing a code to the result, online and offline.
- Whether the live-code precheck in section 2 passed. If it didn't, offline live codes need a web change first.
