# Sample-data mode (dev only)

The whole app runs against a fake backend held in memory, so every screen and state can be seen
without touching production (which has no listings yet) or creating real accounts.

## Turn it on

```bash
EXPO_PUBLIC_SAMPLE_DATA=1 npx expo start --dev-client --clear
```

`--clear` matters the first time: Expo inlines `EXPO_PUBLIC_*` values when it bundles. Leave the
variable off to use the real backend again (sign out first: a sample session means nothing there).

`src/shared/dev/sample/boot.ts` installs it before anything fetches. It only runs when `__DEV__`
is true, so release builds never include it.

## What it answers

`fetch` is replaced. Calls to the Supabase URL (auth and database) and to the API base URL are
answered from `src/shared/dev/sample/`; anything else (photos, Sentry) goes to the network. An
endpoint with no sample answer logs `[sample] no sample answer for …` and returns 404, so a gap
shows up as the app's own not-found state.

## Accounts

| Email | What it shows |
|---|---|
| `customer@sample.test` | Everything: bookings in every state, tickets, saved places, notifications |
| `new@sample.test` | A brand-new customer: every empty state |
| an account with a very long name and email (see `data/people.ts`) | Overflow and wrapping |

Any password signs in. The password `wrong-password` shows the sign-in error. Codes (new account,
password reset, guest-booking claim) are `123456`; any other code fails. Promo code `SAVE10` takes
10 % off.

## States covered

- Events (`data/events.ts`): on sale, free, sold out, low stock, early bird, six ticket types,
  very long title and description, no photo or details, tonight, multi-day, a photo that fails to
  load, another city, a past event.
- Hotels and apartments (`data/stays.ts`): many reviews, none, bare (nulls everywhere), very long
  text and 30+ amenities, no rooms (books on the web), a sold-out room type, several bed options,
  weekly and monthly prices, a holiday surcharge, a 7-night minimum, a paused apartment.
- Bookings (`data/people.ts`): today, upcoming, staying now, checked out, pending payment,
  cancelled, refunded, no-show, a used ticket, a free booking.

Writes (saves, bookings, payments, read marks, profile edits) last until the app reloads. A payment
opens example.com in the browser; close it and the booking shows as paid.
