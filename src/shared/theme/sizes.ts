export const iconSize = { xs: 16, sm: 20, md: 24, lg: 32, xl: 96, xxl: 128 } as const;
export type IconSizeKey = keyof typeof iconSize;

export const borderWidth = { hairline: 1, thick: 2 } as const;

export const layout = {
  phoneGutter: 16,
  tabletGutter: 24,
  tabletBreakpoint: 768,
  formMaxWidth: 640,
} as const;
