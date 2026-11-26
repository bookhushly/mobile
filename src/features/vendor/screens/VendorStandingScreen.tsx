import { Clock, Globe, ShieldAlert, Store, XCircle, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { VendorState } from '@/features/vendor/hooks/useVendor';
import { space } from '@/shared/theme';
import { Button, ErrorState, Icon, Screen, SkeletonRows, Text } from '@/shared/ui';

type Props = {
  /** Every state but a ready vendor whose business the app serves. */
  state: VendorState;
  onOpenWeb: () => void;
  /** Suspended vendors are told to contact support: that's their primary action. */
  onEmailSupport?: () => void;
  onSignOut: () => void;
  /** Switch to booking as a customer, when the account has other modes. */
  modeSwitcher?: ReactNode;
};

type Copy = { icon: LucideIcon; title: string; message: string };

function copyFor(state: VendorState): Copy | null {
  if (state.status !== 'ready' && state.status !== 'none') return null;
  if (state.status === 'none')
    return {
      icon: Store,
      title: 'Finish setting up your business',
      message:
        'Your business details aren’t on Bookhushly yet. Add them on bookhushly.com and they’ll show here.',
    };
  const v = state.vendor;
  switch (v.standing.kind) {
    case 'waiting':
      return {
        icon: Clock,
        title: 'Your business is being reviewed',
        message: `We’re checking ${v.name}’s details. You’ll get an email when it’s approved, then requests and bookings show here.`,
      };
    case 'rejected':
      return {
        icon: XCircle,
        title: 'Your application wasn’t approved',
        message:
          v.standing.reason === null
            ? 'Open bookhushly.com to see what to change and apply again.'
            : `${v.standing.reason} Open bookhushly.com to change it and apply again.`,
      };
    case 'suspended':
      return {
        icon: ShieldAlert,
        title: `${v.name} is suspended`,
        message:
          'You can’t take new requests or bookings for now. Contact Bookhushly support to find out why and what to do next.',
      };
    case 'ready':
      // A ready vendor reaches this screen only when the app doesn't serve their kind of business.
      return {
        icon: Globe,
        title: 'Use bookhushly.com for your business',
        message:
          'The app doesn’t run this kind of business yet. Everything is on the web dashboard.',
      };
  }
}

/** What a vendor sees when their business can't open in the app: always a reason and a next step. */
export function VendorStandingScreen({
  state,
  onOpenWeb,
  onEmailSupport,
  onSignOut,
  modeSwitcher,
}: Props) {
  if (state.status === 'loading')
    return (
      <Screen>
        <SkeletonRows count={4} />
      </Screen>
    );
  if (state.status === 'error')
    return (
      <Screen footer={<Button label="Sign out" variant="secondary" onPress={onSignOut} />}>
        <ErrorState
          title="We couldn’t load your business"
          message="Check your connection and try again."
          onRetry={state.retry}
        />
      </Screen>
    );
  const copy = copyFor(state);
  if (copy === null) return null;
  const suspended = state.status === 'ready' && state.vendor.standing.kind === 'suspended';
  return (
    <Screen
      scroll
      footer={
        <>
          {suspended && onEmailSupport !== undefined ? (
            <Button label="Email support" onPress={onEmailSupport} testID="vendor-email-support" />
          ) : (
            <Button label="Open bookhushly.com" onPress={onOpenWeb} testID="vendor-open-web" />
          )}
          <Button label="Sign out" variant="secondary" onPress={onSignOut} />
        </>
      }
    >
      <View style={{ gap: space.s4, paddingTop: space.s8, paddingBottom: space.s6 }}>
        <Icon as={copy.icon} size="lg" />
        <Text variant="headline" accessibilityRole="header">
          {copy.title}
        </Text>
        <Text variant="body" tone="textSecondary">
          {copy.message}
        </Text>
      </View>
      {modeSwitcher}
    </Screen>
  );
}
