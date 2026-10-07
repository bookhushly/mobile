import { ago } from '@/features/gate/domain/ago';

const NOW = Date.parse('2026-10-07T18:00:00Z');

describe('ago', () => {
  it.each([
    [10_000, 'just now'],
    [4 * 60_000, '4 min ago'],
    [3 * 3_600_000, '3 h ago'],
    [3 * 86_400_000, '3 days ago'],
    [-5_000, 'just now'],
  ])('%i ms ago → %s', (diff, text) => {
    expect(ago(NOW - diff, NOW)).toBe(text);
  });
});
