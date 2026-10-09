# UI-B entry and account screens: Mobbin references

Collected 2026-10-08 for UI-B (welcome, sign-up, email code, password reset, account deletion, customer tour). All iOS, from Mobbin; each link opens the exact screen. For every app: **what we take** and **what we leave out**. Colours, type and spacing always come from `docs/DESIGN_SYSTEM.md`; the UI-A gate references are in `2026-10-08-ui-a-gate-mobbin.md`.

---

## 1. Welcome (signed out)

| App | Screen | What we take | What we leave out |
|---|---|---|---|
| Oportun | [Reach for your goals](https://mobbin.com/screens/404693d9-e018-4f5f-be9b-0beff043ae16) | Illustration in the upper half, a large left-aligned headline with one supporting sentence, two buttons side by side at the bottom. | Busy multicolour illustration. |
| Kit | [Welcome to Kit](https://mobbin.com/screens/1918717c-4c7a-4e78-bdc2-130fb7dcc317) | Left-aligned brand-first headline; "Log in" and "Create account" stacked at the bottom with a one-line terms note under them. | Mascot peeking from the bottom. |
| monday.com | [Log in / Create](https://mobbin.com/screens/12b4553e-1a96-491b-b44b-2802c1a73ddb) | Logo + one-line promise at the top, primary/secondary stacked full-width buttons in the thumb zone. | Decorative sparkles. |
| Duolingo | [Get started](https://mobbin.com/screens/fb4eda98-538d-4bc0-9ef6-bf06ed401c12) | "Get started" primary + "I already have an account" secondary: the new user is the primary path. | Centred-everything layout and all-caps labels (our rule: sentence case, no centred hero). |
| inDrive | [Fair deals](https://mobbin.com/screens/f7928997-d762-482a-abe5-0310289f5411) | Terms and privacy links in small text under the buttons. | Phone/passkey sign-in (we use email + password). |
| Alan | [Hello](https://mobbin.com/screens/21080b03-a1f7-4113-8a57-b7dee60054d2) | — | 3D mascot, centred hero. |

**Ours:** wordmark top-left · SVG illustration (stays + events + ticket) · serif `display` headline left-aligned ("Book stays and events across Nigeria") · one sentence · bottom: **Create account** (primary), **Sign in** (secondary), small terms/privacy line.

## 2. Sign-up with password rules

| App | Screen | What we take | What we leave out |
|---|---|---|---|
| ElevenReader | [Sign up to get started](https://mobbin.com/screens/2d7cff24-9533-49a6-a626-b231f8292ad7) | Plain top-label fields (Name, Email, Password) on one column; a short rules checklist under the password; disabled CTA until valid; terms line. | Marketing-consent checkbox. |
| Rocket Money | [Set your password](https://mobbin.com/screens/c0ba7943-75bb-4fa4-842e-f1f92193a2c0) | Rules turn green with a check as each is met, live while typing. | — |
| Crate & Barrel | [Create account](https://mobbin.com/screens/4052e2c0-e7a5-4fdb-b03d-ad16cba633cc) | Symbol rule listing the exact allowed symbols; "Already have an account? Sign in" under the button. | Red error paragraph above the checklist (the checklist already says it). |
| Binance | [Create a password](https://mobbin.com/screens/8b0dc4dd-5651-42f0-883e-90f5aa20c9c3) | Show/hide eye and clear inside the field; compact rule rows. | — |
| foodpanda | [Password](https://mobbin.com/screens/966b8494-666c-433f-bb34-0e963bc39287) | Neutral (unmet) vs met state per rule, not red before the user tries. | Strength bar and "continue without password". |
| Best Buy | [Create account](https://mobbin.com/screens/11dbb5d2-b08b-44cf-8dc5-dcecf1989382) | — | Strength meter (rules are pass/fail on our server). |

**Ours:** Name · Email · Password (eye toggle) · live checklist: 8+ characters, upper case, lower case, a number, one of `@$!%*?&` · **Create account** · "Already have an account? Sign in" · terms line.

## 3. Email code (sign-up and reset)

| App | Screen | What we take | What we leave out |
|---|---|---|---|
| CapCut | [Enter a 6-digit code](https://mobbin.com/screens/d03733f5-fe18-4c89-8d2b-4ed86fa99933) | Title "Enter the 6-digit code", masked email line, six boxes, "Resend code 55 seconds" countdown, Continue. | — |
| Strava | [We sent you a code](https://mobbin.com/screens/acf6aad3-e301-4b63-9939-5c34002eb331) | "Get a new code" button disabled with "Try again in 00:09"; **Open email app** link. | — |
| Yami | [Verify your email](https://mobbin.com/screens/59194a3e-2a7f-4358-8ffa-1a8e712867a8) | Email shown with **Edit** (wrong address escape); "Verifying…" state under the boxes; auto-submit on the 6th digit. | — |
| Coffee Meets Bagel | [Verify your email](https://mobbin.com/screens/feb00133-37e9-434b-94e3-e7811ca0bc6f) | "Check your spam or junk folder" hint. | — |
| TikTok | [Verify your email](https://mobbin.com/screens/c085835a-432d-4b9b-9ae5-da457749413f) | Number pad keyboard; the code also arrives as a link for web. | Underline-only boxes (weak target). |
| Zomato | [Verify new account](https://mobbin.com/screens/1f3e08c4-622a-4aeb-8720-a505b7c8bb0a) | Spinner beside the boxes while verifying. | Full keyboard for a numeric code. |

**Ours:** reuses the kit `PinField` style (six boxes, one hidden input, `oneTimeCode` autofill) · email with **Change** · auto-verify on 6 digits · "Send a new code" with a 60 s countdown · "Check spam or junk" · **Open email app**.

## 4. Account deletion

| App | Screen | What we take | What we leave out |
|---|---|---|---|
| Clue | [Delete your account](https://mobbin.com/screens/f52351d2-0383-427c-875a-b02fa5c31827) | Plain explanation that it can't be undone; password field with "I forgot my password". | Coloured primary for a destructive action. |
| komoot | [Delete account](https://mobbin.com/screens/2fa20e19-0e6d-4b50-b413-1af256eeb769) | Card showing **which account** is being deleted (name + email); disabled delete until the password is entered; Cancel. | — |
| Fresha | [Confirm you are happy to proceed](https://mobbin.com/screens/fc7ff522-1aa1-4475-8781-9d08f4d7a525) | Red destructive button pinned to the bottom. | Email re-entry (we show it instead). |
| Plex | [Delete account](https://mobbin.com/screens/54bebb78-abbd-4c93-a9d1-24f393dc6caf) | "Before you go" list of what deletion does and doesn't fix. | Dark theme; wall of text. |
| Shell | [Delete account](https://mobbin.com/screens/bfd03e7c-8d3c-4e42-86d3-0f6321cd03b5) | — | Email-support-only deletion (not allowed by the stores). |
| YNAB | [Delete confirmation](https://mobbin.com/screens/c055bf15-7813-4987-82ee-1df8f8b49522) | — | Upsell links before deleting. |

**Ours:** account card (email) · short list: what is removed, what we must keep (booking and payment records, anonymised), can't be undone · server refusal reasons shown as a banner (booking not yet ended, wallet balance, open dispute) · password + type `DELETE` · destructive **Delete account** pinned at the bottom · Cancel.

## 5. Customer intro tour

| App | Screen | What we take | What we leave out |
|---|---|---|---|
| Too Good To Go | [Get ready](https://mobbin.com/screens/acb20a50-a54c-408a-a994-c72f16b242ee) | One illustration, short headline, one sentence, page dots, single **Next** button at the bottom. | All-caps headline. |
| Bumble | [Discover](https://mobbin.com/screens/ff1dc5db-0596-4185-8c14-93619a9d8101) | Illustration in the top half, left-aligned headline + body below, Close (skip) top-right. | Arrow-only pager. |
| Lifesum | [Life score](https://mobbin.com/screens/94acf22a-4b69-4954-9e9e-c9372176cff1) | Close top-right as the skip. | Full-bleed brand colour fill (violet is never a large fill). |
| Structured | [Helps you](https://mobbin.com/screens/eeccf538-67f4-4fd4-b551-dc2ef6e27bf6) | **Skip** text top-right. | Coloured background. |
| ANZ Plus | [New home](https://mobbin.com/screens/18c6b51e-d445-4399-8b1e-0ecb95f03977) | Illustration band + centred dots. | — |
| Believe | [A belief is launched](https://mobbin.com/screens/bdb07679-13bd-45cd-b192-fb74b25b8009) | — | Progress bar and side arrows. |

**Ours:** 3 screens (Find · Pay · Show up) · `Illustration` top half (SVG now, Lottie later per MOTION M6) · serif headline + one sentence · dots · **Next** / **Get started** · **Skip** top-right · swipe between screens; no autoplay; static under Reduce Motion.
