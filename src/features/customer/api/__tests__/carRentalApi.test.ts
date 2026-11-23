import {
  cancelCarRequest,
  carPriceGuide,
  getCarRequest,
  listCarRequests,
  selectCarOffer,
  submitCarRequest,
} from '@/features/customer/api/carRentalApi';

import { fakeRequester } from './fakeRequester';

const ROW = {
  id: 'r1',
  status: 'open',
  trip_type: 'chauffeur',
  vehicle_type: 'sedan',
  pickup_state: 'Lagos',
  pickup_address: 'Allen Avenue, Ikeja',
  destination_state: 'Ogun',
  destination_address: null,
  pickup_date: '2026-12-05',
  return_date: '2026-12-07',
  pickup_time: '09:00:00',
  number_of_passengers: 4,
  purpose: 'leisure',
  additional_notes: null,
  pricing_model: 'multi_day',
  is_urgent: false,
  expires_at: '2026-12-04T13:00:00Z',
  created_at: '2026-12-01T13:00:00Z',
  vendor_completed_at: null,
  selected_vendor: null,
  selected_offer: null,
};

const OFFER = {
  id: 'o1',
  amount: '114000',
  message: 'Full tank.',
  pricing_model: 'multi_day',
  status: 'pending',
  created_at: '2026-12-01T14:00:00Z',
  expires_at: null,
  image_urls: ['https://cdn.example/camry.jpg', 'http://insecure.example/x.jpg'],
  vendor: { id: 'v1', business_name: 'Ikeja Car Hire', rating: 4.6, review_count: 22 },
  vehicle: {
    make: 'Toyota',
    model: 'Camry',
    year: 2019,
    seats: 5,
    vehicle_type: 'sedan',
    image_urls: [],
    is_verified: true,
  },
  driver: { full_name: 'Tunde A.', years_experience: 9, photo_url: null, is_verified: true },
};

describe('car rental API', () => {
  it('lists my requests with their pending quote count, dropping a row it cannot read', async () => {
    const { client, calls } = fakeRequester({
      body: { requests: [{ ...ROW, offer_count: 3 }, { id: 'bad' }], count: 2 },
    });
    const r = await listCarRequests(client);
    expect(calls[0]?.path).toBe('/api/car-rental/requests?page=1&pageSize=50');
    expect(r.ok && r.value.requests.map((x) => [x.id, x.offerCount, x.pickupTime])).toEqual([
      ['r1', 3, '09:00'],
    ]);
  });

  it('reads one request with its offers, counting the pending ones', async () => {
    const { client } = fakeRequester({
      body: {
        success: true,
        request: { ...ROW, vendor_offers: [OFFER, { ...OFFER, id: 'o2', status: 'rejected' }, {}] },
      },
    });
    const r = await getCarRequest(client, 'r1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.offerCount).toBe(1);
    expect(r.value.offers).toHaveLength(2);
    const o = r.value.offers[0];
    expect(o?.amount).toBe(114000);
    expect(o?.imageUrls).toEqual(['https://cdn.example/camry.jpg']);
    expect(o?.vendor).toEqual({ id: 'v1', name: 'Ikeja Car Hire', rating: 4.6, reviewCount: 22 });
    expect(o?.vehicle?.plate).toBeNull();
  });

  it('keeps the request when an embed is malformed', async () => {
    const { client } = fakeRequester({
      body: { request: { ...ROW, selected_vendor: 'oops', pickup_time: 'soon' } },
    });
    const r = await getCarRequest(client, 'r1');
    expect(r.ok && [r.value.selectedVendor, r.value.pickupTime]).toEqual([null, null]);
  });

  it('posts the body and returns the new id', async () => {
    const { client, calls } = fakeRequester({ body: { request: { id: 'new' } } });
    const body = {
      trip_type: 'self_drive' as const,
      pickup_state: 'Lagos',
      pickup_address: 'Ikeja',
      pickup_date: '2026-12-05',
      number_of_passengers: 1,
      is_urgent: false,
      full_name: 'A',
      email: 'a@example.com',
      phone: '+2348012345678',
    };
    const r = await submitCarRequest(client, body);
    expect(calls[0]?.opts).toMatchObject({ method: 'POST', body });
    expect(r.ok && r.value.id).toBe('new');
  });

  it('chooses an offer by id only', async () => {
    const { client, calls } = fakeRequester({ body: {} });
    await selectCarOffer(client, 'r/1', 'o1');
    expect(calls[0]?.path).toBe('/api/car-rental/requests/r%2F1/select-offer');
    expect(calls[0]?.opts.body).toEqual({ offerId: 'o1' });
  });

  it('sends a cancel reason only when one is given', async () => {
    const { client, calls } = fakeRequester({ body: { request: {}, refund: 'pending' } });
    const r = await cancelCarRequest(client, 'r1', '  ');
    expect(calls[0]?.opts.body).toEqual({});
    expect(r.ok && r.value.refund).toBe('pending');
  });

  it('reads the guide price as a range, or null with too few rates', async () => {
    const a = fakeRequester({ body: { min: 35000, max: 55000, currency: 'NGN' } });
    const r = await carPriceGuide(a.client, 'Lagos', 'sedan', 'full_day');
    expect(a.calls[0]?.path).toBe(
      '/api/car-rental/price-estimate?state=Lagos&vehicleType=sedan&pricingModel=full_day',
    );
    expect(a.calls[0]?.opts.auth).toBe(false);
    expect(r.ok && r.value).toEqual({ min: 35000, max: 55000 });
    const b = fakeRequester({ body: { min: null, max: null } });
    const n = await carPriceGuide(b.client, 'Lagos', 'sedan', 'full_day');
    expect(n.ok && n.value).toBeNull();
  });
});
