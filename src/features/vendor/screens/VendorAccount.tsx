import { Alert, Linking } from 'react-native';

import { accountLinks } from '@/features/vendor/domain/accountLinks';
import { useVendorSession } from '@/features/vendor/hooks/VendorContext';
import { AccountScreen } from '@/features/vendor/screens/AccountScreen';
import { KIND_WORD } from '@/features/vendor/ui/kindWords';

const SUPPORT = 'support@bookhushly.com';

export function VendorAccount() {
  const { vendor, email, openWeb, switchToBooking, signOut } = useVendorSession();
  return (
    <AccountScreen
      businessName={vendor.name}
      kindWord={KIND_WORD[vendor.kind]}
      email={email}
      links={accountLinks(vendor.kind)}
      onOpenLink={(l) => {
        openWeb(l.path);
      }}
      onEmailSupport={() => {
        const subject = encodeURIComponent(vendor.name);
        Linking.openURL(`mailto:${SUPPORT}?subject=${subject}`).catch(() => {
          // No mail app (common on iPads): say where to write instead of doing nothing.
          Alert.alert('Email support', `Write to ${SUPPORT}.`);
        });
      }}
      onSwitchToBooking={switchToBooking}
      onSignOut={signOut}
    />
  );
}
