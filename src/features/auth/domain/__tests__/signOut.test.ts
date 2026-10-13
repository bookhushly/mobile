import { performSignOut, SignOutIncomplete } from '@/features/auth/domain/signOut';

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
  it('retries removing the local session once, then signs out', async () => {
    const removeLocal = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('keychain'))
      .mockResolvedValueOnce(undefined);
    const onSignedOut = jest.fn();
    await performSignOut({
      remote: () => Promise.reject(new Error('offline')),
      removeLocal,
      onSignedOut,
    });
    expect(removeLocal).toHaveBeenCalledTimes(2);
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });
  it('never reports signed out while the local session is still there', async () => {
    const removeLocal = jest.fn(() => Promise.reject(new Error('keychain')));
    const onSignedOut = jest.fn();
    await expect(
      performSignOut({
        remote: () => Promise.reject(new Error('offline')),
        removeLocal,
        onSignedOut,
      }),
    ).rejects.toBeInstanceOf(SignOutIncomplete);
    expect(removeLocal).toHaveBeenCalledTimes(2);
    expect(onSignedOut).not.toHaveBeenCalled();
  });
});
