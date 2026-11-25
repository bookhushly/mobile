# Design system

Researched 2026-10-04. **Light UI only.** Brand/direction is owner-settled (requirements §1.3); everything marked **PROPOSED** is a recommendation awaiting the owner — see §11. Contrast ratios were computed from the WCAG 2.2 relative-luminance formula. **[V]** = checked against a fetched source or the web code; **[U]** = not verified. Motion rules live in `docs/MOTION.md`.

## 1. Existing web tokens (mobile matches these unless §11 says otherwise)

Read from `../web/tailwind.config.js`, `app/globals.css`, `app/layout.js`.

| Token                       | Web value                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Primary                     | `#7C3AED`                                                                                                         |
| Violet ramp 50→950          | `#F4F1FF #EBE5FF #D9CEFF #BEA6FF #9F75FF #8B5CF6 #7C3AED #6D28D9 #5B21B6 #4C1D95 #2E1065`                         |
| Ink                         | `#141414` (neutral since 2026-11-13; was violet-tinted `#1A0D4D`, still the web's)                                                                                                         |
| Tint / secondary            | `#F0EDF8`                                                                                                         |
| Border / input              | `#E0DBF0` (0.5 px)                                                                                                |
| Muted text                  | `#6B6987` (5.26:1 on white)                                                                                       |
| Radius base                 | 12 px (sm 8, md 10, lg 12, 3xl 16)                                                                                |
| Type scale (px/line-height) | 12/16, 14/20, 16/24, 18/28, 20/28, 24/32, 32/40, 40/48, 48/56, 64/68, 80/84 (display sizes use negative tracking) |
| Fonts                       | Hanken Grotesk (static 400, 500, 600), for UI and headlines. The web stays on Radio-Canada and Source Serif 4.   |
| Shadows                     | one quiet system: soft / medium / hard                                                                            |
| Skeleton                    | shimmer 1.5 s, shown only after 150 ms, none under reduced motion                                                 |

`#F8F7FB` does **not** exist on web (web canvas is white) — it is a mobile-only addition (D2). The web "70/20/10" is: ~70 % neutral surface, ~20 % graphite/ink (text, headings, borders), ~10 % violet reserved for the one thing to act on (`web/docs/ui/dashboards.md`, commit `b78fff6d`).

## 2. Spacing — 4 pt base, 8 pt rhythm

| Token | px  | Use                                             |
| ----- | --- | ----------------------------------------------- |
| `s1`  | 2   | hairline nudges only                            |
| `s2`  | 4   | icon↔label, tight inline                        |
| `s3`  | 8   | inline gaps, chip padding, stack within a group |
| `s4`  | 12  | dense-row inset, related-item stack             |
| `s5`  | 16  | **screen gutter**, card inset, default stack    |
| `s6`  | 20  | roomy card inset                                |
| `s7`  | 24  | between groups, modal inset                     |
| `s8`  | 32  | between sections                                |
| `s9`  | 40  | large section break                             |
| `s10` | 48  | hero padding, sheet padding                     |
| `s11` | 64  | empty-state breathing room                      |

- Inset `s4–s7`; stack: related `s3`, group `s5`, section `s8`; inline `s2–s4`. A wrapper's padding ≥ the gap between its children.
- Gutter 16 on phones, 24 on tablets (≥768 wide); content max-width ≈640 forms / 960 tablet panels.
- Safe areas via `react-native-safe-area-context` insets — never hard-code 34/44. Sticky bottom CTAs: `max(inset, s5)`.
- Touch targets ≥ **44 pt (iOS) / 48 dp (Android)** visual; WCAG 2.5.8 floor is 24 px. Extend small icons with `hitSlop`; ≥8 between adjacent targets. [V]
- Row heights: one-line 56, two-line 72, dense work row ≥64, section header 40.

| Density mode | Row min             | Control height | Gap between targets | For                          |
| ------------ | ------------------- | -------------- | ------------------- | ---------------------------- |
| `customer`   | 56–72               | 48             | 12–16               | browsing, thumb scroll       |
| `work`       | 64                  | 48             | 12                  | receptionist (phone/tablet)  |
| `gate`       | full-screen results | **56–64**      | **≥16**             | gloves, sweat, sun, one hand |

Density is a token set (`density.ts`), not a multiplier.

## 3. Typography

**2026-11-14, second size step (owner: text still too small):** caption and labelSm 14/20, label and fieldLabel 16/22, bodySm 16/24, body, bodyStrong, button and linkLg 18/26, subtitle 19/28, headline 20/28, title 22/30, titleLg 26/34. Display headlines and the gate's result and counter sizes are unchanged. `src/shared/theme/type.ts` is the source of truth where this section's older numbers differ.

**2026-11-15, third size step (owner: one more step up):** caption and labelSm 15/22, label, fieldLabel and bodySm 17/24, body, bodyStrong, button and linkLg 19/28, subtitle 20/30, headline 22/30, title 24/32, titleLg 28/36. Display, `lead` and gate sizes unchanged.

Hand-tuned scale anchored on the web scale (a strict modular ratio gives fractional, blurry sizes on Android). Nothing below 12. Sentence case, no uppercase eyebrows. Use weights **400 / 500 / 600** (700 only for 48+ numerals); skip 300.

| Token        | Size/LH | Weight | Tracking | Font                                       |
| ------------ | ------- | ------ | -------- | ------------------------------------------ |
| `caption`    | 13/18   | 400    | +0.2     | Hanken Grotesk                             |
| `labelSm`    | 13/18   | 600    | +0.2     | Hanken Grotesk                             |
| `label`      | 15/20   | 600    | 0        | Hanken Grotesk                             |
| `fieldLabel` | 15/20   | 500    | 0        | Hanken Grotesk (form field labels only)    |
| `bodySm`     | 15/22   | 400    | 0        | Hanken Grotesk                             |
| `body`       | 17/24   | 400    | 0        | Hanken Grotesk                             |
| `bodyStrong` | 17/24   | 600    | 0        | Hanken Grotesk                             |
| `lead`       | 20/28   | 400    | 0        | Hanken Grotesk (subline under a headline)  |
| `headline`   | 19/26   | 600    | 0        | Hanken Grotesk                             |
| `title`      | 20/28   | 600    | −0.2     | Hanken Grotesk                             |
| `titleLg`    | 24/32   | 600    | −0.3     | Hanken Grotesk                             |
| `displaySm`  | 30/36   | 500    | −0.75    | Hanken Grotesk                             |
| `displayMd`  | 30/36   | 500    | −0.75    | Hanken Grotesk (Welcome headline)          |
| `display`    | 40/48   | 600    | −0.8     | Hanken Grotesk                             |
| `displayLg`  | 48/56   | 600    | −0.96    | Hanken Grotesk                             |
| `hero`       | 64/68   | 600    | −1.28    | Hanken Grotesk (onboarding only)           |
| `num`        | 16–24   | 600    | 0        | Hanken Grotesk, tabular                    |
| `numXl`      | 48–80   | 600    | −1       | Hanken Grotesk, tabular (door count, timers) |

- **Fonts [V]:** static files only (no variable), from `@expo-google-fonts/hanken-grotesk`. One **family name per weight** (`HankenGrotesk_600SemiBold`); **never use `fontWeight`** with custom fonts [U for SDK 57]. Load via the `expo-font` **config plugin** (embedded at build, no first-frame fallback flash), so a font change needs a new native build, not an OTA update.
- **Glyph gap [V]:** Hanken Grotesk **has no ₦ and no ṣ/Ṣ**; phones draw those in the system font. It has ẹ ọ ị ụ, Ẹ Ọ and the combining marks. The owner chose it deliberately on 2026-11-02: the look against the sites Nigerian customers use comes first, and glyph coverage no longer decides the font. Check ₦ beside digits on a device. See D7.
- **Tabular numerals [V]:** Hanken Grotesk has no `tnum` feature, but its digits are all 560 units wide at 400, 500 and 600, so money, counts and timers don't jitter. The `tabular` prop stays harmless.
- **Sizes up one step (2026-11-13, app-wide):** measured against Nike (cap heights from screenshots): Hanken's x-height is 0.493 against SF 0.508 and Helvetica 0.523, so reading text is 17, secondary and labels 15, captions 13, and `button` 17/600 (links `linkLg` 17/500). Headlines 30 at 500 on onboarding. Gate result variants unchanged.
- **Onboarding spacing:** 24 pt side margins (`layout.formGutter`), 40 pt between groups on form sheets, 20 pt between fields, 12 pt headline to subline.
- **Onboarding type rule (2026-11-13):** read 400, tap 600, nothing else. Headline 600; reading text 400 (`lead` 18 on Welcome, `body` 16 on forms); buttons and standalone links 600 at 16 (`TextLink size="lg"`); fine print `bodySm` 14 with 14/600 links. No 12 px text on onboarding screens.
- **No serif in the app.** Headlines are Hanken Grotesk 600 at about −2% letter spacing.
- **Dynamic Type:** keep `allowFontScaling` on; `maxFontSizeMultiplier`: body/labels 1.6, titles 1.3, display/numXl 1.0–1.15, gate result screens 1.0 (fixed huge layout). Never cap form labels/inputs below 1.3. Test iOS Accessibility 3 / Android 200 %.
- Money via one `Money` component (₦ + tabular, integer kobo/naira, `Intl en-NG`).

## 4. Colour

**Violet** — use the web ramp. `600` fills; `700` pressed fill **and small violet text**; `50/100` washes. Never violet-500 for text (4.23:1).

**Neutrals (violet-tinted)**

| Token        | Hex       | Role                                  |
| ------------ | --------- | ------------------------------------- |
| `surface`    | `#FFFFFF` | cards, sheets, inputs                 |
| `canvas`     | `#F7F7F7` | app background (D2)                   |
| `wash`       | `#F2F2F2` | chips, secondary and disabled fills   |
| `line`       | `#E5E5E5` | decorative dividers, card borders     |
| `lineStrong` | `#8C8C8C` | input/control borders (3.36:1)        |
| `inkMuted`   | `#6B6B6B` | secondary text (5.33:1)               |
| `inkSoft`    | `#474747` | captions on fills (9.29:1)            |
| `ink`        | `#141414` | headings, body, links (18.42:1)       |

**Neutral foundation (owner decision, 2026-11-13).** Benchmarked against Booking.com, Nike and IHG: black, white and plain greys carry the UI; violet appears only on the primary action and selected state. Every neutral used to be tinted violet, which read as generic and AI-made. Links are text-coloured and underlined, not violet. Contrast rows below that name the old tinted values are historical; the new values are in the table above.

**Buttons (2026-11-13):** full pill, 52 tall (customer density), label `button` 17/600 (Hanken 600 has the stroke of Helvetica Neue Medium; 500 reads thin), outlines 1 px (`hairline`). On a photo: white fill with black label, or a white 1 px outline.

**Text fields (2026-11-14, after Airbnb):** the title sits inside the box: it rests where the text goes, then moves up and shrinks to 13 grey when the field is focused or filled. 58 tall (gate 64), 1 px grey border, 2 px black when focused, red on error. Search boxes: no title, placeholder only. Forms: 24 side margins, 32 between sections, 16 between fields, helper text 8 below its field.

**Logo:** the full lockup on brand moments only (the opening screen and Welcome); the mark alone inside flows, left-aligned above the form headline at 40 pt, as Nike, IHG and Eventbrite do. One colour rule (owner, 2026-11-23): the logo is brand violet `#7C3AED` on white and light surfaces, white on violet (splash, intro, loading, app icon) and on photos (Welcome), and never ink or grey. Violet on white is 5.7:1. The logo is the brand mark, so this isn't a use of violet as an action colour.

**Semantic (PROPOSED — darker than web; D5)**

| Token     | Solid     | Wash      | Text on wash |
| --------- | --------- | --------- | ------------ |
| `success` | `#15803D` | `#DCFCE7` | `#14532D`    |
| `warning` | `#B45309` | `#FEF3C7` | `#78350F`    |
| `danger`  | `#B91C1C` | `#FEE2E2` | `#7F1D1D`    |
| `info`    | `#1D4ED8` | `#DBEAFE` | `#1E3A8A`    |

Web's `success-600 #16A34A` is **3.30:1** with white (fails AA) and `danger-600 #DC2626` 4.83 (barely). Mobile uses the darker stops; file the web fix.

**Computed contrast (WCAG)**

| Fg on bg                                  | Ratio              |                            |
| ----------------------------------------- | ------------------ | -------------------------- |
| `#7C3AED` / white (either way)            | **5.70**           | AA text + UI, not AAA      |
| `#6D28D9` / white                         | 7.10               | AAA — small violet text    |
| `#7C3AED` / `#F8F7FB` · `#F0EDF8`         | 5.34 · 4.93        | AA                         |
| `#8B5CF6` / white                         | 4.23               | UI only                    |
| `#1A0D4D` / white · `#F8F7FB`             | 17.37 · 16.29      | AAA                        |
| `#6B6987` / white · `#F8F7FB` · `#F0EDF8` | 5.26 · 4.93 · 4.55 | AA (don't go lighter)      |
| `#9E98BB` / white                         | 2.74               | **fails — never for text** |
| `#E0DBF0` / white                         | 1.35               | decorative only            |
| white / `#15803D` · `#166534`             | 5.02 · 7.13        | AA · AAA                   |
| white / `#B91C1C` · `#991B1B`             | 6.47 · 8.31        | AA · AAA                   |
| white / `#B45309`                         | 5.02               | AA                         |
| white / `#1D4ED8`                         | 6.70               | AA                         |

**70/20/10 mapped to tokens (follows the web definition; D1)**

| Share               | Tokens                                                                                              | Where                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| ~70 % neutral       | `surface`, `canvas`, `wash`                                                                         | backgrounds, cards, rows, sheets, whitespace                                      |
| ~20 % ink/structure | `ink`, `inkSoft`, `inkMuted`, `line`, `lineStrong` (+ violet 50/100 as quiet selected-state washes) | text, icons, dividers, input borders                                              |
| ~10 % accent        | `violet-600` (+700 pressed), focus ring                                                             | **one** primary CTA per screen, links, active tab, selected chip/toggle, progress |

Violet is never decorative, a large fill, or a status colour. Red = errors/destructive only.

**Gate exception (D9):** results are full-screen solid fills — deliberately outside 70/20/10 because they must be read from arm's length. Use the **dark** stops (`#166534`, `#991B1B`, **amber `#FBBF24` with ink text (10.4:1) for 'Already used'** (white on `#B45309` is only 5.0:1)) with white at ≥7:1 — pale washes vanish in sun. Always colour **+ large icon + word + haptic/audio** (never colour alone). **"Couldn't check" is neutral/warning, never red.** Four outcomes only: Admitted · Already used (time + by whom) · Refused (reason) · Couldn't check.

## 5. Shape and elevation

Radius: `r1` 4 (tags) · `r2` 8 (chips) · `r3` **12** (default: inputs, cards) · buttons are full pills (`rFull`, since 2026-11-13) · `r4` 16 (sheets, images) · `rFull`. Use `borderCurve: 'continuous'` on iOS [U].

**Borders first, shadows rarely** (shadows in long lists are a classic jank source [U]):

| Level           | Style                                                 |
| --------------- | ----------------------------------------------------- |
| 0 canvas        | none                                                  |
| 1 card          | `surface` + 1 px `line`, no shadow                    |
| 2 sticky/raised | `0 2 15 −3 rgba(26,13,77,.07)`; Android `elevation 2` |
| 3 sheet/menu    | `0 4 25 −5 rgba(26,13,77,.10)`; `elevation 6`         |
| 4 modal         | `0 10 40 −10 rgba(26,13,77,.15)`; `elevation 12`      |

Shadows tinted ink (`26,13,77`), never black; no violet glow.

## 6. Icons, imagery, states

- **One cross-platform outline icon set** at 1.5–2 px stroke on a 24 grid (candidate: lucide — check what web uses). `expo-symbols` is iOS-only → don't mix (D6). Sizes: 16 inline, 20 rows, 24 default, 96–160 gate results.
- **Icon rules (2026-11-15, owner: "inconsistent, the default AI template"; from Airbnb, Hyatt, Vrbo, Mindtrip, Booking and Expedia on Mobbin):**
  1. One set, one look: lucide outline at the kit stroke (1.75). Never filled icons, emoji or a second set beside them.
  2. Informational icons are ink (`textPrimary`); on a quiet meta line (a card's date tag, a caption), `textSecondary`. Never violet, except the selected tick and the primary action. Status colours only beside an outcome or status word.
  3. No disc, tile or border behind an informational icon (amenities, highlights, facts, event details, place lists): the bare icon, level with the first line of its text. A circle means a button (`IconButton`). Named exceptions: the promo card's large art, initials avatars, and the soft focal circle of an empty or error state (Expedia's empty Trips).
  3a. The icon pictures the exact thing the words name (owner, 2026-11-15): a plug for a generator or power (never a lightning bolt), a concierge bell for room service (never sparkles), a shower head for hot water, a ruler for size, a calendar for today. No stand-in or decorative glyph; when no icon pictures it, use a plain check. Stored amenity codes are always shown as words (`normalizeAmenities`), never as the code ("zap", "waves").
  4. Size follows the text beside it: 24 (`md`) with `body`/`bodyStrong` rows; 20 (`sm`) with `bodySm`/`label` and inside buttons; 16 (`xs`) with captions and tags; 32+ only for empty states and promos.
  5. Every icon has words next to it, except an icon button, which carries an accessibility label. One icon means one thing app-wide (e.g. `MapPin` is always a place; `ChevronRight` opens a page; `ChevronDown` opens a choice).
- Image ratios: listing card 4:3, detail gallery 16:10, thumbs 1:1, event poster 4:5; reserve space; `expo-image` + blurhash/`wash` placeholder; **no stock imagery posing as inventory** — no photo = neutral `wash` block + icon.
- Auth photos (`assets/images/auth/`) are brand imagery behind sign-in only, never inventory or listings. Over them, a **legibility fade** is allowed at the top and behind the Welcome text (`color.scrim`); these are the only gradients in the app and they carry the text contrast, not the photo.
- Loading: skeletons mirroring layout, only after 150 ms, none under Reduce Motion; inline spinners for actions.
- Empty: icon + one-line reason + one action. Error: what happened, whether data/money is safe, next step, retry; never raw codes.

## 7. UX principles by mode

**Customer** — progressive disclosure (filters in a sheet; price breakdown collapsible, **total always visible**); primary action pinned in a bottom bar (thumb zone); exact ₦ total before the Paystack handoff; lock countdown; pending state, never fake success. Forms: top labels, one column, per-field `keyboardType`, validate on blur, preserve input on error. Phone: accept `0803…`/`803…`/`+234803…` → E.164 on blur; amounts `₦` + separators, store integers; address = state → area + free-text landmark. Ticket: QR as large as possible, ink on white, auto-brightness, keep awake.

**Customer layout (Expedia reference, 2026-11-14)** — white pages. Every tab opens with its large title (`displaySm`), signed in or out; inner pages keep a compact `headline` title beside Back. Section titles are `title` (24/600) everywhere in customer flows (rails, listing sections, checkout steps), with See all as an ink link and no See all on an empty section. A section with nothing keeps its title over one `bodySm` line; when every Explore section is empty, one empty state replaces them. The place lives only in the stays headings ("Hotels in Lagos ⌄": the city underlined in ink with a chevron, tap to change; 2026-11-15, after Booking.com and Airbnb), not as a separate line. Cards, photos and panels use `r4` (16 pt); thumbnails `r3`; small tags `r2`; chips and filter pills `rFull`, with a selected chip in solid ink. Avatars and other decoration stay neutral: violet only on the primary action and selected states.

**Customer elevation (2026-11-14, owner: "bring each screen alive")** — researched on Mobbin (Expedia hotel pages and search, Booking/Marriott/Agoda promotions, Airbnb/Vrbo/Google Maps filters, Meetup/Lex/Eventbrite events, Trip.com/American Airlines search). Colour beyond black and white, in small, named places only (`color.accent`): a green score badge with its word (`ratingWord`: Exceptional/Excellent/Very good/Good, nothing below 3.5); a yellow tag on promotions and the event date tile. Pages stay white. (The soft place tints on popular-place tiles were removed on 2026-11-15: colour that meant nothing.) Category tiles (2026-11-15, owner's pick of four, after corner and Google Arts & Culture): big brand-photo cards (`r4`), Hotels across the row (200 tall, `titleLg`, white arrow disc) and Apartments and Events sharing the row below (180 tall, `title`), each with a short white `bodySm` line; the white text sits on a fade that reaches 80 % black at the foot, so it reads on any photo. Promo cards say only true things about Bookhushly (no invented discounts or counts), as Expedia's home promo laid out like a printed ad (owner's picks, 2026-11-15): a flat colour block (ink with white text and a white pill for the lead one, at most one per screen; violet-50 with a dark pill for quieter ones; never a yellow fill: yellow is only for small deal tags and the date tile), a `displaySm` headline, one `bodySm` line and a pill with an arrow at the top left, and the icon drawn 128 pt in a deeper shade (soft grey on ink), tilted and bleeding off the bottom-right corner; no photo behind text. Sheets (2026-11-15, after Skyscanner, Agoda, BlaBlaCar): a round close button at the left, the title centred, no rule under the header; a list of choices shows the chosen one with a violet tick. "Where to?" has a search field that filters popular places (pin, name, the state underneath) and all states (map). Listing pages: rating badge on cards, Highlights as icon rows, amenities as a two-column icon grid, room cards with photo, icon facts and a "Lowest price" band, events with a calendar date tile and icon rows for date, venue and organiser; booking pages lead with the place's photo. Search (owner's pick A, 2026-11-15, after Airbnb's suggested destinations): Hotels / Apartments / Events as tabs with an icon over each word (the chosen one in ink with an ink line under it), one field, then recent searches and "Suggested places" as list rows (pin, the city, the areas people book in, e.g. "Lekki, Ikoyi, Victoria Island, Ikeja"); typing turns the list into matching places and areas ("Lekki · Area in Lagos", searched within Lagos), then "Search “…”" by name or address. No separate Search button. Results never end in a dead end (owner's rule, 2026-11-15): with no exact match, a canvas note says so in one line ("No exact matches" and why), each active filter becomes a "Remove “Wi-Fi”" pill, and the closest listings follow as rails headed with how they differ ("In Port Harcourt, without your filters", "Hotels with your filters, in other places", "Apartments in Port Harcourt", "Hotels in other places"); with one or two exact matches the same rails follow under "Close to what you asked". Empty rails take no room. Filters (owner's pick A, 2026-11-15, after Airbnb): titled sections with hairlines; hotels open with "Most wanted" tiles (Has a generator, Breakfast included, NIHOTOUR certified), then price per night with naira bands (Under ₦50k, ₦50k–₦100k, ₦100k+) over the min/max fields, a guests stepper, guest rating pills, and amenity pills with icons (the web's slugs, BACKEND_STATUS §9); no Sort in the sheet (it has its own pill); "Clear all" as a link beside "Show 12 hotels", the count asked half a second after the last change and "Show results" while unknown. Cards in a row line up line for line (Airbnb, TikTok, Posh, StubHub): a one-line title, then area and rating (events: date, then venue), each slot keeping its height when empty, the price pinned to the foot. List rows keep two-line titles. Listing pages (2026-11-15, owner's second picks from Mobbin, after "why are you going for the least impressive"): hotels and apartments as Airbnb's listing (the photo runs to the screen's top edge under floating round Back/Share/Save buttons, a "1 / 20" counter; a white sheet with rounded top corners rides 24 pt over the photo's foot; the name centred in `titleLg`, "Hotel in Lekki, Lagos" or the apartment type, apartments add "4 guests · 2 bedrooms · 1 bathroom"; the score with five stars, its word and the review count in three columns between hairlines; a "Where you'll be" maps row near the end); events as Luma (an ink hero: the poster as a rounded square card, the name in white, when, where in a muted grey, then Share, Save and Directions as raised tiles; the price and "Get tickets" stay in the footer, so one primary action; plain ink, no blur). Once the page scrolls past the photo, a white bar fades in behind the floating buttons. Below the event hero (2026-11-15, Eventbrite/Posh/Luma): ticket types as cards (name, then the price with how many are left beside it, then what it includes; sold out on the canvas grey), then About, Cancellation, and "Organised by" last as a card with the organiser's initials (Eventbrite and Luma put the organiser near the end; no follow or message buttons until there is something behind them). The booking bar follows DICE (owner's pick A, 2026-11-15): events show the date and time in a small grey line on top and the price large under it (a range reads "From ₦15,000"), stays the price large; the violet button beside. A hand-off to the website keeps the summary on one line above a full-width button. Reviews as Expedia (score "4.6/5" in `display` with its word and count, then up to three equal-height review cards in a swipeable row that peeks at the edge, then "See all N reviews"; the full list in a sheet reads like Vrbo with the host's reply on a wash). Results as Airbnb's search results: a raised search pill with what was searched and the count (tap to change the search), a round filters button with a count badge, one full-width 4:3 photo card per listing (name with "★ 4.6 (47)" at its right, the place, the amount underlined), 32 between cards, and Sort as a dark pill floating over the list's foot. Bookings: a Today card leads with the place's photo and a white "Today" pill (Airbnb/Expedia Trips); list rows have 72 pt thumbnails. Booking detail: check-in and check-out side by side, the day strong and the time under it (Booking.com). Account: a raised profile card with large initials (Airbnb), details as value rows with an underlined Edit/Add, help rows with leading icons. Select and Review-and-pay open with the place card (photo thumbnail, name, where or when). Saved cards show title and place only (no empty slots for price or rating). Text fields are 64 tall (68 gate) so the title and value never squeeze. Explore refinements (2026-11-15, after Mobbin): no page title, the search bar pinned at the top with a soft shadow (Viator, Tripadvisor, Hyatt); today's booking as Booking.com's "Upcoming trip" card (the name on its own line, what happens today under it, the action as an outlined pill); card titles on one line (owner's pick: two lines left a gap under short names; the full name is on the listing page); a stay without reviews says "No reviews yet" (never a gap); on cards the score shows with its word only ("4.6 Excellent", the count still spoken); order: categories, hotels, apartments, the weekend promo leading into Happening soon, then the offline-tickets note. Explore spacing (2026-11-15, owner: "too tight"): the top group (today banner, search, category cards) 16 apart; sections 40 apart; rail heading to cards 12; cards 16 apart; photo to title 12; card text lines 8.

**Customer, signed out** — Explore, listings and Select work with no account. Saved, Bookings and Account show a short sign-in prompt in place of their content. Continue (book) and Save open a sign-in sheet ("Sign in to book" / "Sign in to save"; "Create account", "Sign in", "Not now"): selection stays as chosen, backing out returns to Select.

**Gate** — camera first; result takes the **whole screen** (refusals hold until dismissed), dismiss target large in the lower half; controls in the lower third ≥56 pt, ≥16 apart; no precision gestures; counter + sync state always visible; no undo.

**Receptionist** — scan/type the 8-char code → confirmation summary (guest, room type, dates, payment) → one "Check in" button; blockers shown above it in words. Tablet ≥768: two-pane (list | detail), 24 gutters, `work` density.

**Microcopy** — sentence case, verb-first ("Pay ₦45,000"), plain words, no exclamation marks, no blame ("We couldn't reach the server"), no jokes on money failures or at the gate.

## 8. Tokens in code

```
src/shared/theme/  tokens.ts (private) · theme.ts (roles, textTone, surfaceTone) · type.ts · density.ts · elevation.ts · motion.ts · sizes.ts · fonts.ts · contrast.ts · index.ts
src/shared/ui/     Text · Box · Stack · Inline · Card · Icon · Money · formatNaira · Button · IconButton · ToggleButton · TextLink · Input · PasswordField · CodeField · RuleList · SearchField · PinField · Screen · Header · Sheet · ListRow · SectionHeader · SegmentedControl · Divider · StatusPill · Banner · EmptyState · ErrorState · Skeleton · SkeletonRows · Spinner · Illustration · SuccessMark · OutcomeScreen · OutcomeAction · ShellPlaceholder · DensityProvider · useDensity · useDensityName · useMotionTier · PressableScale
```

- Screens import **semantic roles only** (`color.action`, `color.outcome.admitted`), never the palette.
- `Text` is the only text renderer: variant → family/size/line-height/tracking; weight → family name; sets `maxFontSizeMultiplier`.
- `Box`/`Stack` props are token-key unions (`p="s5"`), so `p={13}` fails to compile.
- Lint/hook backstops: no hex / numeric spacing / `fontWeight` outside `src/shared/theme/` and `src/shared/ui/`; a test asserting every semantic text/background pair meets its contrast target.
- `userInterfaceStyle: "light"` is set in `app.json`.

## 9. Reference patterns (Mobbin, iOS; links returned by the tool)

### How references are chosen (owner-approved 2026-11-15)

Mobbin search ranks by text match, not quality, and a count shows what is common, not what is best. So every Mobbin lookup follows these rules.

**Tiered app list.** Owner adjusts these lists; ask before adding to Tier 1.

- **Tier 1, design leaders.** These set the bar for "premium": Airbnb, Nike, Apple, Mindtrip, Luma, Hyatt.
- **Tier 2, category leaders.** Use them for domain patterns such as booking, pricing and tickets: Expedia, Booking.com, IHG, Marriott, Vrbo, Eventbrite, StubHub, Posh, GetYourGuide, Trainline.
- **Anything else** needs a stated reason, for example "only app on Mobbin with a crypto payment screen". Mark it as outside the list.

**Every reference must pass four checks before it is cited:**

1. **Seen.** Open the screenshot itself; never judge from Mobbin's text description alone.
2. **Recent.** Use the app's current design. Skip screens that look like an older version when a newer one exists.
3. **Fits our rules.** The pattern must suit a neutral base with violet only on the main action, a light UI and Hanken type, or adapt to them without losing what made it good. Say what we take and what we leave.
4. **Honest.** No dark patterns: fake urgency, invented counts or discounts, confirm-shaming, hidden fees.

**Report the findings in this order:**

1. Our screen and what is wrong with it.
2. Up to three Tier 1 examples, with links and what each does well.
3. The count across all apps checked ("8 of 13 do X").
4. When Tier 1 and the majority disagree, say so and lean towards Tier 1 unless the majority pattern is a usability convention people rely on, such as where a close button sits.
5. One recommendation. When you haven't named a reference for an open-ended redesign, offer 3–4 directions with previews instead, each tied to a real app.

**When Mobbin has nothing good**, say so and design from the principles above. Don't stretch a weak match. That is how the gate overlays and auth were done.

### Patterns found

Mobbin had nothing usable for scanner refused/already-used overlays, receptionist boards, notifications, auth, skeletons — those are our design, informed by the principles above.

- **Home/discover:** search pill + 3 category chips + 2–3 peeking rails; 4 tabs (Explore, Saved, Bookings, Account). [Hyatt](https://mobbin.com/screens/e9a169af-e2bf-4220-9ee8-e8747b8537a0) · [Marriott](https://mobbin.com/screens/5cb055a2-74d0-4534-81b0-0dda42d3fc57) · [Booking.com](https://mobbin.com/screens/5526430c-846d-410e-bfac-1bdae346e0e2). Skip promo banners above search.
- **Filters:** one bottom sheet, sticky CTA with live count ("Show 5 results"). [Tripadvisor](https://mobbin.com/screens/85bc9bfe-26f3-4ecc-aa6b-f05f96281f8b) · [Viator](https://mobbin.com/screens/c9f8aded-2997-45b1-8423-2f6d066b0ef8). Dates/guests: [Resy](https://mobbin.com/screens/af8acc12-bea3-4967-85fe-4285d5c115e3) (struck-through unavailable days).
- **Listing detail:** sticky price+CTA bar, gallery counter, all-in price, "You won't be charged yet" only if true. [Booking.com](https://mobbin.com/screens/1a472580-fa63-4577-801b-671f9366cf02) · [Viator](https://mobbin.com/screens/6914fe52-575b-40ae-8928-46c13eec5f5f) · [Shopee Hotels](https://mobbin.com/screens/db041c61-ac92-4208-800e-4164f3652542). Skip fake urgency.
- **Ticket selection:** tier cards + stepper, per-tier limits, total in the CTA label. [Eventbrite](https://mobbin.com/screens/da112b9a-44ec-4dc7-a91c-517565e308cb) · [Posh](https://mobbin.com/screens/8e85b4d8-8de1-4437-bd9b-79306649265a).
- **Price breakdown:** right-aligned tabular numerals, grouped lines, heavy rule above total, info icons per fee. [Vrbo](https://mobbin.com/screens/853584bf-5f6b-44de-88d4-79fc929c38bd) · [IHG](https://mobbin.com/screens/4b9f6d6b-d4af-4278-b2dc-f0919436288c).
- **Payment:** bank-transfer screen with copy button + expiry countdown + status ([Gojek](https://mobbin.com/screens/0091869f-82e7-4e3a-bceb-0990eecf5c28)); crypto with QR/copy/network warning/timer ([Kraken](https://mobbin.com/screens/5fa5cccc-f003-46c3-9f6d-7091dbf71328)); failure says whether money was taken, Retry + "Try another method" ([Zomato](https://mobbin.com/screens/2225c0f4-21e4-4ebb-a71f-1cf8aa070700)); success → one button to the ticket ([Eventbrite](https://mobbin.com/screens/87341507-48e0-40cf-a85c-93bb5b797417), [Viator](https://mobbin.com/screens/2c12d3a4-efe9-402a-af46-7a679f33fcd8) "access offline"). The pending screen must survive backgrounding (user is in their bank app); poll 5–10 s with backoff.
- **Ticket wallet:** big white QR, name + tier, actions below, stored locally. [Luma](https://mobbin.com/screens/fd60dbd4-6f2f-43e8-a2a8-dbf6954b3f59) · [Posh](https://mobbin.com/screens/70c99608-be00-4a4a-8d05-48bc9e9697bb) · [Eventbrite](https://mobbin.com/screens/9aa88ec6-82a1-46e0-ae92-df1a9c9f7306). Skip Wallet-only delivery (Android dominates).
- **My bookings:** one scroll, Upcoming first, status chips, countdown card for unpaid. [Turo](https://mobbin.com/screens/c8e09858-bb16-4cdd-881a-3191a4c5e495) · [Navan hold](https://mobbin.com/screens/dc0200de-0819-491e-b2dd-ce7b3d9d81d2) · [StubHub](https://mobbin.com/screens/eeca2a31-6a05-4bf3-97a4-c13eecf5a246).
- **Gate:** List/Scan toggle + torch + manual search + count tabs ([Luma check-in](https://mobbin.com/screens/6f2ca8bd-8c6a-4bf5-9ac7-7e2336d30ef9), [list](https://mobbin.com/screens/e02a3aa3-e02c-4019-82cf-163fa8b1eafd)); scanned/remaining bar ([Posh organiser](https://mobbin.com/screens/bccf7797-b173-44cd-8838-1044146ef00e)); viewfinder brackets + sound toggle + result sheet over a live camera ([Yuka](https://mobbin.com/screens/eee5a97d-2edb-440a-b8d7-85b477b27da1)). Luma's small toast is too quiet for a gate — ours are full-screen.
- **Receptionist:** guest-list analogues: [Partiful](https://mobbin.com/screens/1103e00c-2084-4264-b872-2e8cb313769c) (check-in button per row; confirm-to-undo sheet is fine at the desk, **never at the gate**), [Luma list](https://mobbin.com/screens/e02a3aa3-e02c-4019-82cf-163fa8b1eafd). Room board = grid of room numbers coloured by state [U].
- **Car rental (Phase 6, owner's picks 2026-11-23, refined in the "Car Rental Directions" artifact):** asking is **1A, Airbnb-style steps**: six one-question steps (Where, When, How, Car, Details, Check), a round arrow back button top left with the progress line beside it (Close on step 1), one full-width Next whose label carries the trip length ("Next · 3 days"); Edit on the check step returns to it. Calendar after Turo/Agoda: Pick-up → Return boxes over a scrolling month grid (`RangeCalendar`, shared with the stay dates sheet), solid chosen days, a neutral grey band between. Physical choices are photos (Unsplash, `assets/images/cars/SOURCES.md`): driver vs self-drive as two photo cards, car types as Uber-style photo rows plus "Any car"; abstract choices (time, pricing, purpose) stay ink chips. Waiting is **2A, a Booking.com-style timeline** in ink and grey only (done = ink dot and tick, now = ink ring, later = grey), with the real deadline and "Ask again, with a change" when no one quoted. Choosing is **3A, Turo car-first quotes**: one big card per quote led by the car photo, lowest first; the full quote's footer stacks the total and its breakdown above a full-width button; a confirm sheet says the other quotes are declined. Booked reads top to bottom: the car, pick-up (Directions and Call side by side; Call only once paid), return, after your trip. Bookings rows show a photo and the status as a quiet line above the name (bold when it needs you), never a coloured tag. No live map or place search until the owner's Google Cloud setup.
- **Logistics (Phase 6, owner's pick A 2026-11-23, artifact "Car Rental and Logistics" v7):** the car rental pattern in seven steps (service, pick-up, drop-off, when, item, vehicle, check). The four services are **full-width photo rows** (layout A: photo left, name and one short line, a 2 pt ink frame when chosen), like the driver cards; vehicles are photo rows with what each carries, plus "Let the company choose". Pick-up and drop-off each take an address, a landmark and the state from the list. When is the shared calendar: the first tap is pick-up, a second sets an optional "arrive by". The item step asks what it is first, then optional chips, the count and care options (value only when insuring). After paying, the timeline becomes tracking (Paid, Picked up, On the way, Delivered, with the times the company marks), with Call, a proof photo when there is one, and "Confirm it arrived". Explore shows it as a wide "Send or move something" card under the 2×2 tiles.
- **Offline/error:** inline banner ([Alta](https://mobbin.com/screens/2b00c4b9-d2a6-4a6a-9d95-2aba49348be1)) unless nothing cached ([Qantas](https://mobbin.com/screens/18f77caf-19d5-4199-98b4-a36f34096d23)).

**Skip:** fake urgency, promo banners above search, chat bubbles over CTAs, jokey failure copy, Wallet-only tickets, embedded live maps/autoplay video, heavy blur/glass/shadows, fees revealed late, connectivity-dependent rotating-QR validation at the door, confetti at the gate.

**Low-end/data:** ≤~400 px WebP + blurhash, lazy rails, virtualised lists, minimal shadows/blur, apply filters locally and fetch on CTA, cache tickets/bookings/roster, static map image + "Open in Maps".

## 10. DO / DON'T

- DO `#6D28D9` for small violet text; `#7C3AED` for fills and ≥16 semibold text. DON'T `#9E98BB` or violet-500 for text.
- DO 3:1 borders on inputs (`lineStrong`); `line` is decorative.
- DO 44/48 targets; colour + icon + text for every outcome; tabular figures for numbers.
- DON'T cap font scaling on forms; DON'T use violet for status or large fills.
- DO borders for cards, shadows for floating layers only.

## 11. Decisions (owner-answered 2026-10-04)

| #   | Decision                                                                        | Outcome                                                                                                                                |
| --- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 70/20/10 = web definition (20 % graphite/ink; violet tints are not a 20 % fill) | **Yes**                                                                                                                                |
| D2  | `#F8F7FB` app canvas with white cards                                           | **Yes**                                                                                                                                |
| D3  | Heading weight 600 (brief) vs 500 (web)                                         | **600**; web may be aligned later or the difference accepted                                                                           |
| D4  | Body 16 (web parity) vs 17 (iOS)                                                | **16**                                                                                                                                 |
| D5  | Darker semantic stops than web; file web fix                                    | **Yes**                                                                                                                                |
| D6  | One cross-platform icon set vs SF Symbols on iOS                                | **One set (lucide)**                                                                                                                   |
| D7  | Missing ₦ and ṣ/Ṣ in Hanken Grotesk: system fallback vs another font            | **Accept fallback** (owner, 2026-11-02; ₦ to be checked on a device)                                                                   |
| D8  | Source Serif limited to ≥32 px display                                          | **Superseded**: no serif in the app (owner, 2026-11-02)                                                                                |
| D9  | Gate full-screen solid fills break 70/20/10                                     | **Yes**                                                                                                                                |
| D10 | Tablet two-pane receptionist in v1                                              | **Yes — in v1** (read from the owner's "Yes" on this row; the earlier recommendation was to defer. Confirm if that was not the intent) |

Rows D1–D9 carry no annotation from the owner, so the recommended value is treated as accepted. Keep values behind tokens so any of these stays a one-line change.
