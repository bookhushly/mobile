import { itemWords, stateRoute } from '@/features/customer/ui/logistics/logisticsWords';

describe('logistics words', () => {
  it('words the item briefly', () => {
    expect(itemWords({ quantity: 2, itemWeight: '5-20kg', fragile: true, perishable: false })).toBe(
      '2 items · 5–20 kg · fragile',
    );
    expect(itemWords({ quantity: 1, itemWeight: null, fragile: false, perishable: false })).toBe(
      '1 item',
    );
  });

  it('names the route by state, once when it stays inside one', () => {
    const name = (s: string) => (s === 'FCT' ? 'Abuja (FCT)' : s);
    expect(stateRoute('Lagos', 'FCT', name)).toBe('Lagos → Abuja (FCT)');
    expect(stateRoute('Lagos', 'Lagos', name)).toBe('Lagos');
  });
});
