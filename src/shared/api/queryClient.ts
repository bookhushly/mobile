import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, Platform } from 'react-native';

import { isRetryable, type ApiError } from '@/shared/lib/errors';

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'kind' in e;
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < 2 && isApiError(error) && isRetryable(error);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetryQuery, staleTime: 30_000, refetchOnReconnect: true },
  },
});

export function setupQueryManagers(): () => void {
  const appSub = AppState.addEventListener('change', (s) => {
    if (Platform.OS !== 'web') focusManager.setFocused(s === 'active');
  });
  onlineManager.setEventListener((setOnline) => {
    void Network.getNetworkStateAsync().then((s) => {
      setOnline(s.isConnected === true);
    });
    const sub = Network.addNetworkStateListener((s) => {
      setOnline(s.isConnected === true);
    });
    return () => {
      sub.remove();
    };
  });
  return () => {
    appSub.remove();
  };
}
