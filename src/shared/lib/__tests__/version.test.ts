import { isVersionSupported } from '@/shared/lib/version';

it.each([
  ['1.0.0', '1.0.0', true],
  ['1.2.0', '1.1.9', true],
  ['1.0.0', '1.0.1', false],
  ['2.0.0', '10.0.0', false],
  ['1.10.0', '1.9.0', true],
  ['1.0', '1.0.0', true],
  ['garbage', '1.0.0', true], // never block on an unreadable version
])('%s >= %s -> %p', (cur, min, expected) => {
  expect(isVersionSupported(cur, min)).toBe(expected);
});
