import { Stack } from 'expo-router';
import { Linking } from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { useModeSwitcher } from '@/features/mode/hooks/useModeSwitcher';
import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';
import { servedKind } from '@/features/vendor/domain/vendorProfile';
import { VendorProvider } from '@/features/vendor/hooks/VendorContext';
import { useVendor } from '@/features/vendor/hooks/useVendor';
import { VendorStandingScreen } from '@/features/vendor/screens/VendorStandingScreen';
import { WEB_URL } from '@/shared/config/store';

export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

export const unstable_settings = { initialRouteName: 'vendor/(tabs)' };

const openWeb = (path?: string) => {
  void Linking.openURL(path === undefined ? WEB_URL : `${WEB_URL.replace(/\/+$/, '')}${path}`);
};

// Vendor mode (DECISION-11): the business opens only when it's approved, not suspended, and a kind
// the app serves; otherwise the standing screen says why and where to go.
export default function VendorLayout() {
  const state = useAuth((s) => s.state);
  const signOut = useSignOut();
  const userId = state.status === 'signedIn' ? state.userId : '';
  const email = state.status === 'signedIn' ? state.email : '';
  const { modes, choose } = useModeSwitcher(userId === '' ? null : userId);
  const vendorState = useVendor(userId);
  const modeSwitcher = <ModeSwitcher modes={modes} current="vendor" onChoose={choose} />;

  const kind = vendorState.status === 'ready' ? servedKind(vendorState.vendor.kind) : null;
  if (
    vendorState.status !== 'ready' ||
    vendorState.vendor.standing.kind !== 'ready' ||
    kind === null
  ) {
    return (
      <VendorStandingScreen
        state={vendorState}
        onOpenWeb={() => {
          openWeb();
        }}
        onEmailSupport={() => {
          void Linking.openURL('mailto:support@bookhushly.com').catch(() => undefined);
        }}
        onSignOut={signOut}
        modeSwitcher={modeSwitcher}
      />
    );
  }
  const v = vendorState.vendor;
  return (
    <VendorProvider
      value={{
        userId,
        email,
        vendor: { ...v, kind },
        openWeb,
        switchToBooking: modes.includes('customer')
          ? () => {
              choose('customer');
            }
          : null,
        switchToGate: modes.includes('gate')
          ? () => {
              choose('gate');
            }
          : null,
        switchToDesk: modes.includes('receptionist')
          ? () => {
              choose('receptionist');
            }
          : null,
        signOut,
      }}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </VendorProvider>
  );
}
