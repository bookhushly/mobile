import { performSignOut } from '@/features/auth/domain/signOut';

describe('performSignOut', () => {
  it('does nothing extra when the remote sign-out succeeds', async () => {
    const removeLocal = jest.fn(() => Promise.resolve());
    const onSignedOut = jest.fn();
    await performSignOut({
      remote: () => Promise.resolve({ error: null }),
      removeLocal,
      onSignedOut,
    });
    expect(removeLocal).not.toHaveBeenCalled();
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });
  it('still signs out locally when the remote call fails (offline, expired token)', async () => {
    const removeLocal = jest.fn(() => Promise.resolve());
    const onSignedOut = jest.fn();
    await performSignOut({
      remote: () => Promise.resolve({ error: new Error('network') }),
      removeLocal,
      onSignedOut,
    });
    expect(removeLocal).toHaveBeenCalledTimes(1);
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });
  it('signs out locally even if the remote call throws', async () => {
    const removeLocal = jest.fn(() => Promise.resolve());
    const onSignedOut = jest.fn();
    await performSignOut({
      remote: () => Promise.reject(new Error('boom')),
      removeLocal,
      onSignedOut,
    });
    expect(removeLocal).toHaveBeenCalledTimes(1);
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });
});
