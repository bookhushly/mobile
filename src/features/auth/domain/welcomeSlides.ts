export type WelcomePhoto = 'hotel' | 'event' | 'apartment';

export type WelcomeSlide = { photo: WelcomePhoto; title: string; body: string };

// Welcome's onboarding: the overview first, then what each category gives you.
// The overview sits on the hotel photo, so every category has its picture.
export const WELCOME_SLIDES: readonly WelcomeSlide[] = [
  {
    photo: 'hotel',
    title: 'Events, stays and hotels across Nigeria.',
    body: 'Find it, book it, pay in naira.',
  },
  {
    photo: 'event',
    title: 'Your tickets, in your pocket.',
    body: 'Buy in a few taps and show your code at the door.',
  },
  {
    photo: 'apartment',
    title: 'Stay longer in a serviced apartment.',
    body: 'Book by the night, with photos and prices before you pay.',
  },
];

// A slow slideshow: one slide per interval, a single pass that rests on the last slide, and it
// stops for good once the person swipes. No loop, so nothing moves forever (WCAG 2.2.2).
export const SLIDE_MS = 6000;

export function nextSlide(i: number): number {
  return Math.min(i + 1, WELCOME_SLIDES.length - 1);
}

/** The page a horizontal pager rests on. Before layout (width 0) it is the first. */
export function slideFromOffset(x: number, width: number): number {
  if (width <= 0) return 0;
  const page = Math.round(x / width);
  return Math.min(Math.max(page, 0), WELCOME_SLIDES.length - 1);
}
