import { nextSlide, slideFromOffset, WELCOME_SLIDES } from '@/features/auth/domain/welcomeSlides';

it('covers all three categories, one photo each', () => {
  expect(WELCOME_SLIDES.map((s) => s.photo).sort()).toEqual(['apartment', 'event', 'hotel']);
});

it('opens on the overview', () => {
  expect(WELCOME_SLIDES[0]?.title).toBe('Events, stays and hotels across Nigeria.');
});

it('steps through the slides once and rests on the last', () => {
  expect(nextSlide(0)).toBe(1);
  expect(nextSlide(WELCOME_SLIDES.length - 1)).toBe(WELCOME_SLIDES.length - 1);
});

describe('slideFromOffset', () => {
  it('rounds a swipe to the nearest page', () => {
    expect(slideFromOffset(0, 400)).toBe(0);
    expect(slideFromOffset(390, 400)).toBe(1);
    expect(slideFromOffset(610, 400)).toBe(2);
  });
  it('stays in range on overscroll and before layout', () => {
    expect(slideFromOffset(-50, 400)).toBe(0);
    expect(slideFromOffset(5000, 400)).toBe(WELCOME_SLIDES.length - 1);
    expect(slideFromOffset(300, 0)).toBe(0);
  });
});
