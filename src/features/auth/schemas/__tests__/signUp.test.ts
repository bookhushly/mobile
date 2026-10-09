import { signUpSchema } from '@/features/auth/schemas/signUp';

describe('signUpSchema', () => {
  it('trims the name and normalises the email', () => {
    const r = signUpSchema.safeParse({ name: ' Ada Obi ', email: '  A@B.CO ', password: 'x' });
    expect(r.success && r.data).toEqual({ name: 'Ada Obi', email: 'a@b.co', password: 'x' });
  });
  it('rejects a blank name with a message', () => {
    const r = signUpSchema.safeParse({ name: '   ', email: 'a@b.co', password: 'x' });
    expect(!r.success && r.error.issues[0]?.message).toBe('Enter your name');
  });
  it('rejects a name over 100 characters', () => {
    const r = signUpSchema.safeParse({ name: 'x'.repeat(101), email: 'a@b.co', password: 'x' });
    expect(!r.success && r.error.issues[0]?.message).toBe('Use 100 characters or fewer');
  });
  it('rejects an invalid email', () => {
    const r = signUpSchema.safeParse({ name: 'Ada', email: 'nope', password: 'x' });
    expect(!r.success && r.error.issues[0]?.message).toBe('Enter a valid email address');
  });
  it('leaves the password untouched (rules are checked by passwordRules)', () => {
    const r = signUpSchema.safeParse({ name: 'Ada', email: 'a@b.co', password: ' p ' });
    expect(r.success && r.data.password).toBe(' p ');
  });
});
