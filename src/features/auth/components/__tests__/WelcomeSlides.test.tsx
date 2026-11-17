import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { WelcomeSlides } from '@/features/auth/components/WelcomeSlides';
import { WELCOME_SLIDES } from '@/features/auth/domain/welcomeSlides';
import { useWelcomeSlide } from '@/features/auth/hooks/useWelcomeSlide';

beforeEach(() => {
  useWelcomeSlide.setState({ index: 0, chosen: false });
});

async function layOut(width: number) {
  await fireEvent(
    screen.getByTestId('welcome-pager').parent ?? screen.getByTestId('welcome-pager'),
    'layout',
    {
      nativeEvent: { layout: { width, height: 300, x: 0, y: 0 } },
    },
  );
}

it('reads out only the slide on screen, as the header', async () => {
  await render(<WelcomeSlides />);
  expect(screen.getByRole('header', { name: WELCOME_SLIDES[0]?.title })).toBeTruthy();
  expect(screen.queryByText(WELCOME_SLIDES[1]?.title ?? '')).toBeNull();
  await act(() => {
    useWelcomeSlide.getState().advance();
  });
  expect(screen.getByRole('header', { name: WELCOME_SLIDES[1]?.title })).toBeTruthy();
});

it('lets a screen reader step through the slides, and that stops the slideshow', async () => {
  await render(<WelcomeSlides />);
  const dots = screen.getByRole('adjustable', { name: 'Slides' });
  expect(dots.props.accessibilityValue).toEqual({ text: '1 of 3' });
  await fireEvent(dots, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  expect(useWelcomeSlide.getState()).toMatchObject({ index: 1, chosen: true });
  await fireEvent(dots, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  await fireEvent(dots, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  expect(useWelcomeSlide.getState().index).toBe(0);
});

it('a swipe picks the slide it lands on', async () => {
  await render(<WelcomeSlides />);
  await layOut(400);
  const pager = screen.getByTestId('welcome-pager');
  await fireEvent(pager, 'scrollBeginDrag');
  expect(useWelcomeSlide.getState().chosen).toBe(true);
  await fireEvent(pager, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 800, y: 0 } } });
  expect(useWelcomeSlide.getState().index).toBe(2);
});
