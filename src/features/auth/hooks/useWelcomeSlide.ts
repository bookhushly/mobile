import { create } from 'zustand';

import { nextSlide } from '@/features/auth/domain/welcomeSlides';

type Store = {
  index: number;
  /** The person chose a slide, so the slideshow stops for good. */
  chosen: boolean;
  /** From the slideshow timer; ignored once the person has chosen. */
  advance: () => void;
  /** From a swipe or a screen reader. */
  show: (index: number) => void;
};

// Shared by Welcome (words, pager) and AuthBackdrop (photo), so both always show the same slide,
// and the form screens keep the photo the person last saw.
export const useWelcomeSlide = create<Store>((set) => ({
  index: 0,
  chosen: false,
  advance: () => {
    set((s) => (s.chosen ? s : { index: nextSlide(s.index) }));
  },
  show: (index) => {
    set({ index, chosen: true });
  },
}));
