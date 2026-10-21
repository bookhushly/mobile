import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { roomAvailability, validatePromo } from '@/features/customer/api/checkoutApi';
import { checkoutDb } from '@/features/customer/api/checkoutDb';
import type { ApartmentListing, HotelListing } from '@/features/customer/api/listingDetailDb';
import { useCreateBooking, type CreateState } from '@/features/customer/hooks/useCreateBooking';
import { useListing } from '@/features/customer/hooks/useListing';
import { useProfile } from '@/features/customer/hooks/useProfile';
import {
  apartmentDetail,
  eventDetail,
  hotelDetail,
  roomRate,
  roomType,
  type EventDetail,
} from '@/features/customer/schemas/listings';
import type { CustomQuestion } from '@/features/customer/schemas/checkout';
import { SelectScreen } from '@/features/customer/screens/SelectScreen';

// Factories, not automocks: an automock loads the real module (supabase → native storage).
jest.mock('@/features/customer/hooks/useListing', () => ({ useListing: jest.fn() }));
jest.mock('@/features/customer/hooks/useProfile', () => ({ useProfile: jest.fn() }));
jest.mock('@/features/customer/hooks/useCreateBooking', () => ({ useCreateBooking: jest.fn() }));
jest.mock('@/features/customer/api/checkoutDb', () => ({
  checkoutDb: {
    eventQuestions: jest.fn(),
    hotelExtras: jest.fn(),
    apartmentExtras: jest.fn(),
    findRecentEventBooking: jest.fn(),
  },
}));
jest.mock('@/features/customer/api/checkoutApi', () => ({
  roomAvailability: jest.fn(() =>
    Promise.resolve({
      ok: true,
      value: { totalRooms: 5, bookedCount: 0, freeRooms: 5, available: true },
    }),
  ),
  serviceCharge: jest.fn(),
  validatePromo: jest.fn(),
}));
jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => mockNow } }));
// Controller ruling: switches are forced per test through this module.
jest.mock('@/shared/config/features', () => ({
  get CHECKOUT_STAYS_ENABLED() {
    return mockFlags.stays;
  },
  get CHECKOUT_EVENTS_ENABLED() {
    return mockFlags.events;
  },
  CHECKOUT_PAYMENTS_ENABLED: true,
  CUSTOMER_TOUR_ENABLED: true,
}));

const mockNow = Date.parse('2026-10-21T09:00:00Z'); // Wed 21 Oct, 10:00 Lagos
const mockFlags = { stays: true, events: true };

const mockListing = jest.mocked(useListing);
const mockProfile = jest.mocked(useProfile);
const mockCreate = jest.mocked(useCreateBooking);
const mockDb = jest.mocked(checkoutDb);

const ID = '0b6f1f4e-2c1a-4f6e-9a39-6f0e7d2b9c11';
const ROOM = '7d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

const HOTEL: HotelListing = {
  hotel: hotelDetail.parse({ id: ID, name: 'Harbour Suites' }),
  roomTypes: [
    roomType.parse({
      id: ROOM,
      hotel_id: ID,
      name: 'Deluxe king',
      max_occupancy: 2,
      base_price: 60000,
    }),
  ],
  rates: [
    roomRate.parse({
      id: 'r1',
      room_type_id: ROOM,
      beds: { king: 1 },
      price_per_night: 60000,
      is_default: true,
    }),
  ],
};
const APARTMENT: ApartmentListing = {
  apartment: apartmentDetail.parse({
    id: ID,
    name: 'Lekki loft',
    max_guests: 4,
    price_per_night: 50000,
    minimum_stay: 3,
  }),
  rules: [],
};
function event(packages: unknown[]): EventDetail {
  return eventDetail.parse({
    id: ID,
    title: 'Afrobeats night',
    active: true,
    availability: 'available',
    event_date: '2026-11-07T00:00:00',
    event_time: '2026-11-07T18:00:00+00:00',
    price: 0,
    ticket_packages: packages,
  });
}
const PAID = event([
  { name: 'Regular', price: 5000, remaining: 100, total: 100 },
  { name: 'VIP', price: 25000, remaining: 100, total: 100 },
]);
const FREE = event([{ name: 'Entry', price: 0, remaining: 100, total: 100 }]);

const PROFILE = {
  id: 'u1',
  email: 'ada@example.com',
  name: 'Ada Obi',
  phone: '+2348031234567',
  state: null,
  address: null,
};

const submit = jest.fn((..._args: unknown[]) => Promise.resolve());
const checkAgain = jest.fn(() => Promise.resolve());
function createState(state: CreateState, created: { bookingId: string } | null = null) {
  mockCreate.mockReturnValue({ submit, checkAgain, state, created });
}

const refetchListing = jest.fn(() => Promise.resolve());
function given(data: HotelListing | ApartmentListing | EventDetail, name = PROFILE.name) {
  mockListing.mockReturnValue({ data, error: false, apiError: null, refetch: refetchListing });
  mockProfile.mockReturnValue({
    profile: { ...PROFILE, name },
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
  });
}

const onCreated = jest.fn();
async function open(kind: 'hotel' | 'apartment' | 'event', roomTypeId: string | null = null) {
  // gcTime Infinity: no 5-minute GC timer after unmount to keep the Jest worker alive.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await render(
    <QueryClientProvider client={client}>
      <SelectScreen
        kind={kind}
        listingId={ID}
        roomTypeId={roomTypeId}
        rateId={null}
        userId="u1"
        email="ada@example.com"
        onBack={jest.fn()}
        onCreated={onCreated}
      />
    </QueryClientProvider>,
  );
}

const continueButton = () => screen.getByRole('button', { name: 'Continue' });
const press = async (label: string, times = 1) => {
  for (let i = 0; i < times; i += 1) await fireEvent.press(screen.getByLabelText(label));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFlags.stays = true;
  mockFlags.events = true;
  createState({ phase: 'idle' });
  mockDb.hotelExtras.mockResolvedValue({
    breakfastOffered: 'included',
    breakfast: [],
    airportEnabled: false,
    airportPrices: {},
    airportFee: null,
  });
  mockDb.apartmentExtras.mockResolvedValue({
    airportEnabled: false,
    airportPrices: {},
    minimumStay: 3,
  });
  mockDb.eventQuestions.mockResolvedValue([]);
});

describe('stays', () => {
  it('continue disabled until dates chosen', async () => {
    given(HOTEL);
    await open('hotel', ROOM);
    expect(await screen.findByTestId('room-summary')).toHaveTextContent(/Deluxe king/);
    expect(continueButton()).toBeDisabled();
    expect(screen.getByTestId('select-estimate')).toHaveTextContent('Add your dates');

    await fireEvent.press(screen.getByTestId('dates-row'));
    await fireEvent.press(screen.getByTestId('day-2026-10-23'));
    await fireEvent.press(screen.getByTestId('day-2026-10-25'));
    await fireEvent.press(screen.getByRole('button', { name: 'Choose · 2 nights' }));

    expect(screen.getByTestId('select-estimate')).toHaveTextContent('2 nights · ₦120,000');
    expect(continueButton()).toBeEnabled();
    await fireEvent.press(continueButton());
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0]).toMatchObject({
      checkIn: '2026-10-23',
      checkOut: '2026-10-25',
      adults: 1,
      rateId: 'r1',
      guest: { name: 'Ada Obi', email: 'ada@example.com', phone: '0803 123 4567' },
    });
    expect(submit.mock.calls[0]?.[1]).toEqual({ title: 'Harbour Suites', roomTypeId: ROOM });
  });

  it('no rooms for the dates turns Continue off', async () => {
    jest.mocked(roomAvailability).mockResolvedValueOnce({
      ok: true,
      value: { totalRooms: 5, bookedCount: 5, freeRooms: 0, available: false },
    });
    given(HOTEL);
    await open('hotel', ROOM);
    await fireEvent.press(await screen.findByTestId('dates-row'));
    await fireEvent.press(screen.getByTestId('day-2026-10-23'));
    await fireEvent.press(screen.getByTestId('day-2026-10-24'));
    await fireEvent.press(screen.getByRole('button', { name: 'Choose · 1 night' }));
    expect(await screen.findByText('No rooms left for these dates')).toBeTruthy();
    expect(continueButton()).toBeDisabled();
  });

  it('min nights line shows for apartments', async () => {
    given(APARTMENT);
    await open('apartment');
    expect(await screen.findByTestId('min-nights')).toHaveTextContent('At least 3 nights');
    expect(screen.queryByTestId('promo-open')).toBeNull();
  });

  it('refused dates_invalid shows the words', async () => {
    given(HOTEL);
    createState({
      phase: 'refused',
      words: 'Choose check-out after check-in, from today',
      field: 'dates',
    });
    await open('hotel', ROOM);
    expect(await screen.findByTestId('dates-error')).toHaveTextContent(
      'Choose check-out after check-in, from today',
    );
    expect(screen.queryByTestId('create-refused')).toBeNull();
  });

  it('unsure shows Check again', async () => {
    given(HOTEL);
    createState({ phase: 'unsure' });
    await open('hotel', ROOM);
    expect(await screen.findByText('Couldn’t confirm your booking')).toBeTruthy();
    expect(continueButton()).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
    expect(checkAgain).toHaveBeenCalledTimes(1);
  });

  it('stays switch off renders not found', async () => {
    mockFlags.stays = false;
    given(HOTEL);
    await open('hotel', ROOM);
    expect(screen.getByTestId('listing-not-found')).toBeTruthy();
    expect(mockListing).not.toHaveBeenCalled();
  });

  it('a room type that is not this hotel’s is not found', async () => {
    given(HOTEL);
    await open('hotel', null);
    expect(screen.getByTestId('listing-not-found')).toBeTruthy();
  });

  it('created hands over the booking', async () => {
    given(HOTEL);
    createState({ phase: 'idle' }, { bookingId: 'b1' });
    await open('hotel', ROOM);
    await screen.findByTestId('room-summary');
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith('b1', false);
  });
});

describe('events', () => {
  it('event steppers cap at 20 total and show Up to 20 tickets per booking', async () => {
    given(PAID);
    await open('event');
    expect(await screen.findByTestId('max-tickets')).toHaveTextContent(
      'Up to 20 tickets per booking',
    );
    await press('Increase Regular', 15);
    await press('Increase VIP', 5);
    expect(screen.getByLabelText('Increase VIP')).toBeDisabled();
    expect(screen.getByLabelText('Increase Regular')).toBeDisabled();
    expect(screen.getByTestId('select-estimate')).toHaveTextContent('20 tickets · ₦200,000');
  });

  it('required question blocks continue with its message', async () => {
    const q: CustomQuestion = {
      id: 'q1',
      label: 'T-shirt size',
      type: 'text',
      options: [],
      required: true,
    };
    mockDb.eventQuestions.mockResolvedValue([q]);
    given(PAID);
    await open('event');
    await screen.findByTestId('questions');
    await press('Increase Regular');
    await fireEvent.press(continueButton());
    expect(screen.getByText('Answer this question')).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('question-q1'), 'L');
    await fireEvent.press(continueButton());
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0]).toMatchObject({ qty: { Regular: 1 }, answers: { q1: 'L' } });
  });

  it('free event shows Free and requires a name', async () => {
    given(FREE, '');
    await open('event');
    await screen.findByTestId('tickets');
    expect(screen.queryByTestId('promo-open')).toBeNull();
    await press('Increase Entry', 2);
    expect(screen.getByTestId('select-estimate')).toHaveTextContent('2 tickets · Free');
    await fireEvent.press(continueButton());
    expect(screen.getByText('Enter your name')).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('guest-name'), 'Ada Obi');
    await fireEvent.press(continueButton());
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[1]).toMatchObject({ title: 'Afrobeats night', free: true });
  });

  it('a package-less event with an unreadable price blocks Continue and is never free (A7)', async () => {
    given(
      eventDetail.parse({
        id: ID,
        title: 'Afrobeats night',
        active: true,
        availability: 'available',
        event_date: '2026-11-07T00:00:00',
        event_time: '2026-11-07T18:00:00+00:00',
        price: 'TBA',
        ticket_packages: [],
      }),
    );
    await open('event');
    await screen.findByTestId('tickets');
    expect(screen.getByTestId('select-problem')).toHaveTextContent(
      'This event’s price isn’t available. Try again later or book on bookhushly.com.',
    );
    await fireEvent.press(continueButton());
    expect(submit).not.toHaveBeenCalled();
  });

  it('no tickets reads its words above Continue', async () => {
    given(PAID);
    await open('event');
    await screen.findByTestId('tickets');
    expect(screen.getByTestId('select-estimate')).toHaveTextContent('Choose tickets');
    await fireEvent.press(continueButton());
    expect(screen.getByTestId('select-problem')).toHaveTextContent('Choose at least one ticket');
    expect(submit).not.toHaveBeenCalled();
  });

  it('sold out reads Sold out with no stepper; low stock reads {n} left', async () => {
    given(
      event([
        { name: 'Regular', price: 5000, remaining: 0, total: 100 },
        { name: 'VIP', price: 25000, remaining: 4, total: 50 },
      ]),
    );
    await open('event');
    await screen.findByTestId('tickets');
    expect(screen.getByTestId('ticket-Regular')).toHaveTextContent(/Sold out/);
    expect(screen.queryByLabelText('Increase Regular')).toBeNull();
    expect(screen.getByTestId('ticket-VIP')).toHaveTextContent(/4 left/);
  });

  it('a paid event hands over as paid', async () => {
    given(PAID);
    createState({ phase: 'idle' }, { bookingId: 'e1' });
    await open('event');
    await screen.findByTestId('tickets');
    expect(onCreated).toHaveBeenCalledWith('e1', false);
  });

  it('a paid event asks for no name; a free one does', async () => {
    given(PAID);
    await open('event');
    await screen.findByTestId('tickets');
    await press('Increase Regular');
    expect(screen.queryByTestId('guest-name')).toBeNull();
    expect(screen.getByTestId('guest-email')).toBeTruthy();
  });

  it('a refusal re-reads the listing once for fresh stock (P11)', async () => {
    given(PAID);
    createState({ phase: 'refused', words: 'Not enough tickets left' });
    await open('event');
    await screen.findByTestId('tickets');
    expect(screen.getByTestId('create-refused')).toHaveTextContent('Not enough tickets left');
    expect(refetchListing).toHaveBeenCalledTimes(1);
  });

  it('a promo covering a paid order blocks Continue with its words', async () => {
    jest.mocked(validatePromo).mockResolvedValue({
      ok: true,
      value: {
        valid: true,
        code_id: 'c1',
        code: 'ALLFREE',
        discount_amount: 5000,
        discounted_total: 0,
      },
    });
    given(PAID);
    await open('event');
    await screen.findByTestId('tickets');
    await press('Increase Regular');
    await fireEvent.press(screen.getByTestId('promo-open'));
    await fireEvent.changeText(screen.getByTestId('promo-input'), 'ALLFREE');
    await fireEvent.press(screen.getByTestId('promo-apply'));
    expect(await screen.findByTestId('promo-applied')).toBeTruthy();
    // Still paid: the free route ignores promos (P19 amended).
    expect(screen.getByTestId('select-estimate')).toHaveTextContent('1 ticket · ₦5,000');
    expect(screen.getByTestId('select-problem')).toHaveTextContent(
      'This code makes your order free, which can’t be booked in the app yet. Remove the code or book on bookhushly.com.',
    );
    await fireEvent.press(continueButton());
    expect(submit).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('promo-remove'));
    expect(screen.queryByTestId('select-problem')).toBeNull();
    await fireEvent.press(continueButton());
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0]).toMatchObject({ promo: null });
    expect(submit.mock.calls[0]?.[1]).toMatchObject({ free: false });
  });

  it('a 429 keeps Continue off until the countdown ends', async () => {
    jest.useFakeTimers();
    try {
      given(PAID);
      createState({ phase: 'busy', waitSeconds: 2, words: 'Too many tries. Wait a moment' });
      await open('event');
      await screen.findByTestId('tickets');
      expect(screen.getByTestId('rate-limit-wait')).toHaveTextContent('You can try again in 0:02');
      expect(continueButton()).toBeDisabled();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2_100);
      });
      expect(continueButton()).toBeEnabled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('events switch off renders not found', async () => {
    mockFlags.events = false;
    given(PAID);
    await open('event');
    expect(screen.getByTestId('listing-not-found')).toBeTruthy();
  });
});
