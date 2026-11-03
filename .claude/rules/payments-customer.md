---
paths:
  - "src/features/customer/**"
  - "src/features/payments/**"
---
# Customer flows and payments

- v1 customer scope: hotels, apartments, events. No wallet payment (410 by design), no RFQ verticals.
- Prices come from the server; send selections only. Signed-out people can browse, Select and see the total; booking and paying require an account (no booking create without a session), asked for in a sign-in sheet at Continue/Save (`2026-11-03-browse-without-account-design.md`). The web still allows guest checkout.
- Payments: Paystack and crypto via `expo-web-browser` (`openAuthSessionAsync`). **The redirect is never proof of payment** — confirm via `/api/payment/status/{reference}` / verify, poll with backoff, survive app kill and resume by reference, never double-charge on retry. Crypto shows its full lifecycle (waiting/confirming/partially_paid/expired/failed/finished), never "instant".
- Rotating ticket code only with `customer_id` (holder), refresh ~28 s, fall back to the static code with a notice when offline; cache ticket details for offline viewing; prevent screen capture on rotating-code screens.
- Many flows are blocked on web work (BACKEND_STATUS §7, §9): check before building; don't work around with server actions or admin keys.
