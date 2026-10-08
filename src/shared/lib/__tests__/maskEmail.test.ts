import { maskEmail } from '@/shared/lib/maskEmail';

it('keeps the first and last letter of the local part', () => {
  expect(maskEmail('adaeze@gmail.com')).toBe('a•••e@gmail.com');
  expect(maskEmail('ab@x.co')).toBe('a•@x.co');
  expect(maskEmail('a@x.co')).toBe('a@x.co');
  expect(maskEmail('not-an-email')).toBe('not-an-email');
});

it('leaves an address with an empty local part alone', () => {
  expect(maskEmail('@x.co')).toBe('@x.co');
  expect(maskEmail('')).toBe('');
});
