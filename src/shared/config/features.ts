// Build-time switches. Flip here, never at runtime. Read through a typed object so the exported
// value is `boolean` (not the literal) and the branches behind a switch stay reachable to the
// type checker and lint while it is off.
type Features = { customerTour: boolean };

const features: Features = {
  // Find · Pay · Show up intro tour (spec 2026-10-08 UI-B §2 decision 2): built now, switched on
  // in Phase 4 once there is something to browse. A test pins it off so a merge never ships it on.
  customerTour: false,
};

export const CUSTOMER_TOUR_ENABLED = features.customerTour;
