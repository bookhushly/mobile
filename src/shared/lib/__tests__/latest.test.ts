import { latestOnly } from '@/shared/lib/latest';

it('only the most recently begun request is current', () => {
  const l = latestOnly();
  const first = l.begin();
  expect(first()).toBe(true);
  const second = l.begin();
  expect(first()).toBe(false);
  expect(second()).toBe(true);
});
