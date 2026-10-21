import { fireEvent, render, screen } from '@testing-library/react-native';

import { RoomTypeCard } from '@/features/customer/ui/RoomTypeCard';

const ROOM = { id: 'rt1', name: 'Deluxe king', facts: null, from: 55000 };

it('is display only without onSelect (stays checkout off)', async () => {
  await render(<RoomTypeCard room={ROOM} />);
  expect(screen.getByText('Deluxe king')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Select Deluxe king' })).toBeNull();
});

it('Select calls onSelect for that room type', async () => {
  const onSelect = jest.fn();
  await render(<RoomTypeCard room={ROOM} onSelect={onSelect} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Select Deluxe king' }));
  expect(onSelect).toHaveBeenCalledTimes(1);
});
