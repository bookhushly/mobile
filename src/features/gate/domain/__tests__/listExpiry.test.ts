import { listExpiry } from '@/features/gate/domain/listExpiry';

describe('listExpiry', () => {
  it('keeps a list for 72 hours after the event starts', () => {
    expect(listExpiry('2026-10-10T18:00:00Z')).toBe(Date.parse('2026-10-13T18:00:00Z'));
  });
  it('unknown start: never expires on its own', () => {
    expect(listExpiry(null)).toBeNull();
    expect(listExpiry('tbc')).toBeNull();
  });
});
