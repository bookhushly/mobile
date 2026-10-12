import { fireEvent, render, screen } from '@testing-library/react-native';

import { ActivityScreen } from '@/features/receptionist/screens/ActivityScreen';
import { useShiftLog } from '@/features/receptionist/state/shiftLog';

beforeEach(() => {
  useShiftLog.getState().clear();
});

it('lists this shift newest first with Lagos times', async () => {
  const log = useShiftLog.getState();
  log.add({
    at: Date.parse('2026-10-11T08:05:00Z'),
    kind: 'checkIn',
    text: 'Checked in Ada Obi · Room 204',
  });
  log.add({
    at: Date.parse('2026-10-11T09:12:00Z'),
    kind: 'roomStatus',
    text: 'Room 305 marked dirty',
  });
  const onBack = jest.fn();
  await render(<ActivityScreen onBack={onBack} />);
  expect(screen.getByRole('header', { name: 'Shift activity' })).toBeTruthy();
  expect(screen.getByText('This device, since you opened the front desk')).toBeTruthy();
  const rows = screen.getAllByLabelText(/·|marked/);
  expect(rows.map((r) => String(r.props.accessibilityLabel))).toEqual([
    'Room 305 marked dirty, 10:12',
    'Checked in Ada Obi · Room 204, 09:05',
  ]);
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

it('says nothing has happened yet', async () => {
  await render(<ActivityScreen onBack={jest.fn()} />);
  expect(screen.getByText('Nothing yet')).toBeTruthy();
  expect(
    screen.getByText('Check-ins, check-outs and room changes you make here appear in this list.'),
  ).toBeTruthy();
});
