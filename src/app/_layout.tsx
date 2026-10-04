import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { startSessionListener } from '@/features/auth/api/session';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { resolveRoute } from '@/features/mode/domain/route';
import { useModeState } from '@/features/mode/hooks/useModeState';
import { useRouteStore } from '@/features/mode/hooks/useRouteStore';
import { APP_VERSION } from '@/shared/api/instance';
import { setupQueryManagers } from '@/shared/api/queryClient';
import { isVersionSupported, MIN_SUPPORTED_VERSION } from '@/shared/lib/version';
import { AppProviders } from '@/shared/providers/AppProviders';

void SplashScreen.preventAutoHideAsync();

function Navigator() {
  const auth = useAuth((s) => s.state);
  const userId = auth.status === 'signedIn' ? auth.userId : null;
  const { state: mode, chosen } = useModeState(userId);
  const route = resolveRoute({
    versionOk: isVersionSupported(APP_VERSION, MIN_SUPPORTED_VERSION),
    auth: auth.status,
    mode,
    chosenMode: chosen,
  });

  const setRoute = useRouteStore((s) => s.setRoute);
  useEffect(() => {
    setRoute(route);
    if (route !== 'loading') void SplashScreen.hideAsync();
  }, [route, setRoute]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={route === 'update'}>
        <Stack.Screen name="update-required" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'auth'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'modeError'}>
        <Stack.Screen name="mode-error" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'webOnly'}>
        <Stack.Screen name="web-only" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'gate'}>
        <Stack.Screen name="(gate)" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'receptionist'}>
        <Stack.Screen name="(receptionist)" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'customer'}>
        <Stack.Screen name="(customer)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => startSessionListener(), []);
  useEffect(() => setupQueryManagers(), []);
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Navigator />
    </AppProviders>
  );
}
