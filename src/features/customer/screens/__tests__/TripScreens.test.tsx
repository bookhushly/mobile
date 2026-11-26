import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Trip } from '@/features/customer/domain/trips/trips';
import { useCreateTrip } from '@/features/customer/hooks/useTrips';
import { useTripDraft } from '@/features/customer/hooks/useTripDraft';
import { bookingFor } from '@/features/customer/hooks/useTripScreen';
import { TripFlowScreen } from '@/features/customer/screens/TripFlowScreen';
import { TripScreen } from '@/features/customer/screens/TripScreen';

jest.mock('@/features/customer/hooks/useTrips', () => ({
  ...jest.requireActual<object>('@/features/customer/hooks/useTrips'),
  useCreateTrip: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'trip-uuid' }));
jest.mock('@/shared/api/instance', () => ({
  api: {},
  clock: { serverNow: () => Date.parse('2026-11-26T10:00:00Z') },
}));

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't1',
  name: 'Lagos trip, December',
  destination: 'FCT Abuja',
  startDate: '2026-12-18',
  endDate: '2026-12-22',
  status: 'planning',
  notes: 'Flying in Friday',
  createdAt: '',
  services: [
    { id: 's1', type: 'hotel', status: 'booked' },
    { id: 's2', type: 'car_rental', status: 'planned' },
  ],
  ...over,
});

describe('TripFlowScreen', () => {
  const mutate = jest.fn();
  beforeEach(() => {
    useTripDraft.getState().start();
    mutate.mockReset();
    jest.mocked(useCreateTrip).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useCreateTrip>);
  });

  it('where and when can be skipped, a service is needed, and the name is suggested', async () => {
    const onCreated = jest.fn();
    await render(<TripFlowScreen userId="u1" onClose={jest.fn()} onCreated={onCreated} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Lagos' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await fireEvent.press(screen.getByTestId('day-2026-12-18'));
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await fireEvent.press(screen.getByTestId('trip-service-hotel'));
    await fireEvent.press(screen.getByTestId('trip-service-car_rental'));
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('trip-name').props.value).toBe('Lagos trip, December');
    await fireEvent.press(screen.getByRole('button', { name: 'Create trip' }));
    expect(mutate).toHaveBeenCalledWith(
      {
        tripId: 'trip-uuid',
        draft: expect.objectContaining({
          destination: 'Lagos',
          startDate: '2026-12-18',
          services: ['hotel', 'car_rental'],
          name: 'Lagos trip, December',
        }) as object,
      },
      expect.anything(),
    );
  });

  it('says Skip while an optional step has no answer', async () => {
    await render(<TripFlowScreen userId="u1" onClose={jest.fn()} onCreated={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Skip' })).toBeEnabled();
  });
});

describe('TripScreen', () => {
  const base = {
    busy: false,
    problem: null,
    onBack: jest.fn(),
    onAdd: jest.fn(() => Promise.resolve(true)),
    onComplete: jest.fn(),
    onArchive: jest.fn(() => Promise.resolve(true)),
  };

  it('shows what’s booked and offers to book the rest', async () => {
    const onBook = jest.fn();
    await render(
      <TripScreen
        {...base}
        onBook={onBook}
        state={{ status: 'ready', trip: trip(), refreshing: false, refresh: jest.fn() }}
      />,
    );
    expect(screen.getByText('FCT Abuja · 18–22 Dec')).toBeTruthy();
    expect(screen.getByTestId('trip-progress')).toHaveTextContent('1 of 2 booked');
    expect(screen.getByLabelText('Hotel, booked')).toBeTruthy();
    expect(screen.queryByTestId('trip-book-hotel')).toBeNull();
    await fireEvent.press(screen.getByTestId('trip-book-car_rental'));
    expect(onBook).toHaveBeenCalledWith(expect.objectContaining({ id: 's2' }));
    expect(screen.queryByTestId('trip-complete')).toBeNull();
  });

  it('can be marked complete once everything is booked', async () => {
    await render(
      <TripScreen
        {...base}
        onBook={jest.fn()}
        state={{
          status: 'ready',
          trip: trip({ services: [{ id: 's1', type: 'hotel', status: 'booked' }] }),
          refreshing: false,
          refresh: jest.fn(),
        }}
      />,
    );
    await fireEvent.press(screen.getByTestId('trip-complete'));
    expect(base.onComplete).toHaveBeenCalled();
  });

  it('adds a missing service from the sheet', async () => {
    await render(
      <TripScreen
        {...base}
        onBook={jest.fn()}
        state={{ status: 'ready', trip: trip(), refreshing: false, refresh: jest.fn() }}
      />,
    );
    await fireEvent.press(screen.getByTestId('trip-add'));
    await fireEvent.press(screen.getByTestId('trip-add-security'));
    expect(base.onAdd).toHaveBeenCalledWith('security');
  });
});

describe('bookingFor', () => {
  it('opens listings in the trip’s state, and the request flows for quotes', () => {
    const t = trip();
    expect(bookingFor(t, { id: 's1', type: 'hotel', status: 'planned' })).toEqual({
      to: 'results',
      category: 'hotels',
      region: 'FCT',
    });
    expect(bookingFor(t, { id: 's2', type: 'car_rental', status: 'planned' })).toEqual({
      to: 'car-rental',
    });
  });
});
