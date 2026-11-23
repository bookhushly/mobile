import { act, renderHook } from '@testing-library/react-native';

import {
  getCarRequest,
  listCarRequests,
  selectCarOffer,
  submitCarRequest,
} from '@/features/customer/api/carRentalApi';
import {
  useCarActions,
  useSubmitCarRequest,
  writeResult,
} from '@/features/customer/hooks/useCarActions';
import type { CarRequest } from '@/features/customer/schemas/carRental';

import { makeQueryClient, wrapper } from './customerTestUtils';

jest.mock('@/features/customer/api/carRentalApi', () => ({
  submitCarRequest: jest.fn(),
  listCarRequests: jest.fn(),
  selectCarOffer: jest.fn(),
  cancelCarRequest: jest.fn(),
  confirmCarTripDone: jest.fn(),
  reviewCarTrip: jest.fn(),
  getCarRequest: jest.fn(),
  carPriceGuide: jest.fn(),
}));
jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => mockNow } }));
const mockNow = Date.parse('2026-12-01T10:00:00Z');

const mockSubmit = jest.mocked(submitCarRequest);
const mockList = jest.mocked(listCarRequests);

const BODY = {
  trip_type: 'chauffeur' as const,
  pickup_state: 'Lagos',
  pickup_address: 'Ikeja',
  pickup_date: '2026-12-04',
  number_of_passengers: 1,
  is_urgent: false,
  full_name: 'Ada',
  email: 'ada@example.com',
  phone: '+2348012345678',
};

const row = (over: Partial<CarRequest>) =>
  ({
    id: 'landed',
    status: 'open',
    tripType: 'chauffeur',
    pickupState: 'Lagos',
    pickupDate: '2026-12-04',
    createdAt: '2026-12-01T09:58:00Z',
    ...over,
  }) as CarRequest;

beforeEach(() => {
  jest.clearAllMocks();
});

async function hook() {
  return renderHook(() => useSubmitCarRequest('u1'), { wrapper: wrapper(makeQueryClient()) });
}

describe('writeResult', () => {
  it('never reads a transient failure as a refusal', () => {
    for (const kind of ['network', 'timeout', 'rateLimited', 'aborted', 'validation'] as const) {
      expect(writeResult({ ok: false, error: { kind } })).toEqual({ kind: 'tryAgain' });
    }
    expect(writeResult({ ok: false, error: { kind: 'unavailable', status: 503 } })).toEqual({
      kind: 'tryAgain',
    });
    expect(writeResult({ ok: false, error: { kind: 'auth' } })).toEqual({ kind: 'signIn' });
    expect(
      writeResult({ ok: false, error: { kind: 'conflict', code: 'offer_unavailable' } }),
    ).toEqual({
      kind: 'refused',
      code: 'offer_unavailable',
    });
  });
});

describe('useSubmitCarRequest', () => {
  it('a lost answer that did create the request counts as sent (no second request)', async () => {
    mockSubmit.mockResolvedValue({ ok: false, error: { kind: 'timeout' } });
    mockList.mockResolvedValue({ ok: true, value: { requests: [row({})], count: 1 } });
    const { result } = await hook();
    let out: unknown;
    await act(async () => {
      out = await result.current.send(BODY);
    });
    expect(out).toEqual({ kind: 'ok', value: { id: 'landed' } });
  });

  it('says try again when nothing matching landed, or the match is old', async () => {
    mockSubmit.mockResolvedValue({ ok: false, error: { kind: 'network' } });
    mockList.mockResolvedValue({
      ok: true,
      value: {
        requests: [row({ createdAt: '2026-11-30T10:00:00Z' }), row({ pickupState: 'Ogun' })],
        count: 2,
      },
    });
    const { result } = await hook();
    let out: unknown;
    await act(async () => {
      out = await result.current.send(BODY);
    });
    expect(out).toEqual({ kind: 'tryAgain' });
  });

  it('a refusal is returned as it is, without reading the list', async () => {
    mockSubmit.mockResolvedValue({
      ok: false,
      error: { kind: 'unknown', status: 400, code: 'bad_request' },
    });
    const { result } = await hook();
    let out: unknown;
    await act(async () => {
      out = await result.current.send(BODY);
    });
    expect(out).toEqual({ kind: 'refused', code: 'bad_request' });
    expect(mockList).not.toHaveBeenCalled();
  });
});

describe('useCarActions.select', () => {
  it('a lost answer that did choose this quote counts as chosen', async () => {
    jest.mocked(selectCarOffer).mockResolvedValue({ ok: false, error: { kind: 'timeout' } });
    jest.mocked(getCarRequest).mockResolvedValue({
      ok: true,
      value: row({ status: 'matched', selectedOffer: { id: 'o1' } as CarRequest['selectedOffer'] }),
    });
    const { result } = await renderHook(() => useCarActions('u1', 'r1'), {
      wrapper: wrapper(makeQueryClient()),
    });
    let out: unknown;
    await act(async () => {
      out = await result.current.select('o1');
    });
    expect(out).toEqual({ kind: 'ok', value: undefined });
  });

  it('a real refusal stays a refusal', async () => {
    jest
      .mocked(selectCarOffer)
      .mockResolvedValue({ ok: false, error: { kind: 'conflict', code: 'offer_unavailable' } });
    jest.mocked(getCarRequest).mockResolvedValue({
      ok: true,
      value: row({
        status: 'matched',
        selectedOffer: { id: 'other' } as CarRequest['selectedOffer'],
      }),
    });
    const { result } = await renderHook(() => useCarActions('u1', 'r1'), {
      wrapper: wrapper(makeQueryClient()),
    });
    let out: unknown;
    await act(async () => {
      out = await result.current.select('o1');
    });
    expect(out).toEqual({ kind: 'refused', code: 'offer_unavailable' });
  });
});
