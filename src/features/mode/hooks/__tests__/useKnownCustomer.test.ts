import { renderHook } from '@testing-library/react-native';

import { useBrowseChoice } from '@/features/mode/hooks/useBrowseChoice';
import { useKnownCustomer } from '@/features/mode/hooks/useKnownCustomer';

jest.mock('@/shared/platform/storage', () => {
  const { memoryKv: make } =
    jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv');
  return { plainKv: make() };
});

const known = async (userId: string | null, recovery: boolean, browsing: boolean | null) => {
  useBrowseChoice.setState({ browsing });
  const { result } = await renderHook(() => useKnownCustomer(userId, recovery));
  return result.current;
};

it('nobody signed in: no customer, nothing pending', async () => {
  expect(await known(null, false, true)).toEqual({ customerId: '', modePending: false });
});

it('signed in with the mode settled: a customer, nothing pending', async () => {
  expect(await known('u1', false, false)).toEqual({ customerId: 'u1', modePending: false });
});

it('signed in while still browsing: may yet be staff, so pending and not a customer', async () => {
  expect(await known('u1', false, true)).toEqual({ customerId: '', modePending: true });
});

it('a reset session never counts as a customer', async () => {
  expect((await known('u1', true, false)).customerId).toBe('');
});
