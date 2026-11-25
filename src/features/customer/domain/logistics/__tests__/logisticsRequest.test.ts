import {
  EMPTY_LOGISTICS,
  logisticsBody,
  logisticsStepReady,
  type LogisticsDraft,
} from '@/features/customer/domain/logistics/logisticsRequest';

const TODAY = '2026-12-01';
const contact = { fullName: 'Ada Obi', email: 'ada@example.com', phone: '+2348012345678' };

const ready: LogisticsDraft = {
  ...EMPTY_LOGISTICS,
  serviceType: 'delivery',
  pickup: { address: ' 12 Allen Avenue, Ikeja ', landmark: '', state: 'Lagos' },
  dropoff: {
    address: '4 Aminu Kano Crescent, Wuse 2',
    landmark: ' Opposite Zenith Bank ',
    state: 'FCT',
  },
  pickupDate: '2026-12-04',
  itemDescription: ' Two boxes of books ',
};

describe('logisticsStepReady', () => {
  it('needs a service first', () => {
    expect(logisticsStepReady('service', EMPTY_LOGISTICS, TODAY)).toBe(false);
    expect(logisticsStepReady('service', ready, TODAY)).toBe(true);
  });

  it('needs an address and a state at each end', () => {
    expect(
      logisticsStepReady('pickup', { ...ready, pickup: { ...ready.pickup, state: null } }, TODAY),
    ).toBe(false);
    expect(
      logisticsStepReady(
        'dropoff',
        { ...ready, dropoff: { ...ready.dropoff, address: ' ' } },
        TODAY,
      ),
    ).toBe(false);
    expect(logisticsStepReady('pickup', ready, TODAY)).toBe(true);
  });

  it('refuses a pick-up before today, or delivery before pick-up', () => {
    expect(logisticsStepReady('when', { ...ready, pickupDate: '2026-11-30' }, TODAY)).toBe(false);
    expect(logisticsStepReady('when', { ...ready, deliveryDate: '2026-12-03' }, TODAY)).toBe(false);
    expect(logisticsStepReady('when', { ...ready, deliveryDate: '2026-12-05' }, TODAY)).toBe(true);
  });

  it('needs a description of what is sent; value and quantity must be numbers', () => {
    expect(logisticsStepReady('item', { ...ready, itemDescription: '' }, TODAY)).toBe(false);
    expect(logisticsStepReady('item', { ...ready, itemValue: 'lots' }, TODAY)).toBe(false);
    expect(logisticsStepReady('item', { ...ready, quantity: 0 }, TODAY)).toBe(false);
    expect(logisticsStepReady('item', ready, TODAY)).toBe(true);
  });

  it('lets the vehicle be left to the company', () => {
    expect(logisticsStepReady('vehicle', ready, TODAY)).toBe(true);
  });
});

describe('logisticsBody', () => {
  it('sends what the web form sends, trimmed, with empty extras left out', () => {
    expect(logisticsBody(ready, contact, TODAY)).toEqual({
      service_type: 'delivery',
      full_name: 'Ada Obi',
      email: 'ada@example.com',
      phone: '+2348012345678',
      pickup_address: '12 Allen Avenue, Ikeja',
      pickup_state: 'Lagos',
      pickup_date: '2026-12-04',
      delivery_address: '4 Aminu Kano Crescent, Wuse 2',
      delivery_landmark: 'Opposite Zenith Bank',
      delivery_state: 'FCT',
      item_description: 'Two boxes of books',
      quantity: 1,
      requires_packaging: false,
      requires_insurance: false,
      fragile_items: false,
      perishable_items: false,
    });
  });

  it('adds the optional answers when given', () => {
    const full: LogisticsDraft = {
      ...ready,
      pickupTime: '10:00',
      deliveryDate: '2026-12-05',
      itemCategory: 'electronics',
      itemWeight: '5-20kg',
      itemValue: '250000',
      quantity: 2,
      vehicleType: 'van',
      fragile: true,
      notes: ' Call on arrival ',
    };
    expect(logisticsBody(full, contact, TODAY)).toMatchObject({
      pickup_time: '10:00',
      delivery_date: '2026-12-05',
      item_category: 'electronics',
      item_weight: '5-20kg',
      item_value: 250000,
      quantity: 2,
      vehicle_type: 'van',
      fragile_items: true,
      special_instructions: 'Call on arrival',
    });
  });

  it('is null while anything required is missing', () => {
    expect(logisticsBody({ ...ready, serviceType: null }, contact, TODAY)).toBeNull();
    expect(logisticsBody(ready, { ...contact, phone: '' }, TODAY)).toBeNull();
  });
});
