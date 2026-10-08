# Design system

Researched 2026-10-04. **Light UI only.** Brand/direction is owner-settled (requirements §1.3); everything marked **PROPOSED** is a recommendation awaiting the owner — see §11. Contrast ratios were computed from the WCAG 2.2 relative-luminance formula. **[V]** = checked against a fetched source or the web code; **[U]** = not verified. Motion rules live in `docs/MOTION.md`.

## 1. Existing web tokens (mobile matches these unless §11 says otherwise)

Read from `../web/tailwind.config.js`, `app/globals.css`, `app/layout.js`.

| Token                       | Web value                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Primary                     | `#7C3AED`                                                                                                         |
| Violet ramp 50→950          | `#F4F1FF #EBE5FF #D9CEFF #BEA6FF #9F75FF #8B5CF6 #7C3AED #6D28D9 #5B21B6 #4C1D95 #2E1065`                         |
| Ink                         | `#1A0D4D`                                                                                                         |
| Tint / secondary            | `#F0EDF8`                                                                                                         |
| Border / input              | `#E0DBF0` (0.5 px)                                                                                                |
| Muted text                  | `#6B6987` (5.26:1 on white)                                                                                       |
| Radius base                 | 12 px (sm 8, md 10, lg 12, 3xl 16)                                                                                |
| Type scale (px/line-height) | 12/16, 14/20, 16/24, 18/28, 20/28, 24/32, 32/40, 40/48, 48/56, 64/68, 80/84 (display sizes use negative tracking) |
| Fonts                       | Radio-Canada (sans), Source Serif 4 (serif, static 500 roman + italic)                                            |
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

Hand-tuned scale anchored on the web scale (a strict modular ratio gives fractional, blurry sizes on Android). Nothing below 12. Sentence case, no uppercase eyebrows. Use weights **400 / 500 / 600** (700 only for 48+ numerals); skip 300.

| Token        | Size/LH | Weight | Tracking | Font                                       |
| ------------ | ------- | ------ | -------- | ------------------------------------------ |
| `caption`    | 12/16   | 400    | +0.2     | Radio-Canada                               |
| `labelSm`    | 12/16   | 600    | +0.2     | Radio-Canada                               |
| `label`      | 14/20   | 600    | 0        | Radio-Canada                               |
| `bodySm`     | 14/20   | 400    | 0        | Radio-Canada                               |
| `body`       | 16/24   | 400    | 0        | Radio-Canada                               |
| `bodyStrong` | 16/24   | 600    | 0        | Radio-Canada                               |
| `headline`   | 18/28   | 600    | 0        | Radio-Canada                               |
| `title`      | 20/28   | 600    | −0.2     | Radio-Canada                               |
| `titleLg`    | 24/32   | 600    | −0.3     | Radio-Canada                               |
| `displaySm`  | 32/40   | 500    | −0.64    | Source Serif 4                             |
| `display`    | 40/48   | 500    | −1.0     | Source Serif 4                             |
| `displayLg`  | 48/56   | 500    | −1.44    | Source Serif 4                             |
| `hero`       | 64/68   | 500    | −2.24    | Source Serif 4 (onboarding only)           |
| `num`        | 16–24   | 600    | 0        | Radio-Canada, tabular                      |
| `numXl`      | 48–80   | 600    | −1       | Radio-Canada, tabular (door count, timers) |

- **Fonts [V]:** static files only (no variable). `@expo-google-fonts/radio-canada` has 300–700 (+italics); `source-serif-4` has 200–900. One **family name per weight** (`RadioCanada_600SemiBold`); **never use `fontWeight`** with custom fonts [U for SDK 57]. Load via the `expo-font` **config plugin** (embedded at build, no first-frame fallback flash).
- **Glyph gap [V]:** Radio-Canada **lacks `ǹ` (U+01F9)** (falls back to the system font) but has ₦ ẹ ọ ṣ ị ụ and `tnum`. Source Serif 4 has all of them (the web comment claiming `ǹ` in Radio-Canada is wrong). See D7.
- **Tabular numerals** (`fontVariant: ['tabular-nums']`) on all money, counts, timers, tables so digits don't jitter — test on device [U for RN 0.86].
- **Source Serif 4:** display/pull numbers only, ≥32 px, weight 500, never on controls, inputs, scan results, or text <24 px.
- **Dynamic Type:** keep `allowFontScaling` on; `maxFontSizeMultiplier`: body/labels 1.6, titles 1.3, display/numXl 1.0–1.15, gate result screens 1.0 (fixed huge layout). Never cap form labels/inputs below 1.3. Test iOS Accessibility 3 / Android 200 %.
- Money via one `Money` component (₦ + tabular, integer kobo/naira, `Intl en-NG`).

## 4. Colour

**Violet** — use the web ramp. `600` fills; `700` pressed fill **and small violet text**; `50/100` washes. Never violet-500 for text (4.23:1).

**Neutrals (violet-tinted)**

| Token        | Hex       | Role                                  |
| ------------ | --------- | ------------------------------------- |
| `surface`    | `#FFFFFF` | cards, sheets, inputs                 |
| `canvas`     | `#F8F7FB` | app background (D2)                   |
| `wash`       | `#F0EDF8` | selected rows, chips, secondary fills |
| `line`       | `#E0DBF0` | decorative dividers, card borders     |
| `lineStrong` | `#857FA8` | input/control borders (3.75:1)        |
| `inkMuted`   | `#6B6987` | secondary text                        |
| `inkSoft`    | `#4A4670` | captions on tinted fills (8.75:1)     |
| `ink`        | `#1A0D4D` | headings, body                        |

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

Radius: `r1` 4 (tags) · `r2` 8 (chips) · `r3` **12** (default: buttons, inputs, cards) · `r4` 16 (sheets, images) · `rFull`. Use `borderCurve: 'continuous'` on iOS [U].

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
- Image ratios: listing card 4:3, detail gallery 16:10, thumbs 1:1, event poster 4:5; reserve space; `expo-image` + blurhash/`wash` placeholder; **no stock imagery posing as inventory** — no photo = neutral `wash` block + icon.
- Loading: skeletons mirroring layout, only after 150 ms, none under Reduce Motion; inline spinners for actions.
- Empty: icon + one-line reason + one action. Error: what happened, whether data/money is safe, next step, retry; never raw codes.

## 7. UX principles by mode

**Customer** — progressive disclosure (filters in a sheet; price breakdown collapsible, **total always visible**); primary action pinned in a bottom bar (thumb zone); exact ₦ total before the Paystack handoff; lock countdown; pending state, never fake success. Forms: top labels, one column, per-field `keyboardType`, validate on blur, preserve input on error. Phone: accept `0803…`/`803…`/`+234803…` → E.164 on blur; amounts `₦` + separators, store integers; address = state → area + free-text landmark. Ticket: QR as large as possible, ink on white, auto-brightness, keep awake.

**Gate** — camera first; result takes the **whole screen** (refusals hold until dismissed), dismiss target large in the lower half; controls in the lower third ≥56 pt, ≥16 apart; no precision gestures; counter + sync state always visible; no undo.

**Receptionist** — scan/type the 8-char code → confirmation summary (guest, room type, dates, payment) → one "Check in" button; blockers shown above it in words. Tablet ≥768: two-pane (list | detail), 24 gutters, `work` density.

**Microcopy** — sentence case, verb-first ("Pay ₦45,000"), plain words, no exclamation marks, no blame ("We couldn't reach the server"), no jokes on money failures or at the gate.

## 8. Tokens in code

```
src/shared/theme/  tokens.ts (private) · theme.ts (roles, textTone, surfaceTone) · type.ts · density.ts · elevation.ts · motion.ts · sizes.ts · fonts.ts · contrast.ts · index.ts
src/shared/ui/     Text · Box · Stack · Inline · Card · Icon · Money · formatNaira · Button · IconButton · ToggleButton · TextLink · Input · SearchField · PinField · Screen · Header · Sheet · ListRow · SectionHeader · SegmentedControl · Divider · StatusPill · Banner · EmptyState · ErrorState · Skeleton · SkeletonRows · Spinner · Illustration · SuccessMark · OutcomeScreen · OutcomeAction · ShellPlaceholder · DensityProvider · useDensity · useDensityName · useMotionTier · PressableScale
```

- Screens import **semantic roles only** (`color.action`, `color.outcome.admitted`), never the palette.
- `Text` is the only text renderer: variant → family/size/line-height/tracking; weight → family name; sets `maxFontSizeMultiplier`.
- `Box`/`Stack` props are token-key unions (`p="s5"`), so `p={13}` fails to compile.
- Lint/hook backstops: no hex / numeric spacing / `fontWeight` outside `src/shared/theme/` and `src/shared/ui/`; a test asserting every semantic text/background pair meets its contrast target.
- `userInterfaceStyle: "light"` is set in `app.json`.

## 9. Reference patterns (Mobbin, iOS; links returned by the tool)

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
- **Offline/error:** inline banner ([Alta](https://mobbin.com/screens/2b00c4b9-d2a6-4a6a-9d95-2aba49348be1)) unless nothing cached ([Qantas](https://mobbin.com/screens/18f77caf-19d5-4199-98b4-a36f34096d23)).

**Skip:** fake urgency, promo banners above search, chat bubbles over CTAs, jokey failure copy, Wallet-only tickets, embedded live maps/autoplay video, heavy blur/glass/shadows, fees revealed late, connectivity-dependent rotating-QR validation at the door, confetti at the gate.

**Low-end/data:** ≤~400 px WebP + blurhash, lazy rails, virtualised lists, minimal shadows/blur, apply filters locally and fetch on CTA, cache tickets/bookings/roster, static map image + "Open in Maps".

## 10. DO / DON'T

- DO `#6D28D9` for small violet text; `#7C3AED` for fills and ≥16 semibold text. DON'T `#9E98BB` or violet-500 for text.
- DO 3:1 borders on inputs (`lineStrong`); `line` is decorative.
- DO 44/48 targets; colour + icon + text for every outcome; tabular figures for numbers.
- DON'T cap font scaling on forms; DON'T use Source Serif <24 px or on controls; DON'T use violet for status or large fills.
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
| D7  | Missing `ǹ`: system fallback vs Source Serif 4                                  | **Accept fallback**                                                                                                                    |
| D8  | Source Serif limited to ≥32 px display                                          | **Yes**                                                                                                                                |
| D9  | Gate full-screen solid fills break 70/20/10                                     | **Yes**                                                                                                                                |
| D10 | Tablet two-pane receptionist in v1                                              | **Yes — in v1** (read from the owner's "Yes" on this row; the earlier recommendation was to defer. Confirm if that was not the intent) |

Rows D1–D9 carry no annotation from the owner, so the recommended value is treated as accepted. Keep values behind tokens so any of these stays a one-line change.
