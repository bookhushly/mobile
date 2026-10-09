import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAuthNotice } from '@/features/auth/hooks/useAuthNotice';
import { registerSignOutGuard } from '@/shared/lib/signOutGuard';

type AuthResult = Promise<{ error: unknown }>;
const mockSignInWithPassword = jest.fn<AuthResult, [unknown]>();
const mockSignOut = jest.fn<AuthResult, [unknown?]>();
const mockRemoveItem = jest.fn<Promise<void>, [string]>();

jest.mock('@/shared/platform/secureStore', () => ({
  secureKv: {
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(),
    delete: () => Promise.resolve(),
  },
}));
jest.mock('@/shared/supabase/client', () => ({
  STORAGE_KEY: 'bh-auth',
  sessionStore: { removeItem: (k: string) => mockRemoveItem(k) },
  supabase: {
    auth: {
      signInWithPassword: (p: unknown) => mockSignInWithPassword(p),
      signOut: (o?: unknown) => mockSignOut(o),
    },
  },
}));

const signedIn = { status: 'signedIn', userId: 'u1', email: 'a@b.co' } as const;
const wipe = jest.fn<Promise<void>, [string]>();

beforeAll(() => {
  registerSignOutGuard({
    check: () => Promise.resolve({ unsynced: 2, unsyncable: 0 }),
    syncNow: () => Promise.resolve(),
    wipe,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.setState({ state: signedIn, recovery: false });
  useAuthNotice.setState({ notice: null });
  mockSignOut.mockResolvedValue({ error: null });
  mockRemoveItem.mockResolvedValue(undefined);
  wipe.mockResolvedValue(undefined);
});

describe('checkPassword', () => {
  it('reads a banned account as closed: the delete already went through', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { status: 403, code: 'user_banned', message: 'User is banned' },
    });
    expect(await useAuth.getState().checkPassword('pw')).toBe('closed');
  });
});

describe('signOutAfterDeletion', () => {
  it('wipes this account’s local data even though there are unsynced admissions', async () => {
    await useAuth.getState().signOutAfterDeletion('u1');
    expect(wipe).toHaveBeenCalledWith('u1');
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(useAuth.getState().state).toEqual({ status: 'signedOut' });
    expect(useAuthNotice.getState().notice).toBe('accountDeleted');
  });

  it('ends signed out with the notice even if both remote and local sign-out throw', async () => {
    mockSignOut.mockRejectedValue(new Error('offline'));
    mockRemoveItem.mockRejectedValue(new Error('keychain'));
    await expect(useAuth.getState().signOutAfterDeletion('u1')).resolves.toBeUndefined();
    expect(wipe).toHaveBeenCalledWith('u1');
    expect(useAuth.getState().state).toEqual({ status: 'signedOut' });
    expect(useAuthNotice.getState().notice).toBe('accountDeleted');
  });

  it('wipes the captured account even when the session is already gone', async () => {
    // A banned refreshSession() makes supabase-js emit SIGNED_OUT before the route gets here.
    useAuth.setState({ state: { status: 'signedOut' } });
    await useAuth.getState().signOutAfterDeletion('u1');
    expect(wipe).toHaveBeenCalledWith('u1');
    expect(useAuth.getState().state).toEqual({ status: 'signedOut' });
    expect(useAuthNotice.getState().notice).toBe('accountDeleted');
  });

  it('still signs out and sets the notice when the wipe throws', async () => {
    wipe.mockRejectedValueOnce(new Error('disk'));
    await expect(useAuth.getState().signOutAfterDeletion('u1')).resolves.toBeUndefined();
    expect(useAuth.getState().state).toEqual({ status: 'signedOut' });
    expect(useAuthNotice.getState().notice).toBe('accountDeleted');
  });
});
