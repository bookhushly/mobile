# UI-B — Entry flow, native accounts and customer tour (design)

**Status:** approved in conversation 2026-10-08 · **Branch:** `feat/ui-b-entry-accounts` · **Builds on:** UI-A kit (`2026-10-08-ui-a-foundation-gate-design.md`) · **Requirements:** FR-1.1, FR-1.2, FR-1.3, FR-1.8 (deletion), FR-1.9, FR-1.10 · **Backend:** web PR #206 (`../web/docs/mobile/NATIVE_AUTH_API.md`), verified against web `origin/main` @ `30c7da90` · **References:** `docs/design-references/2026-10-08-ui-b-entry-accounts-mobbin.md`.

## 1. Goal and success

A new customer can create an account, confirm it with the emailed 6-digit code, sign in, reset a forgotten password and delete the account, all inside the app; every screen a user sees before their mode loads is built from the UI-A kit; the customer intro tour exists and is ready to switch on in Phase 4.

Done when: the flows in §3 work end to end against production on the Moto G06 with the QA customer (and a throwaway account created and deleted through the app itself, leaving no test data behind); transient failures never appear as refusals; `tsc`, lint and jest pass; the phone checklist's new UI-B section passes.

## 2. Decisions

1. **Welcome every time signed out** (owner, 2026-10-08): the landing screen offers **Create account** (primary) and **Sign in** (secondary).
2. **Tour = Find · Pay · Show up** (owner): 3 skippable screens, once per account per device, after the mode resolves to customer; built now behind `CUSTOMER_TOUR_ENABLED = false` until Phase 4.
3. **Delete account re-auth in the app** (owner): the user enters their password and types `DELETE`; the app checks the password with `signInWithPassword` (so an outage is never shown as "wrong password") and calls `/api/account/delete` **without** `password`. Available to customers and gate staff (role `customer`); hidden for receptionists (server returns 403 `not_customer`).
4. **Leaving the new-password screen signs out** (owner): a reset code alone never leaves anyone signed in.
5. **6-digit code, no universal links** for auth (decided earlier; web emails from the JSON routes always carry the code).
6. **Never `supabase.auth.signUp`**: it creates an auth user with no `users` row or wallet. Sign-up goes only through `POST /api/auth/signup`. Password changes go only through `/api/auth/reset-password`, never `updateUser`.
7. **No location prompt at sign-up**: `coords` is not sent (the server falls back to IP).
8. **`email_taken` is ambiguous** (confirmed or not): the app offers "Sign in instead" and "Verify this email" (resend → code screen).

## 3. Flows and screens

All signed-out screens live in the `(auth)` route group (customer density). Layout and patterns per the Mobbin references.

| Screen | Content |
|---|---|
| **Welcome** | Wordmark top-left · `Illustration` (new scene `welcome`) · serif `display` headline "Book stays and events across Nigeria" · one sentence · bottom: **Create account**, **Sign in** · terms and privacy links (open bookhushly.com pages) |
| **Sign in** | Email · Password (show/hide) · **Sign in** · "Forgot password?" · "New here? Create account" |
| **Create account** | Name · Email · Password (show/hide) + live rules checklist (8+ characters, upper case, lower case, a number, one of `@$!%*?&`; and under 72 bytes) · **Create account** (enabled when valid) · "Already have an account? Sign in" · terms line |
| **Enter code** | "Enter the 6-digit code" · "Sent to a•••@gmail.com" + **Change** · six boxes (kit `PinField` style, visible digits, `oneTimeCode` autofill) · verifies automatically on the 6th digit ("Verifying…") · **Send a new code** with a 60 s countdown · "Check spam or junk" · **Open email app** |
| **Forgot password** | Email · **Send code** → always continues to Enter code ("If an account exists, we sent a code") |
| **New password** | Password + rules checklist · **Save password**; Back/Close = sign out (decision 4) |

Flows:
1. **Sign-up:** `signUp` 201 → Enter code (`signup`) → `verifyOtp` returns a session → route resolution → customer mode (tour if enabled and unseen).
2. **Sign-up 409 `email_taken`:** inline banner with **Sign in instead** and **Verify this email** (→ `resendConfirmation` → Enter code). Also used when a timed-out sign-up is retried and gets 409.
3. **Sign-in with unconfirmed email:** `resendConfirmation` → Enter code, title "Confirm your email first".
4. **Forgot password:** `forgotPassword` 202 → Enter code (`recovery`) → `verifyOtp` (recovery state on) → New password → `resetPassword` 200 → recovery off → mode.
5. **Delete account** (signed in, from Account: the gate account sheet now; the customer shell's new Account section): account card (email) · what is removed, what is kept (booking and payment records, anonymised), cannot be undone · Password + type `DELETE` · destructive **Delete account** pinned at the bottom · Cancel. Order: unsynced-admissions warning if the gate outbox has pending items → password check (`signInWithPassword`) → `deleteAccount` → on 200 sign out locally and wipe (same path as sign-out) → Welcome with a "Your account was deleted" banner. 409 shows each blocker's `detail`; 403 shows the server message.
6. **Tour:** 3 screens (illustrations `find`, `pay`, `showUp`), serif headline + one sentence, dots, **Next** / **Get started**, **Skip** top-right, swipe; marks `tourSeen` on finish or skip.

Pre-mode screens (rebuilt on the kit): **Loading** (after 2 s on the splash: logo + "Loading your account…") · **Update required** (illustration, **Update**; with no store URL, "Update Bookhushly from the Play Store / App Store") · **Mode error** (what happened, **Try again**; Sign out shows the unsynced-admissions warning via the existing guard) · **Web-only** (who is signed in, **Open bookhushly.com**, Sign out).

## 4. Architecture

| Unit | Where | Job |
|---|---|---|
| `accountApi.ts` | `features/auth/api/` | `signUp`, `resendConfirmation`, `forgotPassword`, `resetPassword(token, password)`, `deleteAccount(token)` through the shared API client; zod-parsed `Result` with kinds `ok · invalid · emailTaken · weakPassword · notCustomer · blocked · unauthorized · transient · failed`. Transient = 429 (with `retry_after`), 503 without `code`, timeout, network. |
| `session.ts` (extended) | `features/auth/api/` | `verifyCode(email, code, type)` → `verifyOtp`; maps invalid/expired → `badCode`; sign-in error kinds gain `emailNotConfirmed` (code `email_not_confirmed`, message fallback) and `accountClosed` (`user_banned`). `checkPassword(email, password)` for deletion. |
| `useAuth` (extended) | `features/auth/hooks/` | `recovery: boolean` + `beginRecovery`, `finishRecovery`, `abandonRecovery`; marker in SecureStore (`bh.auth.recovery`) cleared on finish; a cold start that finds it signs out locally. |
| `resolveRoute` (extended) | `features/mode/domain/route.ts` | `recovery` → `auth` route even when signed in. |
| `passwordRules.ts` | `features/auth/domain/` | Pure: per-rule met/unmet + `tooLong` (UTF-8 bytes > 72); same rules as the server. |
| `signUpErrors.ts` | `features/auth/domain/` | Server `fields` / rule ids → field messages. |
| `cooldown.ts` | `shared/lib/` | Pure countdown from a start time and `retry_after`. |
| `deletionPlan.ts` | `features/auth/domain/` | `(outboxPending, response) → 'confirm' \| 'warnUnsynced' \| 'blocked' \| 'done'`. |
| `maskEmail.ts` | `shared/lib/` | `adaeze@gmail.com` → `a•••e@gmail.com`. |
| Screens | `features/auth/screens/` | `WelcomeScreen`, `SignInScreen` (redesign), `SignUpScreen`, `CodeScreen`, `ForgotPasswordScreen`, `NewPasswordScreen`, `DeleteAccountScreen` (presentational; logic in hooks). |
| Routes | `src/app/(auth)/` | `index` (Welcome), `sign-in`, `sign-up`, `code`, `forgot-password`, `new-password`; `src/app/delete-account.tsx` (signed-in, any mode that allows it). |
| Tour | `features/customer/` | `TourScreen`, `useTourSeen(userId)`; `CUSTOMER_TOUR_ENABLED` in `shared/config`. |
| Kit additions | `shared/ui/` | `Illustration` scenes `welcome`, `find`, `pay`, `showUp`; `CodeField` (visible-digit variant of `PinField`); `PasswordField` (Input + eye toggle); `RuleList` (met/unmet rows, neutral before first input, never red). |

All new strings sentence case; `src/shared/ui` still imports no feature.

## 5. Error handling

- Transient (429, 503 without `code`, timeout, network) → neutral `Banner` "We couldn't reach Bookhushly — try again in a minute" (with seconds when `retry_after` is known); the form keeps its input; never red.
- Field errors from the server shown under the field (mapped by `signUpErrors`); never raw codes.
- Wrong or expired code → "That code is wrong or has expired" + **Send a new code**; after 5 wrong codes in a row, suggest **Send a new code** only.
- `resendConfirmation` / `forgotPassword` always continue (202) — no account existence leak.
- Deletion: 401 after an uncertain request → `refreshSession()`; `user_banned` → treat as deleted. Wrong password (our own `signInWithPassword` with `invalid_credentials`) → "That password isn't right"; its transient errors → neutral banner.
- Banned sign-in → "This account was closed. Contact support@bookhushly.com if this is a mistake."

## 6. Accessibility and motion

Targets ≥ 44 pt; fields keep labels and linked errors (kit `Input`); the rules checklist announces each rule state change politely; the code field is one input with `oneTimeCode`; tour screens are swipeable and also navigable with Next/Back buttons, static under Reduce Motion, no autoplay; serif only for display ≥ 32 px headlines.

## 7. Testing

- TDD for `passwordRules` (each rule, 72-byte boundary with multibyte input), `signUpErrors`, `cooldown`, `deletionPlan`, `maskEmail`, route resolution with `recovery`, `accountApi` response parsing (every status in §4 incl. 503 with and without `code`, 429 `retry_after`), sign-in error mapping (`email_not_confirmed`, `user_banned`).
- RNTL: each screen's validation and states; flows with mocked API (sign-up → code → signed in; 409 options; unconfirmed sign-in → code; forgot → code → new password → saved; leaving new password signs out; delete with blockers / wrong password / success → wipe called; unsynced warning).
- Never call production from tests. Device run: create a throwaway account through the app, verify, reset its password, delete it; the QA customer is used only to sign in.
- Reviews: `backend-contract-checker` (client vs contract), `mobile-security-reviewer` (auth/session/deletion), `ux-design-reviewer`, `rn-code-reviewer`, final whole-branch review.

## 8. Docs

`docs/BACKEND_STATUS.md`: §6 replaced with the verified native-auth contract summary, new §6a deletion, §9 drops "Signup route" and "account deletion" and lists what is still open on web (delete route's `invalid_password` for transient errors; X-App-Version unread; shared IP-keyed auth bucket; plain `signUp` still possible; recovery/unconfirmed behaviour unverified; production deploy of #206 to confirm). Phone checklist gains a UI-B section.

## 9. Out of scope

Customer screens beyond the Account section (Phase 4) · biometric app lock (FR-1.7) · universal links · social sign-in · change email · in-app password change while signed in (only reset) · Lottie assets.
