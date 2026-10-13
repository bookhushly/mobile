import { initials } from '@/features/customer/ui/initials';

it('takes the first and last word of the name, else the email', () => {
  expect(initials('Ada Lovelace', 'a@x.com')).toBe('AL');
  expect(initials('  ada  b  king ', 'a@x.com')).toBe('AK');
  expect(initials('Ada', 'a@x.com')).toBe('A');
  expect(initials('', 'zed@x.com')).toBe('Z');
  expect(initials(null, 'zed@x.com')).toBe('Z');
  expect(initials(null, '')).toBe('');
});
