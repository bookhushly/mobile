import { shouldOfferPrimer } from '@/features/customer/domain/notificationPrimer';

const base = { customer: true, tourDone: true, asked: false, permission: 'undetermined' } as const;

it('offers once to a signed-in customer whose phone has not been asked', () => {
  expect(shouldOfferPrimer(base)).toBe(true);
});

it('never to someone browsing, or before the tour ends', () => {
  expect(shouldOfferPrimer({ ...base, customer: false })).toBe(false);
  expect(shouldOfferPrimer({ ...base, tourDone: false })).toBe(false);
});

it('not again on this device, and not while either answer is still loading', () => {
  expect(shouldOfferPrimer({ ...base, asked: true })).toBe(false);
  expect(shouldOfferPrimer({ ...base, asked: null })).toBe(false);
  expect(shouldOfferPrimer({ ...base, permission: null })).toBe(false);
});

it('not when the phone already answered: granted, or denied in settings', () => {
  expect(shouldOfferPrimer({ ...base, permission: 'granted' })).toBe(false);
  expect(shouldOfferPrimer({ ...base, permission: 'denied' })).toBe(false);
});
