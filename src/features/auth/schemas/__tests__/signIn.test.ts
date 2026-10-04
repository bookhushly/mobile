import { signInSchema } from '@/features/auth/schemas/signIn';

describe('signInSchema', () => {
  it('trims and lowercases the email', () => {
    const r = signInSchema.safeParse({ email: '  A@B.COM ', password: 'x' });
    expect(r.success && r.data.email).toBe('a@b.com');
  });
  it('rejects an invalid email', () => {
    expect(signInSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });
  it('rejects an empty password', () => {
    expect(signInSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});
