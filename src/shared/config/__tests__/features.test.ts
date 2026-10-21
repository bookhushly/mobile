import {
  CHECKOUT_EVENTS_ENABLED,
  CHECKOUT_PAYMENTS_ENABLED,
  CHECKOUT_STAYS_ENABLED,
} from '@/shared/config/features';

// Phase 4c switches (spec P2): all on since web #219/#221 went live (2026-10-21, E1).
describe('checkout switches', () => {
  it('are on for stays, events and payments', () => {
    expect(CHECKOUT_STAYS_ENABLED).toBe(true);
    expect(CHECKOUT_EVENTS_ENABLED).toBe(true);
    expect(CHECKOUT_PAYMENTS_ENABLED).toBe(true);
  });
});
