export const iconSize = { xs: 16, sm: 20, md: 24, lg: 32, xl: 96, xxl: 128 } as const;
export type IconSizeKey = keyof typeof iconSize;

export const borderWidth = { hairline: 1, thick: 2 } as const;

export const layout = {
  phoneGutter: 16,
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
