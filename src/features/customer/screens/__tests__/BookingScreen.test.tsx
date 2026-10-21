import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { Linking } from 'react-native';

import { fromEvent } from '@/features/customer/domain/myBookings';
import { checkoutStore, type CheckoutEntry } from '@/features/customer/offline/checkoutStore';
import { useBooking } from '@/features/customer/hooks/useBooking';
import type { WalletEntry } from '@/features/customer/offline/wallet';
import { sentNotice } from '@/features/customer/hooks/sentNotice';
import { BookingScreen } from '@/features/customer/screens/BookingScreen';
import { refreshColors } from '@/shared/ui';

import { ap, ev, ho, TODAY } from '../../hooks/__tests__/customerTestUtils';

jest.mock('@/features/customer/hooks/useBooking', () => ({ useBooking: jest.fn() }));
jest.mock('@/shared/api/instance', () => ({
  clock: { serverNow: () => Date.parse('2026-10-13T11:00:00Z') },
}));
// The section has its own tests (ui/__tests__/BookingActions*); here only where it sits.
jest.mock('@/features/customer/ui/BookingActions', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return {
    BookingActions: ({ target, email }: { target: { kind: string }; email: string }) =>
      createElement(Text, null, `manage ${target.kind} ${email}`),
  };
});
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'opened' })),
}));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
// Off unless a test turns one on: the 4a/4b web hand-off tests run with payments off.
const mockSwitches = { stays: false, events: false, payments: false };
jest.mock('@/shared/config/features', () => ({
  get CHECKOUT_STAYS_ENABLED() {
    return mockSwitches.stays;
  },
  get CHECKOUT_EVENTS_ENABLED() {
    return mockSwitches.events;
  },
  get CHECKOUT_PAYMENTS_ENABLED() {
    return mockSwitches.payments;
  },
}));
jest.mock('@/shared/platform/storage', () => {
  const m = new Map<string, string>();
  return {
    plainKv: {
      get: (k: string) => Promise.resolve(m.get(k) ?? null),
      set: (k: string, v: string) => {
        m.set(k, v);
        return Promise.resolve();
      },
      delete: (k: string) => {
        m.delete(k);
        return Promise.resolve();
      },
    },
  };
});

const mockBooking = jest.mocked(useBooking);
const ID = '0b6f1f4e-2c1a-4f6e-9a39-6f0e7d2b9c11';

function loaded(over: Partial<ReturnType<typeof useBooking>>) {
  const refetch = jest.fn(() => Promise.resolve());
  mockBooking.mockReturnValue({
    row: undefined,
    fromWallet: null,
    savedAt: null,
    today: TODAY,
    error: false,
    refetch,
    ...over,
  });
  return refetch;
}

const h = {
  onBack: jest.fn(),
  onShowTickets: jest.fn(),
  onShowCheckInCode: jest.fn(),
  onTransferred: jest.fn(),
  onPay: jest.fn(),
  onBookAgain: jest.fn(),
};
async function show(kind: 'event' | 'hotel' | 'apartment') {
  await render(
    <BookingScreen userId="u1" email="me@example.com" booking={{ kind, id: ID }} {...h} />,
  );
}

let openURL: jest.SpyInstance;
beforeEach(async () => {
  jest.clearAllMocks();
  Object.assign(mockSwitches, { stays: false, events: false, payments: false });
  await checkoutStore.wipe();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

it('event: date, venue to Maps, packages, tickets and Show tickets', async () => {
  loaded({
    row: ev({
      id: ID,
      ticket_details: { VIP: 2, Regular: 1 },
      seat_assignments: [{ seat: 'A12' }],
      tickets: [
        { id: 't1', ticket_type: 'VIP', ticket_index: 1, checked_in_at: null },
        { id: 't2', ticket_type: 'VIP', ticket_index: 2, checked_in_at: '2026-10-20T18:42:00Z' },
      ],
    }),
  });
  await show('event');
  expect(screen.getByRole('header', { name: 'Afrobeats night' })).toBeTruthy();
  expect(screen.getByText('Tue 20 Oct · 7:00 pm')).toBeTruthy();
  expect(screen.getByText('2 × VIP, 1 × Regular')).toBeTruthy();
  expect(screen.getByLabelText('Payment, ₦45,000, Paid')).toBeTruthy();
  expect(screen.getByLabelText('Ticket 1 · VIP, Seat A12, Valid')).toBeTruthy();
  expect(screen.getByLabelText('Ticket 2 · VIP, Admitted on Tue 20 Oct at 7:42 pm')).toBeTruthy();
  // Spec E9: the Manage booking section replaces the 4a "use bookhushly.com" note.
  expect(screen.getByText('manage event me@example.com')).toBeTruthy();
  expect(screen.queryByText('To change or cancel, use bookhushly.com')).toBeNull();

  await fireEvent.press(screen.getByRole('link', { name: 'Venue, Eko Hotel, Lagos' }));
  expect(openURL).toHaveBeenCalledWith('https://maps.apple.com/?q=Eko%20Hotel%2C%20Lagos');
  await fireEvent.press(screen.getByRole('button', { name: 'Show tickets' }));
  expect(h.onShowTickets).toHaveBeenCalledWith(ID);
});

it('event: tickets still being issued says so, with no Show tickets', async () => {
  loaded({ row: ev({ id: ID, tickets: [] }) });
  await show('event');
  expect(screen.getByText('Your tickets are being issued — pull to refresh')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Show tickets' })).toBeNull();
});

it('a hidden listing shows the kind word and still opens (C4)', async () => {
  loaded({ row: ev({ id: ID, listing: null, booking_date: '2026-10-20' }) });
  await show('event');
  expect(screen.getByRole('header', { name: 'Event' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Booking' })).toBeTruthy();
  expect(screen.getByText('Details aren’t available right now')).toBeTruthy();
  expect(screen.getByText('Tue 20 Oct · 10:00 am')).toBeTruthy();
});

it('a pending booking points to the website to finish paying', async () => {
  loaded({ row: ev({ id: ID, payment_status: 'pending', status: 'pending' }) });
  await show('event');
  expect(screen.getByText('Finish paying on bookhushly.com')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Show tickets' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Pay on bookhushly.com' }));
  expect(openBrowserAsync).toHaveBeenCalledWith('https://bookhushly.com/dashboard/customer');
});

it('a hotel booking with no total says only paid or not (no call action either)', async () => {
  loaded({ row: ho({ id: ID, total_amount: null }) });
  await show('hotel');
  expect(screen.getByLabelText('Payment, Paid')).toBeTruthy();
  expect(screen.queryByText(/₦/)).toBeNull();
  expect(screen.queryByRole('button', { name: /call/i })).toBeNull();
});

it('hotel: dates with the hotel times, room type, guests, payment and the check-in code', async () => {
  loaded({ row: ho({ id: ID, children: 1 }) });
  await show('hotel');
  expect(screen.getByRole('header', { name: 'Harbour Suites' })).toBeTruthy();
  expect(screen.getByLabelText('Check-in, Tue 13 Oct · from 2:00 pm')).toBeTruthy();
  expect(screen.getByLabelText('Check-out, Thu 15 Oct · by 12:00 pm')).toBeTruthy();
  expect(screen.getByLabelText('Room type, Deluxe')).toBeTruthy();
  expect(screen.getByLabelText('Guests, 2 adults, 1 child')).toBeTruthy();
  expect(screen.getByLabelText('Payment, ₦45,000, Paid')).toBeTruthy();
  expect(screen.getByText('₦45,000')).toBeTruthy();
  await fireEvent.press(screen.getByRole('link', { name: 'Address, Ikeja, Lagos' }));
  expect(openURL).toHaveBeenCalledWith('https://maps.apple.com/?q=Ikeja%2C%20Lagos');
  await fireEvent.press(screen.getByRole('button', { name: 'Show check-in code' }));
  expect(h.onShowCheckInCode).toHaveBeenCalledWith(ID);
});

it('hotel: no check-in code once checked out', async () => {
  loaded({ row: ho({ id: ID, booking_status: 'checked_out' }) });
  await show('hotel');
  expect(screen.queryByRole('button', { name: 'Show check-in code' })).toBeNull();
});

it('apartment: area, address, dates and nights, times, guests and payment', async () => {
  loaded({
    row: ap({
      id: ID,
      booking_status: 'confirmed',
      payment_status: 'pending',
      check_in_date: '2026-10-20',
      check_out_date: '2026-10-22',
      apartment: {
        id: 'ap1',
        name: 'Lekki Loft',
        city: 'Lagos',
        state: 'Lagos',
        area: 'Lekki',
        address: '5 Admiralty Way',
        image_urls: null,
        check_in_time: '15:00',
        check_out_time: '11:00',
      },
    }),
  });
  await show('apartment');
  expect(screen.getByRole('header', { name: 'Lekki Loft' })).toBeTruthy();
  expect(screen.getByLabelText('Area, Lekki, Lagos')).toBeTruthy();
  expect(screen.getByLabelText('Dates, 20–22 Oct · 2 nights')).toBeTruthy();
  expect(screen.getByLabelText('Check-in, Tue 20 Oct · from 3:00 pm')).toBeTruthy();
  expect(screen.getByLabelText('Check-out, Thu 22 Oct · by 11:00 am')).toBeTruthy();
  expect(screen.getByLabelText('Guests, 2 guests')).toBeTruthy();
  expect(screen.getByLabelText('Payment, ₦45,000, Not paid')).toBeTruthy();
  expect(screen.getByText('Finish paying on bookhushly.com')).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('link', { name: 'Address, 5 Admiralty Way, Lekki, Lagos' }),
  );
  expect(openURL).toHaveBeenCalledWith(
    'https://maps.apple.com/?q=5%20Admiralty%20Way%2C%20Lekki%2C%20Lagos',
  );
});

it('a booking RLS does not return, or bad params, is not on your account', async () => {
  loaded({ row: null });
  await show('hotel');
  expect(screen.getByText('This booking isn’t on your account')).toBeTruthy();
  await render(<BookingScreen userId="u1" email="" booking={null} {...h} />);
  expect(screen.getByText('This booking isn’t on your account')).toBeTruthy();
});

it('offline, the saved copy shows with its tickets and a saved-data banner', async () => {
  const entry: WalletEntry = {
    ...fromEvent(ev({ id: ID }), TODAY),
    tickets: [{ id: 't1', index: 1, total: 1, type: 'Regular', seat: null, admittedAt: null }],
    liveOnly: true,
  };
  loaded({ fromWallet: entry, savedAt: Date.parse('2026-10-13T09:42:00Z') });
  await show('event');
  expect(
    screen.getByText('Showing saved details — last updated 10:42 am. Pull to refresh.'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Ticket 1 · Regular, Valid')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Show tickets' }));
  expect(h.onShowTickets).toHaveBeenCalledWith(ID);
});

it('a failed load with nothing saved is an error with Try again, never "not yours"', async () => {
  const refetch = loaded({ error: true });
  await show('event');
  expect(screen.getByText('Couldn’t load this booking')).toBeTruthy();
  expect(screen.queryByText('This booking isn’t on your account')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

// The host tree as text; element-valued props (a header's `left`) carry fiber cycles, so skip them.
function hostJson(tree: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(tree, (key, value: unknown) => {
    if (key === '_owner' || key === '_store') return undefined;
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return undefined;
      seen.add(value);
    }
    return value;
  });
}

it('pull to refresh on the details uses the theme colours', async () => {
  loaded({ row: ho({ id: ID }) });
  await show('hotel');
  const json = hostJson(screen.toJSON());
  expect(json).toContain(`"tintColor":"${refreshColors.tintColor}"`);
  expect(json).toContain(`"colors":${JSON.stringify(refreshColors.colors)}`);
  expect(json).toContain(`"progressBackgroundColor":"${refreshColors.progressBackgroundColor}"`);
});

it('just transferred away: "not found" is the transfer working, never "not yours" (fix 9)', async () => {
  sentNotice.set('u1', ID, 'b•••a@example.com');
  try {
    loaded({ row: null });
    await show('event');
    expect(screen.queryByText('This booking isn’t on your account')).toBeNull();
    expect(screen.getByRole('header', { name: 'Booking' })).toBeTruthy();
  } finally {
    await act(() => {
      sentNotice.clear();
    });
  }
});

describe('pending payment (P21)', () => {
  // The mocked server clock reads 2026-10-13 11:00Z.
  const PENDING_EVENT = { id: ID, payment_status: 'pending', status: 'pending' } as const;
  const STORED: CheckoutEntry = {
    userId: 'u1',
    kind: 'event',
    bookingId: ID,
    listingId: 'l1',
    title: 'Afrobeats night',
    createdAt: '2026-10-13T10:50:00+00:00',
    total: 45000,
    pricing: null,
    summary: {},
    guestEmail: 'me@example.com',
    payment: { reference: 'ref1', paymentUrl: 'https://checkout.paystack.com/x', startedAt: 1 },
    paymentEverStarted: true,
  };

  it('pending event booking shows Pay now', async () => {
    mockSwitches.payments = true;
    loaded({ row: ev(PENDING_EVENT) });
    await show('event');
    await fireEvent.press(await screen.findByRole('button', { name: 'Pay now' }));
    expect(h.onPay).toHaveBeenCalledWith('event', ID);
    expect(screen.queryByText('Pay on bookhushly.com')).toBeNull();
    expect(openBrowserAsync).not.toHaveBeenCalled();
  });

  it('a pending stay inside its hold shows Pay now', async () => {
    mockSwitches.payments = true;
    loaded({
      row: ho({
        id: ID,
        payment_status: 'pending',
        booking_status: 'confirmed',
        created_at: '2026-10-13T10:50:00+00:00',
      }),
    });
    await show('hotel');
    await fireEvent.press(await screen.findByRole('button', { name: 'Pay now' }));
    expect(h.onPay).toHaveBeenCalledWith('hotel', ID);
  });

  it('stale pending stay shows hold ended', async () => {
    mockSwitches.payments = true;
    loaded({
      row: ho({
        id: ID,
        payment_status: 'pending',
        booking_status: 'confirmed',
        // 25 min after this is 10:35Z, before the clock's 11:00Z.
        created_at: '2026-10-13T10:10:00+00:00',
      }),
    });
    await show('hotel');
    expect(await screen.findByText('This hold has ended')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pay now' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Book again' }));
    expect(h.onBookAgain).toHaveBeenCalledWith('hotel', 'ho1');
  });

  it('a stale stay whose listing is hidden has no Book again', async () => {
    mockSwitches.payments = true;
    loaded({
      row: ho({
        id: ID,
        payment_status: 'pending',
        booking_status: 'confirmed',
        created_at: '2026-10-13T10:10:00+00:00',
        hotel: null,
      }),
    });
    await show('hotel');
    expect(await screen.findByText('This hold has ended')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Book again' })).toBeNull();
  });

  it('booking with a stored payment shows Checking your payment', async () => {
    mockSwitches.payments = true;
    await checkoutStore.put(STORED);
    loaded({ row: ev(PENDING_EVENT) });
    await show('event');
    expect(await screen.findByText('Checking your payment…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pay now' })).toBeNull();
    expect(screen.queryByText('Pay on bookhushly.com')).toBeNull();
  });

  it('a saved copy with a stored payment shows Checking your payment', async () => {
    mockSwitches.payments = true;
    await checkoutStore.put(STORED);
    loaded({ fromWallet: { ...fromEvent(ev(PENDING_EVENT), TODAY) }, error: true });
    await show('event');
    expect(await screen.findByText('Checking your payment…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pay now' })).toBeNull();
  });

  it('a saved pending copy never offers Pay now (its flag may be stale)', async () => {
    mockSwitches.payments = true;
    loaded({ fromWallet: { ...fromEvent(ev(PENDING_EVENT), TODAY) }, error: true });
    await show('event');
    expect(await screen.findByRole('button', { name: 'Pay on bookhushly.com' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pay now' })).toBeNull();
  });
});
