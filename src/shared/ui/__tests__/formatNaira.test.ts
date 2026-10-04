import { formatNaira } from '@/shared/ui/formatNaira';

describe('formatNaira', () => {
  it.each([
    [0, '₦0'],
    [999, '₦999'],
    [1000, '₦1,000'],
    [45000, '₦45,000'],
    [1234567, '₦1,234,567'],
    [1500.5, '₦1,500.50'],
    [-2500, '-₦2,500'],
  ])('formats %p as %p', (n, expected) => {
    expect(formatNaira(n)).toBe(expected);
  });
});
