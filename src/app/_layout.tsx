import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';

import { startSessionListener } from '@/features/auth/api/session';
import { useAuth } from '@/features/auth/hooks/useAuth';
import '@/features/gate/offline/signOutGuard';
// Registers the wallet's always-wipe, so every sign-out clears it (even before the tab opens).
import '@/features/customer/offline/wallet';
// Same for recent searches (spec D7: cleared on sign-out).
import '@/features/customer/offline/recentSearches';
// And the reviewed / refund-requested marks (spec E6, E8).
import '@/features/customer/offline/actionMarks';
// And the checkout entries (4c P5, B1): guest emails and payment links, cleared on every sign-out.
import '@/features/customer/offline/checkoutStore';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';
import { authScreensAllowed, resolveRoute, shouldDropPending } from '@/features/mode/domain/route';
import { useBrowseChoice } from '@/features/mode/hooks/useBrowseChoice';
import { useModeState } from '@/features/mode/hooks/useModeState';
import { useRouteStore } from '@/features/mode/hooks/useRouteStore';
import { APP_VERSION } from '@/shared/api/instance';
import { setupQueryManagers } from '@/shared/api/queryClient';
import { isVersionSupported, MIN_SUPPORTED_VERSION } from '@/shared/lib/version';
import { initMonitoring } from '@/shared/monitoring';
import { AppProviders } from '@/shared/providers/AppProviders';

export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

// When a guard change leaves no allowed screen in the stack (signing in hides (auth) before the
// mode has loaded), the stack falls back to its initial route, else to the first declared screen —
// which is the unguarded delete-account modal. Anchor it on the index redirect instead.
export const unstable_settings = { initialRouteName: 'index' };

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
  const browsing = useBrowseChoice((s) => s.browsing);
  const loadBrowsing = useBrowseChoice((s) => s.load);
  const clearBrowsing = useBrowseChoice((s) => s.clear);
  const clearPending = useSignInPrompt((s) => s.clearPending);
  useEffect(() => {
    void loadBrowsing();
  }, [loadBrowsing]);
  // Once the mode lookup has settled browsing is over, so signing out returns to Welcome.
  const modeSettled =
    auth.status === 'signedIn' && (mode.status === 'ready' || mode.status === 'error');
  useEffect(() => {
    if (modeSettled) clearBrowsing();
  }, [modeSettled, clearBrowsing]);
  // Signing out before it settles (Account is reachable while customer is held). A store listener,
  // so the choice is gone before the render that would put a signed-out person back on customer.
  // Not during a reset: that session never counted as signed in, and abandoning it keeps browsing.
  useEffect(
    () =>
      useAuth.subscribe((now, before) => {
        const wasSignedIn = before.state.status === 'signedIn' && !before.recovery;
        if (wasSignedIn && now.state.status === 'signedOut' && !now.recovery) {
          clearBrowsing();
          // Whoever signs in next is not who asked.
          clearPending();
        }
      }),
    [clearBrowsing, clearPending],
  );
  const route = resolveRoute({
    versionOk: isVersionSupported(APP_VERSION, MIN_SUPPORTED_VERSION),
    auth: auth.status,
    mode,
    chosenMode: chosen,
    recovery,
    browsing,
  });

  const dropPending = shouldDropPending(route, auth.status);
  useEffect(() => {
    if (dropPending) clearPending();
  }, [dropPending, clearPending]);

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
      {/* After (customer): a browsing person opens these on top, keeping the stack beneath. */}
      <Stack.Protected guard={authScreensAllowed(route, auth.status)}>
        <Stack.Screen name="(auth)" />
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
