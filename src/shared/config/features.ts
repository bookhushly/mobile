// Build-time switches. Flip here, never at runtime. Read through a typed object so the exported
// value is `boolean` (not the literal) and the branches behind a switch stay reachable to the
// type checker and lint while it is off.
type Features = {
  customerTour: boolean;
  checkoutStays: boolean;
  checkoutEvents: boolean;
  checkoutPayments: boolean;
};

const features: Features = {
  // Find · Pay · Show up intro tour (spec 2026-10-08 UI-B §2 decision 2), switched on in Phase 4b
  // (spec D15) now that there is something to browse. A test pins it on.
  customerTour: true,
  // Phase 4c kill switches (spec P2). Stays checkout stays off until web #221 is deployed.
  checkoutStays: false,
  // Phase 4c kill switch (spec P2): in-app event booking.
  checkoutEvents: true,
  // Phase 4c kill switch (spec P2): in-app payment (Paystack initialise/verify).
  checkoutPayments: true,
};

export const CUSTOMER_TOUR_ENABLED = features.customerTour;
export const CHECKOUT_STAYS_ENABLED = features.checkoutStays;
export const CHECKOUT_EVENTS_ENABLED = features.checkoutEvents;
export const CHECKOUT_PAYMENTS_ENABLED = features.checkoutPayments;
