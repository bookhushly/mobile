export const iconSize = { xs: 16, sm: 20, md: 24, lg: 32, xl: 96, xxl: 128 } as const;
export type IconSizeKey = keyof typeof iconSize;
/** The outline icon set's stroke (DESIGN_SYSTEM: 1.5–2 px on a 24 grid). */
export const iconStroke = 1.75;

export const borderWidth = { hairline: 1, thick: 2 } as const;

export const layout = {
  phoneGutter: 16,
  // Onboarding (Welcome and the form sheets): roomier margins, nearer Nike's ~36 than Booking's 12.
  formGutter: 24,
  tabletGutter: 24,
  tabletBreakpoint: 768,
  // The desk's left tab rail on tablets (react-navigation's sidebar default, pinned so screens can
  // size grids from the window without measuring).
  tabletRailWidth: 360,
  formMaxWidth: 640,
  // Tablet two-pane screens (DESIGN_SYSTEM §2: ≈960 for tablet panels).
  panelMaxWidth: 960,
  // Ticket and check-in QR codes: as wide as the screen allows, capped on tablets.
  qrMax: 360,
} as const;

/** Listing cards (customer Discover): a rail card's width (its 4:3 image follows) and a row's
 * square thumbnail. */
export const cardSize = { railWidth: 240, rowImage: 96, avatarLg: 96 } as const;

/** Skeleton bars standing in for a line of text: a title line and a caption line. */
export const skeletonLine = { title: 16, caption: 12 } as const;

/** Vendor Today (design v13): photo-card sizes, the route's marks, the month chart. */
export const vendorSize = {
  jobPhoto: 128,
  requestCard: 220,
  requestPhoto: 104,
  /** A request row's square photo, and a request's own photo at the top. */
  rowPhoto: 64,
  heroPhoto: 220,
  routeMark: 12,
  routeLine: 2,
  chartHeight: 88,
  chartPad: 6,
  chartLine: 2,
  chartLineStrong: 2.5,
  chartDot: 3.5,
  chartDotStrong: 4.5,
  /** Requests shown on Today; the rest are a tap away in "See all". */
  todayRequests: 5,
} as const;

/** A pressed row or card that has no fill of its own to darken. */
export const pressedOpacity = 0.6;

/** At this Dynamic Type scale, side-by-side figures stack so nothing clips. */
export const largeTextScale = 1.3;
