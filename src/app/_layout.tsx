import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';

import { startSessionListener } from '@/features/auth/api/session';
import { useAuth } from '@/features/auth/hooks/useAuth';
import '@/features/gate/offline/signOutGuard';
import { resolveRoute } from '@/features/mode/domain/route';
import { useModeState } from '@/features/mode/hooks/useModeState';
import { useRouteStore } from '@/features/mode/hooks/useRouteStore';
import { APP_VERSION } from '@/shared/api/instance';
import { setupQueryManagers } from '@/shared/api/queryClient';
import { isVersionSupported, MIN_SUPPORTED_VERSION } from '@/shared/lib/version';
import { initMonitoring } from '@/shared/monitoring';
import { AppProviders } from '@/shared/providers/AppProviders';

export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

initMonitoring(APP_VERSION);
void SplashScreen.preventAutoHideAsync();

// Hides the splash once; a second call (route settled and the 2 s fallback) is a no-op, and a
// rejected hide (already hidden by the OS) is not an unhandled promise.
function useHideSplashOnce(): () => void {
  const hidden = useRef(false);
  return useCallback(() => {
    if (hidden.current) return;
    hidden.current = true;
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);
}

function Navigator() {
  const auth = useAuth((s) => s.state);
  const recovery = useAuth((s) => s.recovery);
  // No mode lookup mid-reset: the user is signed in by a code only until the new password is saved.
  const userId = auth.status === 'signedIn' && !recovery ? auth.userId : null;
  const { state: mode, chosen } = useModeState(userId);
  const route = resolveRoute({
    versionOk: isVersionSupported(APP_VERSION, MIN_SUPPORTED_VERSION),
    auth: auth.status,
    mode,
    chosenMode: chosen,
    recovery,
  });

  const setRoute = useRouteStore((s) => s.setRoute);
  const hideSplash = useHideSplashOnce();
  useEffect(() => {
    setRoute(route);
    if (route !== 'loading') hideSplash();
  }, [route, setRoute, hideSplash]);
  // A slow session/mode lookup must not pin the splash: after 2 s show the in-app loading screen.
  useEffect(() => {
    const t = setTimeout(hideSplash, 2000);
    return () => {
      clearTimeout(t);
    };
  }, [hideSplash]);

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
      {/* Unguarded: it must survive the sign-out that a successful deletion triggers. */}
      <Stack.Screen name="delete-account" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

function RootLayout() {
  useEffect(() => startSessionListener(), []);
  useEffect(() => setupQueryManagers(), []);
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Navigator />
    </AppProviders>
  );
}

export default Sentry.wrap(RootLayout);
