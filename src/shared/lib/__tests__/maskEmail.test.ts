import { maskEmail } from '@/shared/lib/maskEmail';

it('keeps the first and last letter of the local part', () => {
  expect(maskEmail('adaeze@gmail.com')).toBe('a•••e@gmail.com');
  expect(maskEmail('abc@x.co')).toBe('a•••c@x.co');
});

it('always masks a short local part (S4)', () => {
  expect(maskEmail('ab@x.co')).toBe('a•••@x.co');
  expect(maskEmail('a@x.co')).toBe('a•••@x.co');
  expect(maskEmail('@x.co')).toBe('•••@x.co');
});

it('masks all but the first character of text without an "@"', () => {
  expect(maskEmail('not-an-email')).toBe('n•••');
  expect(maskEmail('')).toBe('');
});
