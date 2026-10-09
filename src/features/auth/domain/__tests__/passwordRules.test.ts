import { passwordRules, RULES } from '@/features/auth/domain/passwordRules';

it('lists the five server rules in order', () => {
  expect(RULES.map((r) => r.id)).toEqual(['length', 'uppercase', 'lowercase', 'number', 'special']);
});

it('marks each rule', () => {
  expect(passwordRules('').met).toEqual({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });
  expect(passwordRules('Abcdefg1!').met).toEqual({
    length: true,
    uppercase: true,
    lowercase: true,
    number: true,
    special: true,
  });
  expect(passwordRules('Abcdefg1!').ok).toBe(true);
});

it('only @$!%*?& count as special', () => {
  expect(passwordRules('Abcdefg1#').met.special).toBe(false);
  expect(passwordRules('Abcdefg1&').met.special).toBe(true);
});

it('length counts characters, the cap counts UTF-8 bytes (72)', () => {
  expect(passwordRules('Ab1!' + 'a'.repeat(68)).tooLong).toBe(false); // 72 bytes
  expect(passwordRules('Ab1!' + 'a'.repeat(69)).tooLong).toBe(true); // 73 bytes
  const emoji = 'Ab1!' + '😀'.repeat(17); // 4 + 68 = 72 bytes
  expect(passwordRules(emoji).tooLong).toBe(false);
  expect(passwordRules(emoji + '😀').tooLong).toBe(true); // 76 bytes
  expect(passwordRules(emoji + '😀').ok).toBe(false);
});
