// First, so sample-data mode (dev only) is in place before anything fetches.
import '@/shared/dev/sample/boot';
import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { startSessionListener } from '@/features/auth/api/session';
import { BrandIntro } from '@/features/auth/components/BrandIntro';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { launchLandedOnAuth, noteLaunchRoute } from '@/features/auth/launchIntro';
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
import { hideSplashOnce } from '@/shared/platform/splash';
import { AppProviders } from '@/shared/providers/AppProviders';

export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

// When a guard change leaves no allowed screen in the stack (signing in hides (auth) before the
// mode has loaded), the stack falls back to the FIRST DECLARED screen: `unstable_settings` only
// orders the undeclared routes (after the declared ones) and never reaches the navigator as its
// `initialRouteName` (expo-router 57, StackRouter.getStateForRouteNamesChange). So `index` (Loading,
// then the redirect) is declared first below; otherwise the fallback was the unguarded
// delete-account modal (owner's report, 2026-11-15). Kept for deep links' initial route.
export const unstable_settings = { initialRouteName: 'index' };

initMonitoring(APP_VERSION);
void SplashScreen.preventAutoHideAsync();

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
  // Before the children render, so the opening screen knows on its first frame.
  noteLaunchRoute(route);

  const dropPending = shouldDropPending(route, auth.status);
  useEffect(() => {
    if (dropPending) clearPending();
  }, [dropPending, clearPending]);

  const setRoute = useRouteStore((s) => s.setRoute);
  useEffect(() => {
    setRoute(route);
    // A launch landing on Welcome hands the splash to the opening screen, which hides it once its
    // identical first frame is drawn (no flash of the loading view between them). Stable for the
    // launch: the intro has already claimed its turn by the time this effect runs (code review,
    // 2026-11-17), so "is it still pending" was always false here.
    if (route !== 'loading' && !launchLandedOnAuth()) hideSplashOnce();
  }, [route, setRoute]);
  // A slow session/mode lookup must not pin the splash: after 2 s show the in-app loading screen.
  useEffect(() => {
    const t = setTimeout(hideSplashOnce, 2000);
    return () => {
      clearTimeout(t);
    };
  }, []);

  // A launch that opens on Welcome never animates between root screens: the intro is the motion.
  // Read with `route` so the React Compiler recomputes it when the route settles; on its own it
  // takes no reactive input and was cached from the first, still-loading render (code review).
  const quiet = route === 'auth' || launchLandedOnAuth();
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          ...(quiet ? { animation: 'none' as const } : {}),
        }}
      >
        {/* First: the fallback whenever a guard change leaves nothing else allowed (see above). */}
        <Stack.Screen name="index" />
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
        <Stack.Protected guard={route === 'vendor'}>
          <Stack.Screen name="(vendor)" />
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
      {/* Above the navigator, not inside (auth): on screen from the frame the route settles, so the
        redirect and the push to Welcome happen hidden beneath it instead of eating its hold
        (inside (auth) it slid in with the push, after a grey frame; recorded 2026-11-15). Mounted
        only once the route settles: it decides on mount whether this launch gets it. */}
      {route === 'loading' ? null : <BrandIntro />}
    </>
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
