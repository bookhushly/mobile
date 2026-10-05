import { reduceAuth, type AuthState } from '@/features/auth/domain/authState';

const loading: AuthState = { status: 'loading' };
const session = { userId: 'u1', email: 'a@b.c' };

describe('reduceAuth', () => {
  it('INITIAL_SESSION with a session -> signedIn; without -> signedOut', () => {
    expect(reduceAuth(loading, { type: 'INITIAL_SESSION', session })).toEqual({
      status: 'signedIn',
      ...session,
    });
    expect(reduceAuth(loading, { type: 'INITIAL_SESSION', session: null })).toEqual({
      status: 'signedOut',
    });
  });
  it('SIGNED_IN and TOKEN_REFRESHED/USER_UPDATED keep or set signedIn', () => {
    expect(reduceAuth({ status: 'signedOut' }, { type: 'SIGNED_IN', session })).toMatchObject({
      status: 'signedIn',
    });
    expect(
      reduceAuth({ status: 'signedIn', ...session }, { type: 'TOKEN_REFRESHED', session }),
    ).toMatchObject({ status: 'signedIn' });
  });
  it('only an explicit SIGNED_OUT signs the user out; a refresh event without a session does not', () => {
    const signedIn: AuthState = { status: 'signedIn', ...session };
    expect(reduceAuth(signedIn, { type: 'TOKEN_REFRESHED', session: null })).toEqual(signedIn);
    expect(reduceAuth(signedIn, { type: 'USER_UPDATED', session: null })).toEqual(signedIn);
    expect(reduceAuth(signedIn, { type: 'SIGNED_OUT' })).toEqual({ status: 'signedOut' });
  });
});
