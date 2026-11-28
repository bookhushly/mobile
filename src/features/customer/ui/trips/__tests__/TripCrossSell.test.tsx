import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Trip } from '@/features/customer/domain/trips/trips';
import { TripCrossSell } from '@/features/customer/ui/trips/TripCrossSell';
import { ok } from '@/shared/lib/result';

const mockList = jest.fn<Promise<unknown>, [string]>();
jest.mock('@/features/customer/api/tripsDb', () => ({
  tripsDb: { list: (userId: string) => mockList(userId) },
}));

const planning: Trip = {
  id: 't1',
  name: 'Lagos trip, December',
  destination: 'Lagos',
  startDate: null,
  endDate: null,
  status: 'planning',
  notes: null,
  createdAt: '',
  services: [{ id: 's1', type: 'car_rental', status: 'planned' }],
};

async function show(onBook = jest.fn(), onTrip = jest.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={qc}>
      <TripCrossSell userId="u1" justBooked="hotel" onBook={onBook} onTrip={onTrip} />
    </QueryClientProvider>,
  );
  return { onBook, onTrip };
}

it('after a hotel, suggests a car and events, and the trip still being planned', async () => {
  mockList.mockResolvedValue(ok([planning]));
  const { onBook, onTrip } = await show();
  await fireEvent.press(screen.getByTestId('cross-sell-car_rental'));
  expect(onBook).toHaveBeenCalledWith({ type: 'car_rental', label: 'Rent a car' });
  await fireEvent.press(await screen.findByText('Add to “Lagos trip, December”'));
  expect(onTrip).toHaveBeenCalledWith('t1');
});

it('with no trip being planned, offers to plan one; and it can be hidden', async () => {
  mockList.mockResolvedValue(ok([]));
  const { onTrip } = await show();
  await fireEvent.press(screen.getByText('Plan a full trip'));
  expect(onTrip).toHaveBeenCalledWith(null);
  await fireEvent.press(screen.getByRole('button', { name: 'Hide suggestions' }));
  expect(screen.queryByTestId('trip-cross-sell')).toBeNull();
});
