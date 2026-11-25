import {
  cancelSecurity,
  getSecurity,
  securityPriceGuide,
} from '@/features/customer/api/securityApi';

import { fakeRequester } from './fakeRequester';

const ROW = {
  id: 's1',
  status: 'open',
  service_type: 'residential',
  service_address: '7 Bourdillon Road',
  landmark: null,
  state: 'Lagos',
  start_date: '2026-12-05',
  end_date: null,
  start_time: '18:00:00',
  duration_type: 'monthly',
  number_of_guards: 2,
  guard_type: 'unarmed',
  shift_pattern: 'night',
  requires_canine: true,
  requires_vehicle: null,
  special_instructions: null,
  expires_at: '2026-12-04T13:00:00Z',
  created_at: '2026-12-01T10:00:00Z',
  vendor_completed_at: null,
  selected_vendor: null,
  selected_offer: null,
};

describe('security API', () => {
  it('reads a request into the shared fields (start date, state) and its own', async () => {
    const { client, calls } = fakeRequester({ body: { request: { ...ROW, vendor_offers: [] } } });
    const r = await getSecurity(client, 's1');
    expect(calls[0]?.path).toBe('/api/security/requests/s1');
    expect(r.ok && r.value).toMatchObject({
      service: 'residential',
      pickupDate: '2026-12-05',
      pickupState: 'Lagos',
      startTime: '18:00',
      guards: 2,
      guardType: 'unarmed',
      shift: 'night',
      canine: true,
      vehicle: false,
      offerCount: 0,
    });
  });

  it('always sends a cancel reason (the web requires one)', async () => {
    const { client, calls } = fakeRequester({ body: { refund: 'none' } });
    await cancelSecurity(client, 's1', ' No longer needed ');
    expect(calls[0]?.opts.body).toEqual({ reason: 'No longer needed' });
  });

  it('asks the guide price by state, guard type and duration', async () => {
    const { client, calls } = fakeRequester({ body: { min: 150000, max: 220000 } });
    const r = await securityPriceGuide(client, 'Lagos', 'unarmed', 'monthly');
    expect(calls[0]?.path).toBe(
      '/api/security/price-estimate?state=Lagos&guardType=unarmed&durationType=monthly',
    );
    expect(r.ok && r.value).toEqual({ min: 150000, max: 220000 });
  });
});
