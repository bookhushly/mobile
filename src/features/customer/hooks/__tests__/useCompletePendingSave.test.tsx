import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { savedDb, type SavedInput } from '@/features/customer/api/savedDb';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { useCompletePendingSave } from '@/features/customer/hooks/useCompletePendingSave';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';
import { err, ok } from '@/shared/lib/result';

import { makeQueryClient, USER, wrapper } from './customerTestUtils';

jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => 0 } }));
jest.mock('@/shared/supabase/client', () => ({ supabase: { auth: {} } }));
jest.mock('@/features/customer/api/savedDb', () => ({
  savedDb: { list: jest.fn(), save: jest.fn(), unsave: jest.fn(), isSaved: jest.fn() },
}));

const HOTEL: SavedInput = {
  listingId: 'h1',
  kind: 'hotel',
  title: 'Harbour Suites',
  image: null,
  location: 'Ikeja, Lagos',
};

const list = jest.spyOn(savedDb, 'list');
const save = jest.spyOn(savedDb, 'save');
const unsave = jest.spyOn(savedDb, 'unsave');
let qc: QueryClient;

beforeEach(() => {
  jest.clearAllMocks();
  qc = makeQueryClient();
  list.mockResolvedValue(ok([]));
  save.mockResolvedValue(ok(undefined));
  unsave.mockResolvedValue(ok(undefined));
  useSignInPrompt.setState({ reason: null, pendingSave: null });
});
afterEach(() => {
  qc.clear();
});

// A write's follow-up refetch resolves after the assertions otherwise, outside act.
const quiet = () =>
  waitFor(() => {
    expect(qc.isFetching()).toBe(0);
  });
const mount = (userId: string) =>
  renderHook((p: { userId: string }) => useCompletePendingSave(p.userId), {
    initialProps: { userId },
    wrapper: wrapper(qc),
  });

it('saves the pending item once a user appears, once only', async () => {
  useSignInPrompt.getState().ask('save', HOTEL);
  useSignInPrompt.getState().proceed();
  const { rerender, unmount } = await mount('');
  expect(save).not.toHaveBeenCalled();
  expect(useSignInPrompt.getState().pendingSave).toEqual(HOTEL);

  await rerender({ userId: USER });
  await waitFor(() => {
    expect(save).toHaveBeenCalledTimes(1);
  });
  expect(save).toHaveBeenCalledWith(USER, HOTEL);
  expect(useSignInPrompt.getState().pendingSave).toBeNull();

  await rerender({ userId: USER });
  await quiet();
  await unmount();
  expect(save).toHaveBeenCalledTimes(1);
});

it('does nothing without a pending item', async () => {
  const { unmount } = await mount(USER);
  await waitFor(() => {
    expect(list).toHaveBeenCalled();
  });
  await quiet();
  await unmount();
  expect(save).not.toHaveBeenCalled();
  expect(unsave).not.toHaveBeenCalled();
});

// toggle would flip it: a heart tapped to save must not remove what the account already holds.
it('an item the account already saved stays saved', async () => {
  qc.setQueryData(customerKeys.saved(USER), [
    { ...HOTEL, id: 'id-h1', createdAt: '2026-10-12T10:00:00.000Z' },
  ]);
  useSignInPrompt.getState().ask('save', HOTEL);
  useSignInPrompt.getState().proceed();
  const { unmount } = await mount(USER);
  await waitFor(() => {
    expect(useSignInPrompt.getState().pendingSave).toBeNull();
  });
  await quiet();
  await unmount();
  expect(unsave).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

it('a failed write is reported, not retried, and can be cleared', async () => {
  save.mockResolvedValue(err({ kind: 'network' }));
  useSignInPrompt.getState().ask('save', HOTEL);
  useSignInPrompt.getState().proceed();
  const { result, rerender, unmount } = await mount(USER);
  await waitFor(() => {
    expect(result.current.writeError).toBe('transient');
  });
  await quiet();
  await rerender({ userId: USER });
  expect(save).toHaveBeenCalledTimes(1);
  expect(useSignInPrompt.getState().pendingSave).toBeNull();
  await act(async () => {
    result.current.clearWriteError();
    await Promise.resolve();
  });
  expect(result.current.writeError).toBeNull();
  await unmount();
});
