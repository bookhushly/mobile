import { useBrowseChoice } from '@/features/mode/hooks/useBrowseChoice';
import type { memoryKv } from '@/shared/lib/kv';

jest.mock('@/shared/platform/storage', () => {
  const { memoryKv: make } =
    jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv');
  return { plainKv: make() };
});
const mockKv = jest.requireMock<{ plainKv: ReturnType<typeof memoryKv> }>(
  '@/shared/platform/storage',
).plainKv;

const store = () => useBrowseChoice.getState();

beforeEach(async () => {
  jest.restoreAllMocks();
  await mockKv.delete('bh.browse');
  useBrowseChoice.setState({ browsing: null });
});

it('is unknown until the stored choice has been read', () => {
  expect(store().browsing).toBeNull();
});

it('load reads a stored choice', async () => {
  await mockKv.set('bh.browse', '1');
  await store().load();
  expect(store().browsing).toBe(true);
});

it('load gives false when nothing is stored', async () => {
  await store().load();
  expect(store().browsing).toBe(false);
});

it('load gives false when the read fails, so Welcome still shows', async () => {
  jest.spyOn(mockKv, 'get').mockRejectedValue(new Error('disk'));
  await store().load();
  expect(store().browsing).toBe(false);
});

it('choose sets true and stores it', () => {
  store().choose();
  expect(store().browsing).toBe(true);
  expect(mockKv.dump()).toEqual({ 'bh.browse': '1' });
});

it('clear sets false and deletes the key', async () => {
  await mockKv.set('bh.browse', '1');
  store().clear();
  expect(store().browsing).toBe(false);
  expect(mockKv.dump()).toEqual({});
});

it('a failed write or delete is not an unhandled rejection', async () => {
  jest.spyOn(mockKv, 'set').mockRejectedValue(new Error('disk'));
  jest.spyOn(mockKv, 'delete').mockRejectedValue(new Error('disk'));
  store().choose();
  expect(store().browsing).toBe(true);
  store().clear();
  expect(store().browsing).toBe(false);
  await Promise.resolve();
});

it('a slow read never undoes a clear made while it was running', async () => {
  await mockKv.set('bh.browse', '1');
  const loading = store().load();
  store().clear();
  await loading;
  expect(store().browsing).toBe(false);
});
