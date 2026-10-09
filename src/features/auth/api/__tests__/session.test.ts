import { startSessionListener } from '@/features/auth/api/session';
import { RECOVERY_KEY } from '@/features/auth/domain/recovery';
import { useAuth } from '@/features/auth/hooks/useAuth';
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
  mockSignOut.mockResolvedValue({ error: null });
  mockRemoveItem.mockResolvedValue(undefined);
  startSessionListener();
});

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

it('a cold start with no session ignores a stale marker', async () => {
  await secureKv.set(RECOVERY_KEY, '1');
  mockListener?.('INITIAL_SESSION', null);
  await flush();
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(useAuth.getState().state).toEqual({ status: 'signedOut' });
});

it('a cold start mid-reset still ends signed out if local sign-out throws', async () => {
  await secureKv.set(RECOVERY_KEY, '1');
  mockSignOut.mockRejectedValue(new Error('offline'));
  mockRemoveItem.mockRejectedValue(new Error('keychain'));
  mockListener?.('INITIAL_SESSION', session);
  await flush();
  expect(useAuth.getState().state).toEqual({ status: 'signedOut' });
});
