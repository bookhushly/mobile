import { startSessionListener } from '@/features/auth/api/session';
import { RECOVERY_KEY } from '@/features/auth/domain/recovery';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAuthNotice } from '@/features/auth/hooks/useAuthNotice';
import { secureKv } from '@/shared/platform/secureStore';

type Listener = (event: string, session: unknown) => void;

const mockSignOut = jest.fn<Promise<{ error: unknown }>, [unknown?]>();
const mockRemoveItem = jest.fn<Promise<void>, [string]>();
let mockListener: Listener | null = null;

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
  sessionStore: {
    removeItem: (k: string) => mockRemoveItem(k),
    getItem: () => Promise.resolve(null),
  },
  supabase: {
    auth: {
      onAuthStateChange: (cb: Listener) => {
        mockListener = cb;
        return { data: { subscription: { unsubscribe: () => undefined } } };
      },
      signOut: (o?: unknown) => mockSignOut(o),
    },
  },
}));

const session = { user: { id: 'u1', email: 'a@b.co' } };
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  jest.clearAllMocks();
  await secureKv.delete(RECOVERY_KEY);
  useAuth.setState({ state: { status: 'loading' }, recovery: false });
  useAuthNotice.setState({ notice: null });
  mockSignOut.mockResolvedValue({ error: null });
  mockRemoveItem.mockResolvedValue(undefined);
  startSessionListener();
});

const signedIn = { status: 'signedIn', userId: 'u1', email: 'a@b.co' } as const;

it('a cold start with a session and no reset marker signs in', async () => {
  mockListener?.('INITIAL_SESSION', session);
  await flush();
  expect(useAuth.getState().state).toEqual({ status: 'signedIn', userId: 'u1', email: 'a@b.co' });
  expect(mockSignOut).not.toHaveBeenCalled();
});

it('a cold start mid-reset signs out locally instead of resuming the session', async () => {
  await secureKv.set(RECOVERY_KEY, '1');
  mockListener?.('INITIAL_SESSION', session);
  await flush();
  expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(useAuth.getState().state).toEqual({ status: 'signedOut' });
  expect(useAuth.getState().recovery).toBe(false);
  expect(await secureKv.get(RECOVERY_KEY)).toBeNull();
});

it('a cold start with no session clears a stale marker without signing out', async () => {
  await secureKv.set(RECOVERY_KEY, '1');
  mockListener?.('INITIAL_SESSION', null);
  await flush();
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(useAuth.getState().state).toEqual({ status: 'signedOut' });
  expect(await secureKv.get(RECOVERY_KEY)).toBeNull();
});

it('SIGNED_IN before INITIAL_SESSION with the marker set never signs in', async () => {
  // auth-js flushes the init-chain SIGNED_IN before INITIAL_SESSION reaches the subscriber.
  await secureKv.set(RECOVERY_KEY, '1');
  const seen: string[] = [];
  const unsub = useAuth.subscribe((s) => {
    seen.push(s.state.status);
  });
  mockListener?.('SIGNED_IN', session);
  mockListener?.('INITIAL_SESSION', session);
  await flush();
  unsub();
  expect(seen).not.toContain('signedIn');
  expect(useAuth.getState().state).toEqual({ status: 'signedOut' });
  expect(useAuth.getState().recovery).toBe(false);
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(await secureKv.get(RECOVERY_KEY)).toBeNull();
});

it('TOKEN_REFRESHED before INITIAL_SESSION with the marker set never signs in', async () => {
  await secureKv.set(RECOVERY_KEY, '1');
  const seen: string[] = [];
  const unsub = useAuth.subscribe((s) => {
    seen.push(s.state.status);
  });
  mockListener?.('TOKEN_REFRESHED', session);
  await flush();
  mockListener?.('INITIAL_SESSION', session);
  await flush();
  unsub();
  expect(seen).not.toContain('signedIn');
  expect(useAuth.getState().state).toEqual({ status: 'signedOut' });
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it('after an abandoned reset a later sign-in works', async () => {
  await secureKv.set(RECOVERY_KEY, '1');
  mockListener?.('INITIAL_SESSION', session);
  await flush();
  expect(useAuth.getState().state).toEqual({ status: 'signedOut' });
  mockListener?.('SIGNED_IN', session);
  await flush();
  expect(useAuth.getState().state).toEqual(signedIn);
});

it('a reset code in the same process signs in (the marker is only read at cold start)', async () => {
  mockListener?.('INITIAL_SESSION', null);
  await flush();
  // verifyCode sets the marker and the flag before verifyOtp emits SIGNED_IN.
  await secureKv.set(RECOVERY_KEY, '1');
  useAuth.setState({ recovery: true });
  mockListener?.('SIGNED_IN', session);
  await flush();
  expect(useAuth.getState().state).toEqual(signedIn);
  expect(useAuth.getState().recovery).toBe(true);
  expect(mockSignOut).not.toHaveBeenCalled();
});

it('SIGNED_IN clears the one-shot deleted-account notice', async () => {
  mockListener?.('INITIAL_SESSION', null);
  await flush();
  useAuthNotice.getState().set('accountDeleted');
  mockListener?.('SIGNED_IN', session);
  await flush();
  expect(useAuthNotice.getState().notice).toBeNull();
  expect(useAuth.getState().state).toEqual(signedIn);
});

it('a cold start mid-reset still ends signed out if local sign-out throws', async () => {
  await secureKv.set(RECOVERY_KEY, '1');
  mockSignOut.mockRejectedValue(new Error('offline'));
  mockRemoveItem.mockRejectedValue(new Error('keychain'));
  mockListener?.('INITIAL_SESSION', session);
  await flush();
  expect(useAuth.getState().state).toEqual({ status: 'signedOut' });
});
