import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAuthNotice } from '@/features/auth/hooks/useAuthNotice';
import {
  registerAlwaysWipe,
  registerSignOutGuard,
  type SignOutCheck,
} from '@/shared/lib/signOutGuard';

// The customer wallet registers an always-wipe; auth must run it on every sign-out path, and
// never on a sign-out that was only checked or got blocked (cancelled).

type AuthResult = Promise<{ error: unknown }>;
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
  supabase: { auth: { signOut: (o?: unknown) => mockSignOut(o) } },
}));

const signedIn = { status: 'signedIn', userId: 'u1', email: 'a@b.co' } as const;
const gateCheck = jest.fn<Promise<SignOutCheck>, [string]>();
const gateWipe = jest.fn<Promise<void>, [string]>();
const walletWipe = jest.fn<Promise<void>, []>();

beforeAll(() => {
  registerSignOutGuard({ check: gateCheck, syncNow: () => Promise.resolve(), wipe: gateWipe });
  registerAlwaysWipe(walletWipe);
});

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.setState({ state: signedIn, recovery: false });
  useAuthNotice.setState({ notice: null });
  mockSignOut.mockResolvedValue({ error: null });
  mockRemoveItem.mockResolvedValue(undefined);
  gateCheck.mockResolvedValue({ unsynced: 0, unsyncable: 0 });
  gateWipe.mockResolvedValue(undefined);
  walletWipe.mockResolvedValue(undefined);
});

const signedOut = () => {
  expect(useAuth.getState().state.status).toBe('signedOut');
};

it('a plain sign-out wipes the wallet', async () => {
  await useAuth.getState().signOut();
  signedOut();
  expect(walletWipe).toHaveBeenCalledTimes(1);
});

it('a local session removal that fails once is retried; then signed out and wiped', async () => {
  mockSignOut.mockResolvedValue({ error: new Error('network') });
  mockRemoveItem.mockRejectedValueOnce(new Error('keychain'));
  expect(await useAuth.getState().signOut()).toEqual({ blocked: null });
  signedOut();
  expect(walletWipe).toHaveBeenCalledTimes(1);
});

it('a local session that cannot be removed is not a sign-out: still in, nothing wiped', async () => {
  mockSignOut.mockResolvedValue({ error: new Error('network') });
  mockRemoveItem.mockRejectedValue(new Error('keychain'));
  expect(await useAuth.getState().signOut()).toEqual({ blocked: null, incomplete: true });
  expect(useAuth.getState().state).toEqual(signedIn);
  expect(walletWipe).not.toHaveBeenCalled();
});

it('keeping offline gate data still wipes the wallet', async () => {
  await useAuth.getState().signOut({ keepOfflineData: true });
  expect(gateWipe).not.toHaveBeenCalled();
  expect(walletWipe).toHaveBeenCalledTimes(1);
});

it('a failed check keeps gate data but still wipes the wallet', async () => {
  gateCheck.mockRejectedValue(new Error('db locked'));
  await useAuth.getState().signOut();
  expect(gateWipe).not.toHaveBeenCalled();
  expect(walletWipe).toHaveBeenCalledTimes(1);
});

it('a blocked sign-out (unsynced admissions) is cancelled: nothing is wiped', async () => {
  gateCheck.mockResolvedValue({ unsynced: 3, unsyncable: 0 });
  expect(await useAuth.getState().signOut()).toEqual({
    blocked: { unsynced: 3, unsyncable: 0 },
  });
  expect(useAuth.getState().state).toEqual(signedIn);
  expect(walletWipe).not.toHaveBeenCalled();
});

it('blocked, then signing out keeping the admissions, wipes the wallet', async () => {
  gateCheck.mockResolvedValue({ unsynced: 3, unsyncable: 0 });
  await useAuth.getState().signOut();
  expect(walletWipe).not.toHaveBeenCalled();
  await useAuth.getState().signOut({ keepOfflineData: true });
  signedOut();
  expect(gateWipe).not.toHaveBeenCalled();
  expect(walletWipe).toHaveBeenCalledTimes(1);
});

it('an abandoned password reset wipes the wallet', async () => {
  useAuth.setState({ recovery: true });
  await useAuth.getState().abandonRecovery();
  signedOut();
  expect(walletWipe).toHaveBeenCalledTimes(1);
});

it('signing out after account deletion wipes the wallet', async () => {
  await useAuth.getState().signOutAfterDeletion('u1');
  expect(walletWipe).toHaveBeenCalledTimes(1);
});

it('the server ending the session (SIGNED_OUT event) wipes the wallet', () => {
  useAuth.getState().dispatch({ type: 'SIGNED_OUT' });
  expect(walletWipe).toHaveBeenCalledTimes(1);
});

it('a failing wallet wipe never keeps the user signed in', async () => {
  walletWipe.mockRejectedValue(new Error('keychain locked'));
  await useAuth.getState().signOut();
  signedOut();
});
