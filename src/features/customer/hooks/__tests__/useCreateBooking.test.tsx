import { act, renderHook } from '@testing-library/react-native';
import * as Crypto from 'expo-crypto';

import { cancelBooking } from '@/features/customer/api/bookingActionsApi';
import { createEvent, createStay } from '@/features/customer/api/checkoutApi';
import type { CheckoutDb } from '@/features/customer/api/checkoutDb';
import type { EventSelection, StaySelection } from '@/features/customer/domain/checkout/selection';
import { useCreateBooking } from '@/features/customer/hooks/useCreateBooking';
import { checkoutStore } from '@/features/customer/offline/checkoutStore';
import type { EventCreated, StayCreated } from '@/features/customer/schemas/checkout';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

import { USER } from './customerTestUtils';

jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => Date.now() } }));
jest.mock('@/features/customer/api/checkoutApi', () => ({
  createStay: jest.fn(),
  createEvent: jest.fn(),
}));
jest.mock('@/features/customer/api/checkoutDb', () => ({
  checkoutDb: { findRecentEventBooking: jest.fn() },
}));
jest.mock('@/features/customer/api/bookingActionsApi', () => ({ cancelBooking: jest.fn() }));
jest.mock('@/shared/platform/storage', () => ({
  plainKv: jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv').memoryKv(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

const stayMock = jest.mocked(createStay);
const eventMock = jest.mocked(createEvent);
const findMock = jest.requireMock<{
  checkoutDb: { findRecentEventBooking: jest.MockedFunction<CheckoutDb['findRecentEventBooking']> };
}>('@/features/customer/api/checkoutDb').checkoutDb.findRecentEventBooking;
const cancelMock = jest.mocked(cancelBooking);
const uuidMock = jest.mocked(Crypto.randomUUID);

const NOW = Date.parse('2026-10-21T12:00:00Z');
const HOTEL = 'ho1';
const ROOM = 'rt1';
const EVENT = 'l1';

const stay = (p: Partial<StaySelection> = {}): StaySelection => ({
  checkIn: '2026-11-01',
  checkOut: '2026-11-03',
  adults: 2,
  children: 0,
  rateId: null,
  breakfast: {},
  airport: { on: false, type: 'pickup', code: null },
  promo: null,
  guest: { name: 'Ada Obi', email: 'ada@example.com', phone: '08031234567' },
  specialRequests: '',
  ...p,
});
const tickets = (): EventSelection => ({
  qty: { Regular: 2 },
  answers: {},
  promo: null,
  guest: { name: 'Ada Obi', email: 'ada@example.com', phone: '08031234567' },
});

const stayCreated = ok<StayCreated>({
  booking: {
    id: 'hb1',
    type: 'hotel',
    status: 'pending',
    payment_status: 'pending',
    total: 90000,
    currency: 'NGN',
    nights: 2,
    check_in_date: '2026-11-01',
    check_out_date: '2026-11-03',
    guest_name: 'Ada Obi',
    guest_email: 'ada@example.com',
    guest_phone: '08031234567',
    pricing: { room_total: 90000 },
    created_at: '2026-10-21T12:00:01Z',
    hotel: { id: HOTEL, name: 'Harbour Suites' },
    room_type: { id: ROOM, name: 'Deluxe' },
  },
  next: {
    payment: { type: 'hotel', id: 'hb1', amount: 90000, endpoint: '/api/payment/initialize' },
  },
});
const eventCreated = ok<EventCreated>({
  booking: {
    id: 'eb1',
    status: 'pending',
    payment_status: 'pending',
    total_amount: 20000,
    created_at: '2026-10-21T12:00:01Z',
    listing_id: EVENT,
    ticket_details: { Regular: 2 },
  },
});
const lost = err<ApiError>({ kind: 'timeout' });
const inProgress = err<ApiError>({
  kind: 'conflict',
  code: 'in_progress',
  body: { retry_after: 2 },
});

const keysSent = () => stayMock.mock.calls.map((c) => c[3]);
const ctx = { title: 'Harbour Suites', roomTypeId: ROOM };

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  jest.clearAllMocks();
  let n = 0;
  uuidMock.mockImplementation(() => {
    n += 1;
    return `k${String(n)}`;
  });
  cancelMock.mockResolvedValue(err<ApiError>({ kind: 'network' }));
  await checkoutStore.wipe();
});

afterEach(() => {
  jest.useRealTimers();
});

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

describe('useCreateBooking — stays', () => {
  it('a key 9 minutes old is replaced even for the same selection (A6)', async () => {
    stayMock.mockResolvedValue(lost);
    const { result } = await renderHook(() => useCreateBooking(USER, 'hotel', HOTEL));
    await act(() => result.current.submit(stay(), ctx));
    await advance(9 * 60_000 - 1);
    await act(() => result.current.checkAgain());
    expect(keysSent()).toEqual(['k1', 'k1']);
    await advance(1);
    await act(() => result.current.checkAgain());
    expect(keysSent()).toEqual(['k1', 'k1', 'k2']);
    // The new key is kept from then on.
    await act(() => result.current.submit(stay(), ctx));
    expect(keysSent()).toEqual(['k1', 'k1', 'k2', 'k2']);
  });

  it('stay create reuses the idempotency key for the same selection and mints a new one when it changes', async () => {
    stayMock.mockResolvedValue(lost);
    const { result } = await renderHook(() => useCreateBooking(USER, 'hotel', HOTEL));
    await act(() => result.current.submit(stay(), ctx));
    expect(result.current.state).toEqual({ phase: 'unsure' });
    await act(() => result.current.submit(stay(), ctx));
    await act(() => result.current.checkAgain());
    expect(keysSent()).toEqual(['k1', 'k1', 'k1']);
    await act(() => result.current.submit(stay({ adults: 3 }), ctx));
    expect(keysSent()).toEqual(['k1', 'k1', 'k1', 'k2']);
    expect(stayMock.mock.calls[0]?.[1]).toBe('hotel');
    expect(stayMock.mock.calls[0]?.[2]).toMatchObject({ room_type_id: ROOM, hotel_id: HOTEL });
  });

  it('busy retries three times then mints a new key', async () => {
    stayMock.mockResolvedValue(inProgress);
    const { result } = await renderHook(() => useCreateBooking(USER, 'hotel', HOTEL));
    let done: Promise<void> = Promise.resolve();
    await act(async () => {
      done = result.current.submit(stay(), ctx);
      await Promise.resolve();
    });
    expect(result.current.state).toEqual({ phase: 'busy', waitSeconds: 2 });
    // A tap while waiting sends nothing.
    await act(() => result.current.submit(stay(), ctx));
    await advance(2000);
    await advance(2000);
    await advance(2000);
    await act(() => done);
    expect(keysSent()).toEqual(['k1', 'k1', 'k1', 'k1']);
    expect(result.current.state.phase).toBe('failed');
    stayMock.mockResolvedValue(stayCreated);
    await act(() => result.current.submit(stay(), ctx));
    expect(keysSent()).toEqual(['k1', 'k1', 'k1', 'k1', 'k2']);
  });

  it('a refusal clears the key: the re-send is a new request, not a cached replay', async () => {
    stayMock.mockResolvedValueOnce(
      err<ApiError>({ kind: 'conflict', code: 'unavailable', body: {} }),
    );
    const { result } = await renderHook(() => useCreateBooking(USER, 'hotel', HOTEL));
    await act(() => result.current.submit(stay(), ctx));
    expect(result.current.state.phase).toBe('refused');
    stayMock.mockResolvedValue(stayCreated);
    await act(() => result.current.submit(stay(), ctx));
    expect(keysSent()).toEqual(['k1', 'k2']);
  });

  it('unmounting while waiting out a busy answer stops the retries', async () => {
    stayMock.mockResolvedValue(inProgress);
    const { result, unmount } = await renderHook(() => useCreateBooking(USER, 'hotel', HOTEL));
    let done: Promise<void> = Promise.resolve();
    await act(async () => {
      done = result.current.submit(stay(), ctx);
      await Promise.resolve();
    });
    expect(result.current.state.phase).toBe('busy');
    await unmount();
    // The waiting send settles (it would hang forever otherwise) and posts nothing more.
    await done;
    await advance(10_000);
    expect(stayMock).toHaveBeenCalledTimes(1);
  });

  it('writes the entry before created is set', async () => {
    stayMock.mockResolvedValue(stayCreated);
    const { result } = await renderHook(() => useCreateBooking(USER, 'hotel', HOTEL));
    await act(() => result.current.submit(stay(), ctx));
    expect(result.current.created).toEqual({ bookingId: 'hb1' });
    expect(await checkoutStore.get(USER, 'hotel', 'hb1')).toMatchObject({
      listingId: HOTEL,
      title: 'Harbour Suites',
      total: 90000,
      pricing: { room_total: 90000 },
      summary: { checkIn: '2026-11-01', checkOut: '2026-11-03', guests: 2, roomName: 'Deluxe' },
      guestEmail: 'ada@example.com',
      payment: null,
    });
  });

  it('a refusal carries the field to fix', async () => {
    stayMock.mockResolvedValue(
      err<ApiError>({ kind: 'conflict', code: 'max_guests', body: { max_guests: 2 } }),
    );
    const { result } = await renderHook(() => useCreateBooking(USER, 'hotel', HOTEL));
    await act(() => result.current.submit(stay(), ctx));
    expect(result.current.state).toEqual({
      phase: 'refused',
      words: 'Up to 2 guests',
      field: 'maxGuests',
    });
  });

  it('a failed create releases the stray booking and uses a fresh key next', async () => {
    stayMock.mockResolvedValueOnce(
      err<ApiError>({
        kind: 'unavailable',
        status: 500,
        code: 'addons_failed',
        body: { booking_id: 'stray1' },
      }),
    );
    const { result } = await renderHook(() => useCreateBooking(USER, 'hotel', HOTEL));
    await act(() => result.current.submit(stay(), ctx));
    expect(result.current.state).toEqual({ phase: 'failed', words: "Couldn't book. Try again" });
    expect(cancelMock).toHaveBeenCalledWith({}, 'hotel', 'stray1');
    stayMock.mockResolvedValue(stayCreated);
    await act(() => result.current.submit(stay(), ctx));
    expect(keysSent()).toEqual(['k1', 'k2']);
  });
});

describe('useCreateBooking — events', () => {
  it('event create lost answer adopts the pending row', async () => {
    eventMock.mockResolvedValue(lost);
    findMock.mockResolvedValue({ id: 'eb7', created_at: '2026-10-21T12:00:01Z' });
    const { result } = await renderHook(() => useCreateBooking(USER, 'event', EVENT));
    await act(() => result.current.submit(tickets(), { title: 'Afrobeats night' }));
    expect(result.current.state).toEqual({ phase: 'unsure' });
    // Never posted again.
    await act(() => result.current.submit(tickets(), { title: 'Afrobeats night' }));
    expect(eventMock).toHaveBeenCalledTimes(1);
    await act(() => result.current.checkAgain());
    expect(findMock).toHaveBeenCalledWith(USER, EVENT, new Date(NOW - 5000).toISOString());
    expect(result.current.created).toEqual({ bookingId: 'eb7' });
    expect(eventMock).toHaveBeenCalledTimes(1);
  });

  it('event lost answer with no row found offers Continue again', async () => {
    eventMock.mockResolvedValueOnce(lost).mockResolvedValueOnce(eventCreated);
    findMock.mockResolvedValue(null);
    const { result } = await renderHook(() => useCreateBooking(USER, 'event', EVENT));
    await act(() => result.current.submit(tickets(), { title: 'Afrobeats night' }));
    await act(() => result.current.checkAgain());
    expect(result.current.state).toEqual({ phase: 'idle' });
    expect(result.current.created).toBeNull();
    await act(() => result.current.submit(tickets(), { title: 'Afrobeats night' }));
    expect(eventMock).toHaveBeenCalledTimes(2);
    expect(result.current.created).toEqual({ bookingId: 'eb1' });
    expect(await checkoutStore.get(USER, 'event', 'eb1')).toMatchObject({
      total: 20000,
      summary: { tickets: 2 },
      pricing: null,
    });
  });

  it('a free registration writes no checkout entry', async () => {
    eventMock.mockResolvedValue(eventCreated);
    const { result } = await renderHook(() => useCreateBooking(USER, 'event', EVENT));
    await act(() => result.current.submit(tickets(), { title: 'Afrobeats night', free: true }));
    expect(eventMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
    expect(result.current.created).toEqual({ bookingId: 'eb1' });
    expect(await checkoutStore.get(USER, 'event', 'eb1')).toBeNull();
  });

  it('event lookup that fails stays unsure', async () => {
    eventMock.mockResolvedValue(lost);
    findMock.mockRejectedValue(new Error('checkout read failed: network'));
    const { result } = await renderHook(() => useCreateBooking(USER, 'event', EVENT));
    await act(() => result.current.submit(tickets(), { title: 'Afrobeats night' }));
    await act(() => result.current.checkAgain());
    expect(result.current.state).toEqual({ phase: 'unsure' });
    expect(result.current.created).toBeNull();
  });
});
