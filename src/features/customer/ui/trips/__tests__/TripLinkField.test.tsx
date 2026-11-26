import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Trip } from '@/features/customer/domain/trips/trips';
import { useTripLink } from '@/features/customer/hooks/useTrips';
import { TripLinkField } from '@/features/customer/ui/trips/TripLinkField';
import { ok } from '@/shared/lib/result';

const mockList = jest.fn<Promise<unknown>, [string]>();
jest.mock('@/features/customer/api/tripsDb', () => ({
  tripsDb: { list: (userId: string) => mockList(userId) },
}));

const trip: Trip = {
  id: 't1',
  name: 'Lagos trip, December',
  destination: 'Lagos',
  startDate: null,
  endDate: null,
  status: 'planning',
  notes: null,
  createdAt: '',
  services: [{ id: 'ts-hotel', type: 'hotel', status: 'planned' }],
};

async function show(type: 'hotel' | 'event') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={qc}>
      <TripLinkField userId="u1" type={type} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useTripLink.setState({ chosen: {} });
  mockList.mockResolvedValue(ok([trip]));
});

it('offers an open trip that plans this kind of booking, and remembers the choice', async () => {
  await show('hotel');
  expect(await screen.findByText('Part of a trip?')).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Not part of a trip', checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'Lagos trip, December · Lagos' }));
  expect(useTripLink.getState().chosen.hotel).toBe('ts-hotel');
  await fireEvent.press(screen.getByRole('radio', { name: 'Not part of a trip' }));
  expect(useTripLink.getState().chosen.hotel).toBeNull();
});

it('shows nothing when no trip plans this kind', async () => {
  await show('event');
  await screen.findByTestId('nothing', {}, { timeout: 50 }).catch(() => undefined);
  expect(screen.queryByText('Part of a trip?')).toBeNull();
});

it('comes in already chosen when the customer started from the trip', async () => {
  useTripLink.getState().choose('hotel', 'ts-hotel');
  await show('hotel');
  expect(
    await screen.findByRole('radio', { name: 'Lagos trip, December · Lagos', checked: true }),
  ).toBeTruthy();
});
