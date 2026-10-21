import { fireEvent, render, screen } from '@testing-library/react-native';

import { DatesSheet } from '@/shared/ui/DatesSheet';

const TODAY = '2026-10-21';
const none = { checkIn: null, checkOut: null };

function setup(over: { minNights?: number; onDone?: jest.Mock } = {}) {
  const onDone = over.onDone ?? jest.fn();
  return render(
    <DatesSheet
      visible
      today={TODAY}
      minNights={over.minNights ?? 1}
      initial={none}
      onDone={onDone}
      onClose={jest.fn()}
    />,
  );
}

const day = (d: string) => screen.getByTestId(`day-${d}`);

it('today then +3 days enables "Choose · 3 nights" and reports the range', async () => {
  const onDone = jest.fn();
  await setup({ onDone });
  await fireEvent.press(day('2026-10-21'));
  await fireEvent.press(day('2026-10-24'));
  const choose = screen.getByRole('button', { name: 'Choose · 3 nights' });
  await fireEvent.press(choose);
  expect(onDone).toHaveBeenCalledWith({ checkIn: '2026-10-21', checkOut: '2026-10-24' });
  expect(screen.getByTestId('dates-header')).toHaveTextContent('Wed 21 Oct → Sat 24 Oct');
});

it('says "1 night" for a single night', async () => {
  await setup();
  await fireEvent.press(day('2026-10-21'));
  await fireEvent.press(day('2026-10-22'));
  expect(screen.getByRole('button', { name: 'Choose · 1 night' })).toBeTruthy();
});

it('past days are disabled and ignore taps', async () => {
  await setup();
  expect(day('2026-10-20').props.accessibilityState).toMatchObject({ disabled: true });
  await fireEvent.press(day('2026-10-20'));
  expect(screen.getByTestId('dates-header')).toHaveTextContent('Check-in → Check-out');
});

it('a tap on or before check-in restarts the range', async () => {
  await setup();
  await fireEvent.press(day('2026-10-25'));
  await fireEvent.press(day('2026-10-23'));
  expect(screen.getByTestId('dates-header')).toHaveTextContent('Fri 23 Oct → Check-out');
  expect(screen.getByLabelText('Friday 23 October, check-in')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Choose' }).props.accessibilityState).toMatchObject({
    disabled: true,
  });
});

it('minNights 2 keeps Choose disabled for one night and shows the hint', async () => {
  await setup({ minNights: 2 });
  expect(screen.getByText('At least 2 nights')).toBeTruthy();
  await fireEvent.press(day('2026-10-21'));
  await fireEvent.press(day('2026-10-22'));
  expect(screen.getByRole('button', { name: 'Choose' }).props.accessibilityState).toMatchObject({
    disabled: true,
  });
  await fireEvent.press(day('2026-10-21')); // a complete range restarts
  await fireEvent.press(day('2026-10-23'));
  expect(screen.getByRole('button', { name: 'Choose · 2 nights' })).toBeTruthy();
});

it('a range can span two months', async () => {
  await setup();
  await fireEvent.press(day('2026-10-30'));
  await fireEvent.press(day('2026-11-02'));
  expect(screen.getByRole('button', { name: 'Choose · 3 nights' })).toBeTruthy();
  expect(screen.getByLabelText('Monday 2 November, check-out')).toBeTruthy();
});
