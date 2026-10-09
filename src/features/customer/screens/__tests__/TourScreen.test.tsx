import { fireEvent, render, screen } from '@testing-library/react-native';

import { TourScreen } from '@/features/customer/screens/TourScreen';

it('walks three pages to Get started', async () => {
  const onDone = jest.fn();
  await render(<TourScreen onDone={onDone} />);
  expect(screen.getByText('Find your place')).toBeTruthy();
  expect(screen.getByLabelText('Page 1 of 3')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByLabelText('Page 2 of 3')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByLabelText('Page 3 of 3')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('back returns to the previous page', async () => {
  await render(<TourScreen onDone={jest.fn()} />);
  expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Page 1 of 3')).toBeTruthy();
});

it('swiping sets the page from the scroll offset', async () => {
  await render(<TourScreen onDone={jest.fn()} />);
  const list = screen.getByTestId('tour-pager');
  await fireEvent(list, 'layout', { nativeEvent: { layout: { width: 300, height: 400 } } });
  await fireEvent(list, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 600 } } });
  expect(screen.getByLabelText('Page 3 of 3')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Get started' })).toBeTruthy();
});

it('skip ends the tour', async () => {
  const onDone = jest.fn();
  await render(<TourScreen onDone={onDone} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  expect(onDone).toHaveBeenCalled();
});

it('shows the three scenes with serif headlines', async () => {
  await render(<TourScreen onDone={jest.fn()} />);
  for (const name of ['find', 'pay', 'showUp'])
    expect(
      screen.getByTestId(`illustration-${name}`, { includeHiddenElements: true }),
    ).toBeTruthy();
  for (const h of ['Find your place', 'Pay in naira', 'Show up'])
    expect(screen.getByRole('header', { name: h })).toBeTruthy();
});
