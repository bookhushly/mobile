---
paths:
  - "src/app/**"
---
# Route files (Expo Router)

- Thin: read params, render a screen from `src/features/<name>/`, export `ErrorBoundary` if useful. No fetching, formatting or business logic here.
- Params are strings and untrusted: `useLocalSearchParams<{id: string}>()` then parse with a schema. Prefer it over `useGlobalSearchParams`. Don't use param names `screen`, `params`, `initial`, `state`.
- Absolute typed `href`s only (typedRoutes is on).
- Auth gating via `<Stack.Protected guard>` is UX only; `redirectTo` doesn't exist in SDK 57. RLS/server is the security. Keep the splash up until the session is restored.
- Signed-out browsing: `resolveRoute` sends a signed-out person who chose to browse to `customer`; `(auth)` is pushed on top (`authScreensAllowed`) and removed by its own guard once a session exists. While the mode loads after sign-in, a browsing person's `customer` guard still holds, so never unmount Select (or the customer stack) through sign-in. `recovery` outranks browsing. Booking and paying still need a session.
- Default exports only here (Router requires them). Check SDK 57 Router docs before using any API you aren't sure of.
- Full detail: docs/ENGINEERING_STANDARDS.md §1.
