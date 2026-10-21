import { fireEvent, render, screen } from '@testing-library/react-native';

import { RoomTypeCard } from '@/features/customer/ui/RoomTypeCard';

jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]) => {
      mockPush(...a);
    },
  },
}));
const mockSwitches = { stays: false, payments: true };
jest.mock('@/shared/config/features', () => ({
  get CHECKOUT_STAYS_ENABLED() {
    return mockSwitches.stays;
  },
  get CHECKOUT_PAYMENTS_ENABLED() {
    return mockSwitches.payments;
  },
}));
const mockPush = jest.fn();

const ROOM = { id: 'rt1', name: 'Deluxe king', facts: null, from: 55000 };

beforeEach(() => {
  jest.clearAllMocks();
});

it('is display only while the stays switch is off', async () => {
  Object.assign(mockSwitches, { stays: false, payments: true });
  await render(<RoomTypeCard room={ROOM} hotelId="h1" />);
  expect(screen.getByText('Deluxe king')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Select Deluxe king' })).toBeNull();
});

it('is display only while payments are off', async () => {
  Object.assign(mockSwitches, { stays: true, payments: false });
  await render(<RoomTypeCard room={ROOM} hotelId="h1" />);
  expect(screen.queryByRole('button', { name: 'Select Deluxe king' })).toBeNull();
});

it('with stays on, Select opens checkout for that room type', async () => {
  Object.assign(mockSwitches, { stays: true, payments: true });
  await render(<RoomTypeCard room={ROOM} hotelId="h1" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Select Deluxe king' }));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/checkout/[kind]/[listingId]',
    params: { kind: 'hotel', listingId: 'h1', roomType: 'rt1' },
  });
});
