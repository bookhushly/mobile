import {
  cancelLogistics,
  getLogistics,
  listLogistics,
  logisticsPriceGuide,
} from '@/features/customer/api/logisticsApi';

import { fakeRequester } from './fakeRequester';

const ROW = {
  id: 'l1',
  status: 'paid',
  service_type: 'delivery',
  full_name: 'Ada',
  phone: '+2348012345678',
  email: 'ada@example.com',
  pickup_address: '12 Allen Avenue',
  pickup_landmark: null,
  pickup_state: 'Lagos',
  pickup_date: '2026-12-04',
  pickup_time: '10:00:00',
  delivery_address: '4 Aminu Kano Crescent',
  delivery_landmark: 'Opposite Zenith Bank',
  delivery_state: 'FCT',
  delivery_date: null,
  item_description: 'Two boxes of books',
  item_category: 'documents',
  item_weight: '5-20kg',
  quantity: 2,
  vehicle_type: 'van',
  fragile_items: true,
  perishable_items: false,
  requires_packaging: null,
  requires_insurance: false,
  special_instructions: null,
  expires_at: null,
  created_at: '2026-12-01T10:00:00Z',
  vendor_completed_at: null,
  picked_up_at: '2026-12-04T10:20:00Z',
  in_transit_at: null,
  delivered_at: null,
  selected_vendor: { id: 'v1', business_name: 'Swift Dispatch', phone_number: '+2348022222222' },
  selected_offer: null,
};

describe('logistics API', () => {
  it('reads a request with its progress and a deadline that may be empty', async () => {
    const { client, calls } = fakeRequester({
      body: { success: true, request: { ...ROW, vendor_offers: [] } },
    });
    const r = await getLogistics(client, 'l1');
    expect(calls[0]?.path).toBe('/api/logistics/requests/l1');
    expect(r.ok && r.value).toMatchObject({
      serviceType: 'delivery',
      pickupTime: '10:00',
      expiresAt: null,
      pickedUpAt: '2026-12-04T10:20:00Z',
      quantity: 2,
      fragile: true,
      packaging: false,
      selectedVendor: { name: 'Swift Dispatch', phone: '+2348022222222' },
    });
  });

  it('lists requests, dropping a row it cannot read', async () => {
    const { client } = fakeRequester({
      body: { requests: [{ ...ROW, offer_count: 0 }, { id: 'x' }], count: 2 },
    });
    const r = await listLogistics(client);
    expect(r.ok && r.value.requests.map((x) => x.id)).toEqual(['l1']);
  });

  it('always sends a cancel reason (the web requires one)', async () => {
    const { client, calls } = fakeRequester({ body: { refund: 'none' } });
    await cancelLogistics(client, 'l1', '  Plans changed ');
    expect(calls[0]?.opts.body).toEqual({ reason: 'Plans changed' });
  });

  it('asks the guide price by state and vehicle', async () => {
    const { client, calls } = fakeRequester({ body: { min: 8000, max: 15000 } });
    const r = await logisticsPriceGuide(client, 'Lagos', 'van');
    expect(calls[0]?.path).toBe('/api/logistics/price-estimate?state=Lagos&vehicleType=van');
    expect(r.ok && r.value).toEqual({ min: 8000, max: 15000 });
  });
});
