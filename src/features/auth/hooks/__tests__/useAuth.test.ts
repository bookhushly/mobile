import { RECOVERY_KEY } from '@/features/auth/domain/recovery';
import { recoveryPending, useAuth } from '@/features/auth/hooks/useAuth';
import { useAuthNotice } from '@/features/auth/hooks/useAuthNotice';
import { secureKv } from '@/shared/platform/secureStore';

type AuthResult = Promise<{ error: unknown }>;
const mockVerifyOtp = jest.fn<AuthResult, [unknown]>();
const mockSignInWithPassword = jest.fn<AuthResult, [unknown]>();
const mockSignOut = jest.fn<AuthResult, [unknown?]>();
const mockRemoveItem = jest.fn<Promise<void>, [string]>();

// In-memory SecureStore; the factory must not touch module-scope values eagerly (hoisting).
jest.mock('@/shared/platform/secureStore', () => {
  const m = new Map<string, string>();
  return {
    secureKv: {
      get: (k: string) => Promise.resolve(m.get(k) ?? null),
      set: (k: string, v: string) => {
        m.set(k, v);
        return Promise.resolve();
      },
      delete: (k: string) => {
        m.delete(k);
        return Promise.resolve();
      },
    },
  };
});
jest.mock('@/shared/supabase/client', () => ({
  STORAGE_KEY: 'bh-auth',
  sessionStore: { removeItem: (k: string) => mockRemoveItem(k) },
  supabase: {
    auth: {
      verifyOtp: (p: unknown) => mockVerifyOtp(p),
      signInWithPassword: (p: unknown) => mockSignInWithPassword(p),
      signOut: (o?: unknown) => mockSignOut(o),
    },
  },
}));

const signedIn = { status: 'signedIn', userId: 'u1', email: 'a@b.co' } as const;

beforeEach(async () => {
  jest.clearAllMocks();
  await secureKv.delete(RECOVERY_KEY);
  useAuth.setState({ state: { status: 'loading' }, recovery: false });
  useAuthNotice.setState({ notice: null });
  mockSignOut.mockResolvedValue({ error: null });
  mockRemoveItem.mockResolvedValue(undefined);
});

describe('verifyCode', () => {
  it('signup: never touches the recovery marker', async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    expect(await useAuth.getState().verifyCode('a@b.co', '123456', 'signup')).toBeNull();
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'a@b.co',
      token: '123456',
      type: 'signup',
    });
    expect(useAuth.getState().recovery).toBe(false);
    expect(await recoveryPending()).toBe(false);
  });

  it('recovery: marks before verifyOtp and keeps the mark on success', async () => {
    mockVerifyOtp.mockImplementation(async () => {
      // The SIGNED_IN event fires inside verifyOtp: the marker must already be set.
      expect(useAuth.getState().recovery).toBe(true);
      expect(await recoveryPending()).toBe(true);
      return { error: null };
    });
    expect(await useAuth.getState().verifyCode('a@b.co', '123456', 'recovery')).toBeNull();
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'a@b.co',
      token: '123456',
      type: 'recovery',
    });
    expect(useAuth.getState().recovery).toBe(true);
    expect(await recoveryPending()).toBe(true);
  });

  it('recovery: a bad code clears the mark and maps the error', async () => {
    mockVerifyOtp.mockResolvedValue({ error: { status: 403, code: 'otp_expired', message: 'x' } });
    expect(await useAuth.getState().verifyCode('a@b.co', '000000', 'recovery')).toBe('badCode');
    expect(useAuth.getState().recovery).toBe(false);
    expect(await recoveryPending()).toBe(false);
  });

  it('transient verify failures are reported as such', async () => {
    mockVerifyOtp.mockResolvedValue({ error: { status: 503, message: 'down' } });
    expect(await useAuth.getState().verifyCode('a@b.co', '123456', 'signup')).toBe('transient');
  });
});

describe('recovery lifecycle', () => {
  it('finishRecovery clears the mark and stays signed in', async () => {
    useAuth.setState({ state: signedIn, recovery: true });
    await secureKv.set(RECOVERY_KEY, '1');
    await useAuth.getState().finishRecovery();
    expect(useAuth.getState().recovery).toBe(false);
    expect(await recoveryPending()).toBe(false);
    expect(useAuth.getState().state.status).toBe('signedIn');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('abandonRecovery clears the mark and signs out this device only', async () => {
    useAuth.setState({ state: signedIn, recovery: true });
    await secureKv.set(RECOVERY_KEY, '1');
    await useAuth.getState().abandonRecovery();
    expect(useAuth.getState().recovery).toBe(false);
    expect(await recoveryPending()).toBe(false);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(useAuth.getState().state).toEqual({ status: 'signedOut' });
  });

  it('abandonRecovery signs out locally even if the remote call fails', async () => {
    useAuth.setState({ state: signedIn, recovery: true });
    mockSignOut.mockRejectedValue(new Error('offline'));
    await useAuth.getState().abandonRecovery();
    expect(mockRemoveItem).toHaveBeenCalledWith('bh-auth');
    expect(useAuth.getState().state).toEqual({ status: 'signedOut' });
  });
});

describe('checkPassword', () => {
  it('ok / wrong / transient, using the signed-in email', async () => {
    useAuth.setState({ state: signedIn });
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });
    expect(await useAuth.getState().checkPassword('pw')).toBe('ok');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'pw' });
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { status: 400, code: 'invalid_credentials' },
    });
    expect(await useAuth.getState().checkPassword('pw')).toBe('wrong');
    mockSignInWithPassword.mockResolvedValueOnce({ error: { status: 429 } });
    expect(await useAuth.getState().checkPassword('pw')).toBe('transient');
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { name: 'AuthRetryableFetchError', status: 0 },
    });
    expect(await useAuth.getState().checkPassword('pw')).toBe('transient');
  });

  it('is wrong when not signed in (never calls the server)', async () => {
    expect(await useAuth.getState().checkPassword('pw')).toBe('wrong');
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });
});

describe('signOutAfterDeletion', () => {
  it('signs out locally and sets the one-shot notice', async () => {
    useAuth.setState({ state: signedIn });
    await useAuth.getState().signOutAfterDeletion();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(useAuth.getState().state).toEqual({ status: 'signedOut' });
    expect(useAuthNotice.getState().notice).toBe('accountDeleted');
    useAuthNotice.getState().clear();
    expect(useAuthNotice.getState().notice).toBeNull();
  });
});
