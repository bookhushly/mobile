export const PHOTO_COUNT = 3;
// A slow slideshow, not a loop animation: the photo crossfades once per interval.
export const CYCLE_MS = 6000;

export function nextPhotoIndex(i: number): number {
  return (i + 1) % PHOTO_COUNT;
}

export type SheetBand = 'short' | 'medium' | 'tall';

// Visible photo below the safe area. Longer forms get the shorter band.
export const BAND_PT: Record<SheetBand, number> = { short: 72, medium: 120, tall: 160 };

/** How far down the sheet sits. With the keyboard open the photo gives way to the fields. */
export function sheetOffset(band: SheetBand, topInset: number, keyboardOpen: boolean): number {
  return keyboardOpen ? topInset : topInset + BAND_PT[band];
}
