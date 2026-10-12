import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useDeskSession } from '@/features/receptionist/hooks/useDeskSession';
import { useShiftLog } from '@/features/receptionist/state/shiftLog';

import { makeQueryClient } from './deskTestUtils';

const entry = { at: 1, kind: 'checkIn' as const, text: 'Checked in Ada Obi · Room 204' };

function setup(initial: string | null) {
  const qc = makeQueryClient();
  qc.setQueryData(['desk', 'h1', 'guests', '2026-10-11'], [{ guest_name: 'Ada Obi' }]);
  qc.setQueryData(['desk', 'staff', 'u1'], { total: 1 });
  qc.setQueryData(['gate', 'events'], ['kept']);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return {
    qc,
    hook: renderHook(
      ({ id }: { id: string | null }) => {
        useDeskSession(id);
      },
      { wrapper, initialProps: { id: initial } },
    ),
  };
}

beforeEach(() => {
  useShiftLog.getState().clear();
});

it('keeps the log while the hotel stays, and clears it when the hotel changes', async () => {
  const { qc, hook } = setup(null);
  const h = await hook;
  await h.rerender({ id: 'h1' });
  useShiftLog.getState().add(entry);
  await h.rerender({ id: 'h1' });
  // A hotel briefly not in hand (e.g. reloading) is not a change.
  await h.rerender({ id: null });
  await h.rerender({ id: 'h1' });
  expect(useShiftLog.getState().entries).toEqual([entry]);
  await h.rerender({ id: 'h2' });
  expect(useShiftLog.getState().entries).toEqual([]);
  await h.unmount();
  qc.clear();
});

it('leaving the desk clears the log and drops every desk query, nothing else', async () => {
  const { qc, hook } = setup('h1');
  const h = await hook;
  useShiftLog.getState().add(entry);
  await h.unmount();
  expect(useShiftLog.getState().entries).toEqual([]);
  expect(qc.getQueryCache().findAll({ queryKey: ['desk'] })).toHaveLength(0);
  expect(qc.getQueryData(['gate', 'events'])).toEqual(['kept']);
  qc.clear();
});
