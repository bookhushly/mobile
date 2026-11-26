import {
  EMPTY_SECURITY,
  securityBody,
  securityStepReady,
  type SecurityDraft,
} from '@/features/customer/domain/security/securityRequest';

const TODAY = '2026-12-01';
const contact = { fullName: 'Ada Obi', email: 'ada@example.com', phone: '+2348012345678' };

const ready: SecurityDraft = {
  ...EMPTY_SECURITY,
  service: 'residential',
  address: ' 7 Bourdillon Road, Ikoyi ',
  state: 'Lagos',
  startDate: '2026-12-05',
  duration: 'monthly',
  guardType: 'unarmed',
  guards: 2,
};

describe('securityStepReady', () => {
  it('needs a service, then a place', () => {
    expect(securityStepReady('service', EMPTY_SECURITY, TODAY)).toBe(false);
    expect(securityStepReady('where', { ...ready, state: null }, TODAY)).toBe(false);
    expect(securityStepReady('where', ready, TODAY)).toBe(true);
  });

  it('refuses a start before today, or an end before the start', () => {
    expect(securityStepReady('when', { ...ready, startDate: '2026-11-30' }, TODAY)).toBe(false);
    expect(securityStepReady('when', { ...ready, endDate: '2026-12-04' }, TODAY)).toBe(false);
    expect(securityStepReady('when', { ...ready, endDate: '2026-12-31' }, TODAY)).toBe(true);
  });

  it('needs how long and what kind of guards, and 1 to 500 of them', () => {
    expect(securityStepReady('team', { ...ready, duration: null }, TODAY)).toBe(false);
    expect(securityStepReady('team', { ...ready, guardType: null }, TODAY)).toBe(false);
    expect(securityStepReady('team', { ...ready, guards: 501 }, TODAY)).toBe(false);
    expect(securityStepReady('team', ready, TODAY)).toBe(true);
  });

  it('a hidden answer never blocks: only the questions shown for the service count', () => {
    // Typed as an event, then the service switched to a home: the guest count is no longer asked.
    expect(securityStepReady('details', { ...ready, attendance: 'about 200' }, TODAY)).toBe(true);
    expect(
      securityStepReady(
        'details',
        { ...ready, service: 'event_security', attendance: 'about 200' },
        TODAY,
      ),
    ).toBe(false);
    expect(securityStepReady('details', { ...ready, entrances: '99999999999' }, TODAY)).toBe(false);
  });

  it('lets the details be skipped, but typed numbers must be whole numbers', () => {
    expect(securityStepReady('details', ready, TODAY)).toBe(true);
    expect(
      securityStepReady(
        'details',
        { ...ready, service: 'event_security', attendance: 'lots' },
        TODAY,
      ),
    ).toBe(false);
    expect(securityStepReady('details', { ...ready, entrances: '0' }, TODAY)).toBe(false);
    expect(securityStepReady('details', { ...ready, entrances: '3' }, TODAY)).toBe(true);
  });
});

describe('securityBody', () => {
  it('sends what the web form sends, trimmed', () => {
    expect(securityBody(ready, contact, TODAY)).toEqual({
      service_type: 'residential',
      full_name: 'Ada Obi',
      email: 'ada@example.com',
      phone: '+2348012345678',
      service_address: '7 Bourdillon Road, Ikoyi',
      state: 'Lagos',
      start_date: '2026-12-05',
      duration_type: 'monthly',
      number_of_guards: 2,
      guard_type: 'unarmed',
      requires_canine: false,
      requires_vehicle: false,
      has_cctv: false,
      has_alarm_system: false,
      previous_incidents: false,
      requires_background_check: true,
      requires_uniform: true,
      requires_communication_device: true,
    });
  });

  it('sends event answers only for an event, property answers only for a place', () => {
    const event: SecurityDraft = {
      ...ready,
      service: 'event_security',
      eventType: ' Wedding ',
      attendance: '300',
      eventHours: '8',
      vip: true,
      propertyType: 'commercial',
      entrances: '4',
    };
    const body = securityBody(event, contact, TODAY);
    expect(body).toMatchObject({
      event_type: 'Wedding',
      expected_attendance: 300,
      event_duration_hours: 8,
      vip_protection: true,
    });
    expect(body).not.toHaveProperty('property_type');
    expect(body).not.toHaveProperty('number_of_entrances');
    expect(body).not.toHaveProperty('has_cctv');

    const home = securityBody(
      { ...ready, propertyType: 'residential', propertySize: 'large', entrances: '2', cctv: true },
      contact,
      TODAY,
    );
    expect(home).toMatchObject({
      property_type: 'residential',
      property_size: 'large',
      number_of_entrances: 2,
      has_cctv: true,
    });
    expect(home).not.toHaveProperty('event_type');
  });

  it('sends incident details only when there were incidents', () => {
    expect(
      securityBody({ ...ready, incidentDetails: 'A break-in last year' }, contact, TODAY),
    ).not.toHaveProperty('incident_details');
    expect(
      securityBody(
        { ...ready, incidents: true, incidentDetails: ' A break-in last year ' },
        contact,
        TODAY,
      ),
    ).toMatchObject({ previous_incidents: true, incident_details: 'A break-in last year' });
  });

  it('is null while anything required is missing', () => {
    expect(securityBody({ ...ready, guardType: null }, contact, TODAY)).toBeNull();
    expect(securityBody(ready, { ...contact, phone: '' }, TODAY)).toBeNull();
  });
});
