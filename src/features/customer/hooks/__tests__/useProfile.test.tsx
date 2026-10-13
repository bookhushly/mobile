import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { customerDb, type ProfileInput } from '@/features/customer/api/customerDb';
import { useProfile, useSaveProfile } from '@/features/customer/hooks/useProfile';
import type { ProfileRow } from '@/features/customer/schemas/profile';
import { err, ok } from '@/shared/lib/result';
import { supabase } from '@/shared/supabase/client';

import { makeQueryClient, USER, wrapper } from './customerTestUtils';

jest.mock('@/shared/supabase/client', () => ({
  supabase: { auth: { refreshSession: jest.fn(), updateUser: jest.fn() } },
}));
jest.mock('@/features/customer/api/customerDb', () => ({
  ...jest.requireActual<object>('@/features/customer/api/customerDb'),
  customerDb: { profile: jest.fn(), saveProfile: jest.fn() },
}));

// Spies, not jest.mocked(obj.method): referencing a method unbound trips the lint rule.
let db: {
  profile: jest.SpiedFunction<typeof customerDb.profile>;
  saveProfile: jest.SpiedFunction<typeof customerDb.saveProfile>;
};
let updateUser: jest.SpiedFunction<typeof supabase.auth.updateUser>;
let refresh: jest.SpiedFunction<typeof supabase.auth.refreshSession>;

const PROFILE: ProfileRow = {
  id: USER,
  email: 'ada@example.com',
  name: 'Ada Obi',
  phone: null,
  state: 'Lagos',
  address: null,
};
const INPUT: ProfileInput = {
  name: 'Ada O.',
  phone: '+2348031234567',
  state: 'Oyo',
  address: '1 Marina',
};

beforeEach(() => {
  jest.clearAllMocks();
  db = {
    profile: jest.spyOn(customerDb, 'profile').mockResolvedValue(ok(PROFILE)),
    saveProfile: jest.spyOn(customerDb, 'saveProfile').mockResolvedValue(ok(1)),
  };
  updateUser = jest
    .spyOn(supabase.auth, 'updateUser')
    .mockResolvedValue({ data: { user: null }, error: null } as never);
  refresh = jest
    .spyOn(supabase.auth, 'refreshSession')
    .mockResolvedValue({ data: { session: null }, error: null } as never);
});

async function run() {
  const qc = makeQueryClient();
  const hook = await renderHook(() => ({ p: useProfile(USER), s: useSaveProfile(USER) }), {
    wrapper: wrapper(qc),
  });
  await waitFor(() => {
    expect(hook.result.current.p.loading).toBe(false);
  });
  return {
    result: hook.result,
    done: async () => {
      await hook.unmount();
      qc.clear();
    },
  };
}

it('reads the profile', async () => {
  const { result, done } = await run();
  expect(db.profile).toHaveBeenCalledWith(USER);
  expect(result.current.p.profile).toEqual(PROFILE);
  await done();
});

it('offline, says it could not load instead of spinning', async () => {
  onlineManager.setOnline(false);
  try {
    const qc = makeQueryClient();
    const hook = await renderHook(() => useProfile(USER), { wrapper: wrapper(qc) });
    await waitFor(() => {
      expect(hook.result.current.error).toBe(true);
    });
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.profile).toBeNull();
    await hook.unmount();
    qc.clear();
  } finally {
    onlineManager.setOnline(true);
  }
});

it('saves only the four fields, then mirrors the name into the auth metadata', async () => {
  const { result, done } = await run();
  // Whatever else reaches the hook (above all `role`) never reaches the write.
  const smuggled = { ...INPUT, role: 'admin', email: 'x@example.com' };
  // The refetch after the save reads the saved row.
  db.profile.mockResolvedValue(ok({ ...PROFILE, ...INPUT }));
  let outcome: string | undefined;
  await act(async () => {
    outcome = await result.current.s.save(smuggled);
  });
  expect(outcome).toBe('ok');
  expect(db.saveProfile).toHaveBeenCalledWith(USER, INPUT);
  expect(Object.keys(db.saveProfile.mock.calls[0]?.[1] ?? {}).sort()).toEqual([
    'address',
    'name',
    'phone',
    'state',
  ]);
  expect(updateUser).toHaveBeenCalledWith({ data: { name: 'Ada O.' } });
  await waitFor(() => {
    expect(db.profile).toHaveBeenCalledTimes(2);
  });
  expect(result.current.p.profile).toMatchObject({ name: 'Ada O.', state: 'Oyo' });
  expect(result.current.s.saving).toBe(false);
  await done();
});

it('still succeeds when the auth metadata update fails', async () => {
  updateUser.mockRejectedValue(new Error('offline'));
  const { result, done } = await run();
  let outcome: string | undefined;
  await act(async () => {
    outcome = await result.current.s.save(INPUT);
  });
  expect(outcome).toBe('ok');
  await done();
});

it('a zero-row save with no session to refresh is stale, and skips the metadata', async () => {
  db.saveProfile.mockResolvedValue(ok(0));
  const { result, done } = await run();
  let outcome: string | undefined;
  await act(async () => {
    outcome = await result.current.s.save(INPUT);
  });
  expect(outcome).toBe('stale');
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(updateUser).not.toHaveBeenCalled();
  expect(result.current.p.profile).toEqual(PROFILE);
  await done();
});

it('a network failure is transient', async () => {
  db.saveProfile.mockResolvedValue(err({ kind: 'network' }));
  const { result, done } = await run();
  let outcome: string | undefined;
  await act(async () => {
    outcome = await result.current.s.save(INPUT);
  });
  expect(outcome).toBe('transient');
  expect(result.current.s.saving).toBe(false);
  await done();
});
