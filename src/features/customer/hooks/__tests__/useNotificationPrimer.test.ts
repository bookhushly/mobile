import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import { PRIMER_KEY, useNotificationPrimer } from '@/features/customer/hooks/useNotificationPrimer';

const get = jest.mocked(Notifications.getPermissionsAsync);
const request = jest.mocked(Notifications.requestPermissionsAsync);
type Status = Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;
const notAsked = { status: 'undetermined', granted: false, canAskAgain: true } as unknown as Status;

beforeEach(async () => {
  await AsyncStorage.clear();
  get.mockResolvedValue(notAsked);
});

afterEach(() => {
  jest.clearAllMocks();
});

it('opens for a customer whose phone has not been asked, after the tour', async () => {
  const { result } = await renderHook(() =>
    useNotificationPrimer({ customer: true, tourDone: true }),
  );
  await waitFor(() => {
    expect(result.current.open).toBe(true);
  });
});

it('turn on: closes first, asks the system once, and never shows again on this device', async () => {
  const { result } = await renderHook(() =>
    useNotificationPrimer({ customer: true, tourDone: true }),
  );
  await waitFor(() => {
    expect(result.current.open).toBe(true);
  });
  await act(async () => {
    await result.current.accept();
  });
  expect(request).toHaveBeenCalledTimes(1);
  expect(result.current.open).toBe(false);
  expect(await AsyncStorage.getItem(PRIMER_KEY)).toBe('1');
});

it('not now: closes without the system prompt, and stays closed', async () => {
  const { result } = await renderHook(() =>
    useNotificationPrimer({ customer: true, tourDone: true }),
  );
  await waitFor(() => {
    expect(result.current.open).toBe(true);
  });
  await act(() => {
    result.current.dismiss();
  });
  expect(request).not.toHaveBeenCalled();
  expect(result.current.open).toBe(false);
  await waitFor(async () => {
    expect(await AsyncStorage.getItem(PRIMER_KEY)).toBe('1');
  });
});

it('never for someone browsing without an account', async () => {
  const { result } = await renderHook(() =>
    useNotificationPrimer({ customer: false, tourDone: true }),
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.open).toBe(false);
  expect(get).not.toHaveBeenCalled();
});
