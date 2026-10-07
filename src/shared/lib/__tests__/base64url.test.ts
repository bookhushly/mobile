import { decodeBase64url, encodeBase64url } from '@/shared/lib/base64url';

const bytes = (...n: number[]) => new Uint8Array(n);
const UUID_BYTES = bytes(63, 37, 4, 224, 79, 137, 17, 211, 154, 12, 3, 5, 232, 44, 51, 1);

describe('base64url', () => {
  it('encodes without padding', () => {
    expect(encodeBase64url(bytes(251, 255))).toBe('-_8');
    expect(encodeBase64url(UUID_BYTES)).toBe('PyUE4E-JEdOaDAMF6CwzAQ');
  });
  it('round-trips every length remainder', () => {
    for (const b of [bytes(1), bytes(1, 2), bytes(1, 2, 3), bytes(255, 254, 253, 252)]) {
      expect(decodeBase64url(encodeBase64url(b))).toEqual(b);
    }
  });
  it('decodes to the exact length asked for', () => {
    expect(decodeBase64url('PyUE4E-JEdOaDAMF6CwzAQ', 16)).toEqual(UUID_BYTES);
    expect(decodeBase64url('PyUE4E-JEdOaDAMF6CwzAQ', 15)).toBeNull();
  });
  it('rejects padding, standard-alphabet characters and impossible lengths', () => {
    expect(decodeBase64url('-_8=')).toBeNull();
    expect(decodeBase64url('+/8')).toBeNull();
    expect(decodeBase64url('abcde')).toBeNull();
    expect(decodeBase64url('')).toBeNull();
  });
  it('rejects non-canonical spare bits (the web calls these malformed)', () => {
    expect(decodeBase64url('-_9')).toBeNull();
  });
});
