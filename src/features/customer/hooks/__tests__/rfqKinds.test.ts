import { CAR_KIND, LOGISTICS_KIND, SECURITY_KIND } from '@/features/customer/hooks/rfqKinds';
import type { CarRequest } from '@/features/customer/schemas/carRental';
import type { LogisticsRequest } from '@/features/customer/schemas/logistics';
import type { SecurityRequest } from '@/features/customer/schemas/security';

jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => 0 } }));

// `sameAs` decides whether a request found after a lost answer is the one just sent. Too loose and
// a second, different request is reported as sent and never goes out; too strict and the customer
// sends the same request twice.

describe('CAR_KIND.sameAs', () => {
  const body = {
    trip_type: 'chauffeur' as const,
    pickup_state: 'Lagos',
    pickup_address: 'Ikeja',
    pickup_date: '2026-12-05',
    number_of_passengers: 1,
    is_urgent: false,
    full_name: 'A',
    email: 'a@example.com',
    phone: '+2348012345678',
  };
  const row = {
    pickupDate: '2026-12-05',
    pickupState: 'Lagos',
    tripType: 'chauffeur',
  } as CarRequest;
  it('matches the same trip, not another day or another kind of trip', () => {
    expect(CAR_KIND.sameAs(row, body)).toBe(true);
    expect(CAR_KIND.sameAs({ ...row, pickupDate: '2026-12-06' }, body)).toBe(false);
    expect(CAR_KIND.sameAs({ ...row, tripType: 'self_drive' }, body)).toBe(false);
  });
});

describe('LOGISTICS_KIND.sameAs', () => {
  const body = {
    service_type: 'delivery' as const,
    full_name: 'A',
    email: 'a@example.com',
    phone: '+2348012345678',
    pickup_address: '12 Allen Avenue',
    pickup_state: 'Lagos',
    pickup_date: '2026-12-04',
    delivery_address: '4 Aminu Kano Crescent',
    delivery_state: 'FCT',
    item_description: 'Books',
    quantity: 1,
    requires_packaging: false,
    requires_insurance: false,
    fragile_items: false,
    perishable_items: false,
  };
  const row = {
    pickupDate: '2026-12-04',
    pickupState: 'Lagos',
    deliveryState: 'FCT',
    serviceType: 'delivery',
    pickupAddress: '12 Allen Avenue ',
    deliveryAddress: '4 Aminu Kano Crescent',
    itemDescription: 'Books',
  } as LogisticsRequest;
  it('matches the same delivery; a second one to another address or with another item is not it', () => {
    expect(LOGISTICS_KIND.sameAs(row, body)).toBe(true);
    expect(LOGISTICS_KIND.sameAs({ ...row, deliveryAddress: '9 Adetokunbo Ademola' }, body)).toBe(
      false,
    );
    expect(LOGISTICS_KIND.sameAs({ ...row, itemDescription: 'A desk' }, body)).toBe(false);
  });
});

describe('SECURITY_KIND.sameAs', () => {
  const body = {
    service_type: 'residential' as const,
    full_name: 'A',
    email: 'a@example.com',
    phone: '+2348012345678',
    service_address: '7 Bourdillon Road',
    state: 'Lagos',
    start_date: '2026-12-05',
    duration_type: 'monthly' as const,
    number_of_guards: 2,
    guard_type: 'unarmed' as const,
    requires_canine: false,
    requires_vehicle: false,
    previous_incidents: false,
    requires_background_check: true,
    requires_uniform: true,
    requires_communication_device: true,
  };
  const row = {
    pickupDate: '2026-12-05',
    pickupState: 'Lagos',
    service: 'residential',
    address: '7 Bourdillon Road',
    guards: 2,
  } as SecurityRequest;
  it('matches the same request; another address, team size or service is not it', () => {
    expect(SECURITY_KIND.sameAs(row, body)).toBe(true);
    expect(SECURITY_KIND.sameAs({ ...row, address: '3 Glover Road' }, body)).toBe(false);
    expect(SECURITY_KIND.sameAs({ ...row, guards: 4 }, body)).toBe(false);
    expect(SECURITY_KIND.sameAs({ ...row, service: 'corporate' }, body)).toBe(false);
  });
});
