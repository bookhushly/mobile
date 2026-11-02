# Auth UI upgrade and app-wide type change: design

Date: 2026-11-02. First section of the "major UI upgrade", which proceeds section by section.

Approved mockups are throwaway HTML in `.superpowers/brainstorm/88157-1793625619/content/` (gitignored): `signin-style.html` (welcome and S1 sign-in), `auth-set.html` (other auth screens, keyboard state; apply the type from column B, not its 700 headlines) and `font-weight-test.html` (column B is the type recipe).

## Why

The owner finds the current UI bland, unprofessional and demo-like. Today's welcome screen is a text title, an illustration and two buttons, and the forms are plain pages. The owner also found Radio Canada plus Source Serif "off" next to the sites Nigerian customers use, which set in clean neutral sans-serifs (Tix.africa: Avenir; Booking.com, Paystack, Travelstart: system font; Airbnb: Cereal).

Bookhushly sells events, serviced apartments and hotels, so the auth section should not read as belonging to one category.

**Success:** the auth screens look like a premium, shipped consumer product; a person sees that Bookhushly covers all three categories before signing in; nothing about how auth behaves changes.

## Goals

1. Redesign the six auth screens: welcome, sign in, sign up, email code, forgot password, new password.
2. Replace the app's typefaces with Hanken Grotesk everywhere.
3. Record the new type and imagery decisions in the docs so later sections build on them.

## Non-goals

- Redesigning any other section. Gate, receptionist and customer screens change only by inheriting the new font.
- Changing the web. It stays on Radio Canada and Source Serif 4 unless the owner says otherwise, so app and web fonts differ for now.
- Changing the colour palette. Violet `#7C3AED` and ink `#1A0D4D` match the web and stay.
- Dark mode, social sign-in, a staff-specific entry point.
- `DeleteAccountScreen`, which is not part of this flow. It inherits the font only.

## Anti-goals

- Any behaviour change to auth beyond the two new back buttons: validation, error copy and taxonomy, retry and cooldown rules, existing navigation targets, session handling, and the transient-failure-is-not-a-refusal rule all stay exactly as they are.
- A form whose fields or button get hidden by the keyboard or by large OS text sizes.
- Decorative gradients, glows, chips or badges. The one allowed gradient is the legibility fade described below.
- Photos that look like Bookhushly inventory. These are brand imagery only and never appear as listings (DESIGN_SYSTEM §6).

## Decided by the owner

### Type: Hanken Grotesk, "recipe B"

Hanken Grotesk replaces both Radio Canada and Source Serif 4 across the whole app. There is no serif any more.

| Role | Weight | Letter spacing |
| --- | --- | --- |
| Headlines (all `display*`, `hero`) | 600 | about -2% of size |
| Field labels | 500 | 0 |
| Buttons and text links | 600 | 0 |
| Body and input text | 400 | 0 |

Claude's call: the 500 weight applies to form field labels only, through a new field-label variant used by `Input` and the field components. The shared `label` variant stays 600, because `TextLink`, gate controls and receptionist sheets also use it and those screens should change only by inheriting the font. Other variants keep their current sizes and weights unless a row above says otherwise.

### Welcome: E2, full-bleed

The photo fills the whole screen edge to edge. Stacked at the bottom, over a dark fade: headline "Events, stays and hotels across Nigeria.", subline "Find it, book it, pay in naira.", a white "Create account" button, a white "Sign in" text link, and the terms line. The white Bookhushly wordmark sits at the top left (the owner pointed to the web's logo files; `web/public/logo-wordmark.png` recoloured white is what the mockup used).

### Forms: S1, sheet over the photo

Each form screen shows a photo band at the top with a white rounded sheet overlapping it. The sheet holds a left-aligned headline, the existing sub-copy, the fields and a violet main button. A round back button sits on the photo on sign in, sign up, email code and forgot password. `NewPasswordScreen` keeps its X (cancel) rather than a back arrow.

**Back buttons on sign up and email code are new** and the owner approved them; they are the one deliberate navigation addition. Both go back to the previous screen, as the gesture or hardware back does.

**The photo is continuous (owner's decision).** Whichever photo is showing on Welcome when the person taps stays in place, and the sheet slides up over it. This needs the current photo shared across the auth routes and a custom transition in `src/app/(auth)/_layout.tsx` instead of the default stack push. Moving between form screens keeps the same photo too. A form reached without passing through Welcome, such as a deep link into new password, uses a default photo. Under Reduce Motion, the sheet appears without sliding.

### Images

Free, licence-clean placeholder photos (Unsplash), bundled in the app and not hot-linked. They live in one folder with a list of where each came from, so the owner can swap the files later without touching code.

### Accepted from the mockup review

The owner said "this is good" to these, which were proposed by Claude:

- The photo band gets shorter as forms get longer: sign up shortest; email code, forgot and new password taller; sign in in between.
- When the keyboard opens, the photo moves away so the fields and main button stay visible.
- All five password rules stay visible on sign up. The sheet scrolls on smaller phones.
- The email code shows six separate boxes. `CodeField` already renders this over one hidden one-time-code input, so paste and autofill keep working. `ClaimSheet` in the customer section shares it, so any restyling reaches that screen too.
- The main button is white on the photo and violet on forms.
- The welcome photo slowly cycles through an event, an apartment and a hotel.
- The font change reaches gate and receptionist screens now.

## Constraints

- **Font files, native rebuild:** fonts are embedded by the `expo-font` config plugin in `app.json`, so this change requires a new dev build and store build. An OTA update cannot deliver it. Static files only, one family name per weight, never `fontWeight` (`src/shared/theme/fonts.ts`, DESIGN_SYSTEM §3). Package: `@expo-google-fonts/hanken-grotesk`, installed with `npx expo install`. The iOS PostScript name pattern is `HankenGrotesk-SemiBold`.
- **Verified font facts:** the static files have ẹ ọ ị ụ, Ẹ Ọ and the combining marks, but **no ₦ and no ṣ/Ṣ**, so those characters fall back to the system font. Digits are all 560 units wide in 400, 500 and 600, so numbers are already tabular even though the font has no `tnum` feature; `tabular` is harmless and gate counters and timers won't jitter.
- **Motion:** only transform and opacity via Reanimated, durations from motion tokens, and every animation reads `useMotionTier()` (`.claude/rules/motion.md`). Under OS Reduce Motion the welcome photo must not cycle. It also stops when unfocused or backgrounded.
- **Images:** `expo-image` with explicit size and `contentFit`. Keep bundled photos small: the app is used on low-end Android phones.
- **Accessibility:** white text must stay readable over every welcome photo, so the fade must carry the contrast rather than the photo. Touch targets at least 44 pt, min text 12 px, No new caps on OS font scaling; the existing per-variant `maxScale` values stay (Claude's call), and the sheet must cope with them. All controls keep their current accessibility labels and roles.
- **Project rules:** tokens only (no raw hex), hooks reject `fontWeight`, animated layout props and cross-feature imports. Before any Expo API use, check SDK 57 docs. Existing screen tests keep passing; tests that assert font family names (`src/features/customer/screens/__tests__/CheckInCodeScreen.test.tsx:58`) are updated to the new names.

### Claude's calls on the email code screen

`CodeScreen` keeps `autoFocus`, so the keyboard opens on arrival as it does today and one-time-code autofill stays one step away. The photo band is therefore mostly seen while the keyboard is closed, and the entry transition must handle the photo leaving straight away.

## Must check on a real device

1. **₦ next to Hanken digits.** It shows in prices in the customer section. If the mismatch is ugly, report it to the owner rather than deciding silently; options are "NGN" text or a custom-drawn ₦.
2. Recipe B at phone size. The owner chose it on a laptop browser, which draws type heavier than a phone.
3. The sheet with the keyboard open on a small Android phone and at large OS text size.
4. Layout fallout from the new font across gate, receptionist and customer screens: truncation, wrapping and button fit, since Hanken's widths differ from Radio Canada's. Gate outcome screens are the priority.

## Docs to update

`CLAUDE.md` (Design section), `docs/DESIGN_SYSTEM.md` (fonts row, type table, §3 font notes, glyph gap, D7, D8 and the serif rules, plus a line allowing the photo legibility fade), `docs/MOBILE_APP_REQUIREMENTS.md` §1.3 type line, `.claude/rules/design-system.md`, `.claude/rules/components-ui.md` and `.claude/agents/ux-design-reviewer.md`. `docs/ENGINEERING_STANDARDS.md` where it names the fonts. Dated plans and specs stay as written.

Hanken Grotesk's lack of ₦ and ṣ/Ṣ reverses the earlier reason for choosing the fonts. Record that the owner made this choice deliberately, and why.

## Left to the builder

- How to build the fade without breaking rules. `expo-linear-gradient` is not installed; a bundled PNG overlay or a dependency are both acceptable. Verify against SDK 57 docs.
- Whether the photo-and-sheet layout is a new shared component (likely, `src/features/auth/components/` since only auth uses it now) and how the keyboard behaviour is implemented, within the motion rules.
- Exact band heights, sheet radius (DESIGN_SYSTEM `r4` is a good start), cycle timing and transition, and which placeholder photos, as long as all three categories are covered.
- The `notice="accountDeleted"` banner on Welcome must stay and stay readable on the photo; the builder picks its placement.
- Removing the now-unused Radio Canada and Source Serif packages and font files, and the `welcome` illustration if nothing else uses it.

## Changes after the 2026-11-02 critique (owner approved)

Welcome only: headline 36/40 (`displayMd`) and subline 18/26 at 500 (`lead`); spacing headline, 12, subline, 32, main button, 12, second button, 24, legal; "Sign in" becomes the white outline button; Terms and Privacy links are underlined over the photo; headline, subline and actions enter one after another with a small fade and lift, skipped under Reduce Motion. Hotel placeholder swapped for a brighter photo with its subject in the top half. The top fade holds full strength past the status bar and logo, then eases out, so both read on any photo.

Rejected from the critique because they conflict with owner decisions or the code: Fraunces or Plus Jakarta Sans (banned list), amber or terracotta buttons (violet is the brand), blurhash (photos are bundled), larger buttons on this screen alone (48 pt and 12 pt radius are app-wide).

Browsing without an account was accepted as the **next project**, separate from this one.
