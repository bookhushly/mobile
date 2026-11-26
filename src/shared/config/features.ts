// Build-time switches. Flip here, never at runtime. Read through a typed object so the exported
// value is `boolean` (not the literal) and the branches behind a switch stay reachable to the
// type checker and lint while it is off.
type Features = {
  customerTour: boolean;
  checkoutStays: boolean;
  checkoutEvents: boolean;
  checkoutPayments: boolean;
  vendorMode: boolean;
  vendorLiveData: boolean;
};

const features: Features = {
  // Find · Pay · Show up intro tour (spec 2026-10-08 UI-B §2 decision 2), switched on in Phase 4b
  // (spec D15) now that there is something to browse. A test pins it on.
  customerTour: true,
  // Phase 4c kill switch (spec P2): in-app hotel and apartment booking. On since 2026-10-21, when
  // web #219/#221 (stay create, server-priced initialise) were deployed. A test pins it.
  checkoutStays: true,
  // Phase 4c kill switch (spec P2): in-app event booking.
  checkoutEvents: true,
  // Phase 4c kill switch (spec P2): in-app payment (Paystack initialise/verify).
  checkoutPayments: true,
  // Vendor mode (DECISION-11): dev builds only until the web vendor routes ship
  // (docs/superpowers/specs/2026-11-25-vendor-web-routes.md); until then it runs on sample data.
  vendorMode: __DEV__,
  // Vendor mode reads and writes the web's vendor routes (web PR #248) instead of sample data, for
  // car rental, logistics and security companies and the wallet, plus hotel and apartment bookings
  // (`/api/vendor/bookings`) and apartment status changes. On since 2026-11-26, when the PR #248
  // routes went live on production (probe: JSON 401 `unauthorized`). Events, the apartment calendar
  // and the fleet stay on sample data until their routes are wired.
  vendorLiveData: true,
};

export const CUSTOMER_TOUR_ENABLED = features.customerTour;
export const CHECKOUT_STAYS_ENABLED = features.checkoutStays;
export const CHECKOUT_EVENTS_ENABLED = features.checkoutEvents;
export const CHECKOUT_PAYMENTS_ENABLED = features.checkoutPayments;
export const VENDOR_MODE_ENABLED = features.vendorMode;
export const VENDOR_LIVE_DATA = features.vendorLiveData;
