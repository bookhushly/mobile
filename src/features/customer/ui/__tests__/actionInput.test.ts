import { checkEmail, commentError, reasonError } from '@/features/customer/ui/actionInput';

describe('reasonError', () => {
  it('needs 1–500 characters after trimming', () => {
    expect(reasonError('   ')).toBe('Tell the organiser why you’re asking for a refund.');
    expect(reasonError(' x ')).toBeNull();
    expect(reasonError('a'.repeat(500))).toBeNull();
    expect(reasonError('a'.repeat(501))).toBe('Use 500 characters or fewer.');
  });
});

describe('commentError', () => {
  it('needs 10–1000 characters after trimming', () => {
    expect(commentError('  123456789  ')).toBe('Write at least 10 characters.');
    expect(commentError('1234567890')).toBeNull();
    expect(commentError('a'.repeat(1001))).toBe('Use 1000 characters or fewer.');
  });
});

describe('checkEmail', () => {
  it('normalises a valid address', () => {
    expect(checkEmail('  Bola@Example.com ', [])).toEqual({ ok: true, email: 'bola@example.com' });
  });

  it('refuses an invalid address', () => {
    expect(checkEmail('bola@', [])).toEqual({ ok: false, error: 'Enter a valid email address.' });
  });

  it('refuses the user’s own email, whatever its case', () => {
    expect(checkEmail('ME@x.com', ['', 'me@X.com '])).toEqual({
      ok: false,
      error: 'That’s your own email. Enter the email of who you’re sending to.',
    });
  });
});
