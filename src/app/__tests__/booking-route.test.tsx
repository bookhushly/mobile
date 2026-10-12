import { render } from '@testing-library/react-native';

import BookingRoute from '@/app/(receptionist)/booking/[id]';

const mockParams: { id?: string } = {};
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
// The screen is stubbed: this test is about the id the route hands it.
const mockScreen = { id: undefined as string | null | undefined };
jest.mock('@/features/receptionist/screens/BookingScreen', () => ({
  BookingScreen: ({ id }: { id: string | null }) => {
    mockScreen.id = id;
    return null;
  },
}));
jest.mock('@/features/receptionist/ui/ChooseRoomSheet', () => ({ ChooseRoomSheet: () => null }));
jest.mock('@/features/receptionist/ui/CheckOutSheet', () => ({ CheckOutSheet: () => null }));

beforeEach(() => {
  mockScreen.id = undefined;
});

it('passes a booking UUID through', async () => {
  mockParams.id = '0b6f1f4e-2c1a-4f6e-9a39-6f0e7d2b9c11';
  await render(<BookingRoute />);
  expect(mockScreen.id).toBe('0b6f1f4e-2c1a-4f6e-9a39-6f0e7d2b9c11');
});

it.each(['', 'b1', 'not-a-uuid', "1' or '1'='1", undefined])(
  'treats %p as no booking (null: "isn\'t at this hotel", no query)',
  async (id) => {
    mockParams.id = id;
    await render(<BookingRoute />);
    expect(mockScreen.id).toBeNull();
  },
);
