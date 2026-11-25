import { teamWords } from '@/features/customer/ui/security/securityWords';

describe('teamWords', () => {
  it('words the team briefly', () => {
    expect(teamWords({ guards: 2, guardType: 'unarmed', duration: 'monthly' })).toBe(
      '2 unarmed guards · months',
    );
    expect(teamWords({ guards: 1, guardType: 'armed', duration: null })).toBe('1 armed guard');
    expect(teamWords({ guards: 4, guardType: 'both', duration: 'one_time' })).toBe(
      '4 guards (armed and unarmed) · one event',
    );
  });
});
