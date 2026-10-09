import { fieldMessages } from '@/features/auth/domain/signUpErrors';

it('maps server field reasons to messages', () => {
  expect(fieldMessages({ name: 'required', email: 'invalid', password: 'length,special' })).toEqual(
    {
      name: 'Enter your name',
      email: 'Enter a valid email address',
      password: 'Use at least 8 characters and one of @$!%*?&',
    },
  );
  expect(fieldMessages({ name: 'too_long' }).name).toBe('Use 100 characters or fewer');
  expect(fieldMessages({ email: 'required' }).email).toBe('Enter your email');
  expect(fieldMessages({ password: 'too_long' }).password).toBe('That password is too long');
  expect(fieldMessages({ password: 'policy' }).password).toBe('Choose a stronger password');
  expect(fieldMessages(undefined)).toEqual({});
});

it('joins three or more rule hints with commas and a final "and"', () => {
  expect(fieldMessages({ password: 'length,uppercase,number' }).password).toBe(
    'Use at least 8 characters, an upper-case letter and a number',
  );
  expect(fieldMessages({ password: 'uppercase' }).password).toBe('Use an upper-case letter');
});

it('falls back to a generic message for unknown or empty password reasons', () => {
  expect(fieldMessages({ password: '' }).password).toBe('Choose a stronger password');
  expect(fieldMessages({ password: 'mystery' }).password).toBe('Choose a stronger password');
});
