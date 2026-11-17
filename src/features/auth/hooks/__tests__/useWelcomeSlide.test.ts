import { useWelcomeSlide } from '@/features/auth/hooks/useWelcomeSlide';

beforeEach(() => {
  useWelcomeSlide.setState({ index: 0, chosen: false });
});

it('advances once through and rests on the last slide', () => {
  const { advance } = useWelcomeSlide.getState();
  advance();
  expect(useWelcomeSlide.getState().index).toBe(1);
  advance();
  advance();
  expect(useWelcomeSlide.getState().index).toBe(2);
});

it('stops advancing once the person picks a slide', () => {
  useWelcomeSlide.getState().show(2);
  useWelcomeSlide.getState().advance();
  expect(useWelcomeSlide.getState()).toMatchObject({ index: 2, chosen: true });
});
