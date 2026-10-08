# UI-A gate redesign: Mobbin references

Collected 2026-10-08 for the UI-A phase (component kit + gate redesign). All screens are iOS, from Mobbin. Each link opens the exact screen on Mobbin.

For every app, the table says **what we take** and **what we leave out**. A reference shows a structure; colours, type and spacing always come from `docs/DESIGN_SYSTEM.md`. Earlier references (customer, receptionist, offline banners) are in `docs/DESIGN_SYSTEM.md` §9.

---

## 1. Scanner screen

| App | Screen | What we take | What we leave out |
|---|---|---|---|
| Posh | [Scan Tickets](https://mobbin.com/screens/2b6dd42a-7f2b-45a2-a27d-ebd7f88976b4) | Full-bleed dark camera. Corner-bracket viewfinder centred. Round icon buttons in the corners (back, search, torch). A scanned count ("0/1 Tickets Scanned") pinned at the top. | The thin progress bar and tiny count text: our door counter is 48 px with an "admitted" label. |
| Luma | [Check-in scanner](https://mobbin.com/screens/6f2ca8bd-8c6a-4bf5-9ac7-7e2336d30ef9) | Dark camera, short hint under the viewfinder ("Point the camera at a ticket QR code…"), primary controls along the bottom, torch at the top right. | The small "Guest checked in" toast at the top: far too quiet for a door. Our results are full-screen solid colours. |
| Meetup | [List / Scan](https://mobbin.com/screens/31e93f37-6471-40fc-969c-e2396f9ad6a4) | Round close and torch buttons, QR glyph above a one-line hint. | The List/Scan text tabs at the top: our list lives in the Find guest sheet. |
| Forest | [Scan QR or type ID](https://mobbin.com/screens/9a2b32e8-f8ee-4525-bc0d-37896c00e4a5) | "Type the code" offered right next to the viewfinder as a pill button, i.e. manual entry is a first-class path, not hidden. | Small pill sizes (ours are 64 pt). |
| Opera | [Scan QR code](https://mobbin.com/screens/1edb5e65-8580-4646-90be-ffac9badc324) | Clear "Scan the QR code or [type it]" fallback under the frame. | The red scan line animation (no idle animation at the gate, battery rule). |
| Riot Mobile | [QR Code](https://mobbin.com/screens/c7861bf7-e541-4efb-83fe-c9d1a34fe27b) | Short instruction above the frame. | Tabbed header. |

**Our scanner, from these:** dark full-screen camera · brackets + one-line hint · top: back, event name, mute · door counter + one status pill under the top bar · bottom: Torch, **Find guest** (centre), Enter code as 64 pt round controls with labels.

## 2. Camera permission (before the system prompt)

| App | Screen | What we take | What we leave out |
|---|---|---|---|
| Turo | [Allow camera access](https://mobbin.com/screens/64b7b165-5876-45f1-ba60-02a665c1f123) | Illustration on top, a plain title ("Allow camera access"), one sentence saying what happens next, one primary button pinned at the bottom. | — (closest match to our layout) |
| Alan | [Give permission](https://mobbin.com/screens/61f5f316-3f0b-4e90-aaa3-729b64df4f34) | A second button for the manual path ("Enter email manually"), so refusing the camera isn't a dead end. Ours: **Enter codes by hand**. | The playful mascot and jokey headline (no jokes at the gate). |
| Walmart | [Camera access required](https://mobbin.com/screens/00dc50a7-3c1b-4eb2-9def-cee8e3ee111c) | Explains the permission in context, over the scanner, with the reason tied to the task (scanning codes). | The bottom-sheet form: we use a full screen so it can also serve the "denied → Open settings" state. |
| Zing (Onfido) | [Enable camera](https://mobbin.com/screens/9f8b4171-f5c4-49d7-9e56-4054302946d0) | Stating the consequence plainly ("We can't verify you without your camera") above the button. | — |
| pushr | [Camera permission](https://mobbin.com/screens/3d3f2655-937a-4de4-ab14-6f3e138f2a76) | Saying what is *not* done with the camera (nothing stored). | Lower-case headings, heavy black button. |
| Skype | [Permissions](https://mobbin.com/screens/fba11b28-118d-4832-96c6-f7edf0096847) | — | Asking for several permissions at once and the gradient background: we ask one permission, in context. |

## 3. Event list

| App | Screen | What we take | What we leave out |
|---|---|---|---|
| Strava | [Club events](https://mobbin.com/screens/19cf74bc-5fc2-4e71-97bd-e1806025eeea) | Leading **date tile** (month over day number over weekday), title, one meta line per row. Upcoming/Past split. | Orange accent and card shadows (we use borders, violet only for the one action). |
| Spotify | [Artist events](https://mobbin.com/screens/33e857e6-817e-4402-98b2-760b8f6ad236) | Compact date tile + "day time · venue" line; dense, scannable rows. | Dark theme, trailing "+" action. |
| Posh | [Event overview](https://mobbin.com/screens/f5323054-01d7-4174-b79c-dae33cde6b96) | "0 scanned · of 1 (1 left)" as a plain line; the event as the hub for Scan Tickets / guest list. | Charts and analytics (organiser features stay on the web). |
| Givingli | [My Events](https://mobbin.com/screens/879486f9-4cb5-4b20-9a83-b61cff6d4c4f) | Chip filters at the top as an option if the list grows. | Large poster cards (too tall for a staff list). |
| Shopee | [Live event management](https://mobbin.com/screens/80d36b76-0c00-4d59-bb84-2f35f5fe0180) | Upcoming / record tabs. | Coloured date text, promo-style buttons. |
| Fixtured | [Events](https://mobbin.com/screens/36b2867a-d276-4d2f-8c97-c1c2fe6c9057) | "Future / Past" section headers; postponed state shown with a dashed, muted card. | Full-colour gradient cards. |

**Our event list, from these:** header "Events" + account button (who's signed in, mode switch, sign out) · rows: date tile, title, "time · venue", status pill (Live now / Today / Upcoming), "Offline list ready" mark · collapsible "Earlier" section.

## 4. Find guest (search + guest rows)

| App | Screen | What we take | What we leave out |
|---|---|---|---|
| Luma | [Guest list](https://mobbin.com/screens/44fc60d9-f628-44a8-a3a0-40c2f0d7a9ab) | **Tabs with counts** ("Going 2 · Checked In 0 · Not Checked In 2"). Trailing green **"Checked In" pill with "22 min ago"** under it. Guest detail opens in a sheet over the list. | Emails and social links on rows (we never show full contact details). |
| Meetup | [Attendee list](https://mobbin.com/screens/3dda809f-fb8e-42b8-a42d-7f40e9741f87) | Search field anchored at the bottom (thumb zone); "Checked in" pill on the row. | The "User checked in" toast. |
| Partiful | [Manage guests](https://mobbin.com/screens/875b0f88-f827-413b-af4e-e8316e1fd76b) | Search at the top, status counts as chips, "Download CSV" offered as an action. | Emoji statuses; the confirm-to-undo pattern (no undo at the gate). |
| X | [Guests sheet](https://mobbin.com/screens/772eef48-39b9-4db2-ae62-c839c91d6bfa) | Grouped sections inside a sheet with a count in the header. | — |
| Givingli | [Manage guests](https://mobbin.com/screens/5ac8407e-9bbe-49db-bc8d-9529f5f5f48f) | Initials avatar when there's no photo; masked-style phone as the second line. | — |
| Azar | [Invite guests](https://mobbin.com/screens/a49303a2-240d-4e9f-b1b5-f6314a52a5d5) | Per-row trailing action button with an in-progress state in the same slot. | — |

**Our Find guest, from these:** search at the top · tabs "Not in · In" with counts · rows: initials, name or masked phone, ticket type, trailing pill ("In · 22 min ago") or **Admit** button · booking view as a second step in the same sheet.

## 5. Activity (to sync / needs attention / synced)

| App | Screen | What we take | What we leave out |
|---|---|---|---|
| Lyft | [Ride history](https://mobbin.com/screens/70a9c4d6-8e37-4b3f-833d-5cda1105c610) | **"Export" as a text action in the header.** Tabs under the title. Rows **grouped under date headings**, each with a leading icon, title, "time · detail" line. | Prices and chevrons. |
| Careem | [Activities](https://mobbin.com/screens/0f44880e-aa99-4055-89e2-056c52867c8f) | Day group headers ("Today", "Tuesday, 2 Sep"); a red status line under a row only when something failed ("Declined by …"). | Category icon tabs. |
| Whatnot | [Activity](https://mobbin.com/screens/9a9bf7cb-e277-4d31-97c7-9ee5bf96dee6) | Status pill above the row title ("Completed"); tabs + filter chips. | Dark theme. |
| Google Health | [Exercise days](https://mobbin.com/screens/5586afac-9947-493c-901f-e8133e450e19) | A one-line summary above the list ("You exercised a total of 2 times"). Ours: the offline-list card. | Charts. |
| Grab | [Activity history](https://mobbin.com/screens/7b20c34a-2e12-4fbf-bb62-c70601c6b099) | Ongoing vs Past split. | Collapsed accordions (hides the rows staff need). |
| Gentler Streak | [Activities](https://mobbin.com/screens/cc039c5d-5b09-460f-b2bf-a66f733e94e8) | Segmented control for periods; "Share" as a header action. | Large chart and coloured stat cards. |

**Our Activity, from these:** header Close · title · **Export** · tabs with counts (To sync, Needs attention, Synced) · offline-list card on top ("1,240 tickets · 2 min ago · Refresh") · rows grouped by time with a leading status icon and a trailing neutral pill · sticky **Sync now** when there's anything to sync.

## 6. Outcome screens: our own design

Mobbin has nothing usable for refused / already-used results at a door (also noted in `docs/DESIGN_SYSTEM.md` §9). The apps above use small toasts (Luma, Meetup), which are too quiet. Ours are full-screen solid fills per D9: Admitted `#166534` · Already used amber `#FBBF24` with ink text · Refused `#991B1B` · Couldn't check `#4A4670`, each with a 128 icon, a sans 36 px title and one large action at the bottom.
