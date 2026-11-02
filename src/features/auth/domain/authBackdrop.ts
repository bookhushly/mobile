export const PHOTO_COUNT = 3;
// A slow slideshow, not a loop animation: the photo crossfades once per interval.
export const CYCLE_MS = 6000;

export function nextPhotoIndex(i: number): number {
  return (i + 1) % PHOTO_COUNT;
}
