import {
  parseStoredSession,
  resolveInitialSession,
} from '@/features/auth/domain/storedSession';

const good = JSON.stringify({
  access_token: 'a',
  refresh_token: 'r',
  user: { id: 'u1', email: 'a@b.c' },
});

describe('parseStoredSession', () => {
  it('reads a stored session with a user and refresh token', () => {
    expect(parseStoredSession(good)).toEqual({ userId: 'u1', email: 'a@b.c' });
  });
  it.each([null, '', 'not json', '{}', '{"user":{}}', '{"user":{"id":"u"}}'])(
    'rejects %p',
    (raw) => {
      expect(parseStoredSession(raw)).toBeNull();
    },
  );
});

describe('resolveInitialSession (cold start offline with an expired access token)', () => {
  it('keeps the SDK session when there is one, without reading storage', async () => {
    const read = jest.fn();
    const s = { userId: 'x', email: 'x@y.z' };
    expect(await resolveInitialSession(s, read)).toEqual(s);
    expect(read).not.toHaveBeenCalled();
  });
  it('falls back to the stored session when the SDK reports none (expired + offline)', async () => {
    expect(await resolveInitialSession(null, () => Promise.resolve(good))).toEqual({
      userId: 'u1',
      email: 'a@b.c',
    });
  });
  it('is signed out when nothing usable is stored', async () => {
    expect(await resolveInitialSession(null, () => Promise.resolve(null))).toBeNull();
  });
  it('is signed out (not a crash) when reading storage throws', async () => {
    expect(await resolveInitialSession(null, () => Promise.reject(new Error('boom')))).toBeNull();
  });
});
