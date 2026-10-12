import { Building2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { HotelState } from '@/features/receptionist/hooks/useHotel';
import { space } from '@/shared/theme';
import {
  Button,
  EmptyState,
  ErrorState,
  Header,
  ListRow,
  Screen,
  Spinner,
  Text,
} from '@/shared/ui';

type Props = {
  state: HotelState;
  onSignOut: () => void;
  /** The route passes <ModeSwitcher/> (renders nothing for a one-mode user): staff with no usable
   * hotel can still reach their other mode. Desk code must not import the mode feature. */
  modeSwitcher: ReactNode;
};

// R7/R8: what stands between sign-in and the desk until exactly one hotel is in hand.
export function HotelGateScreen({ state, onSignOut, modeSwitcher }: Props) {
  const signOut = <Button variant="secondary" label="Sign out" onPress={onSignOut} />;
  switch (state.status) {
    case 'loading':
      return (
        <Screen>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s3 }}>
            <Spinner tone="textSecondary" label="Loading" />
            <Text variant="bodySm" tone="textSecondary" accessibilityLiveRegion="polite">
              Loading your hotel…
            </Text>
          </View>
        </Screen>
      );
    case 'error':
      return (
        <Screen scroll footer={signOut}>
          <ErrorState
            title="Couldn't load your hotel"
            message="Check your connection and try again."
            onRetry={state.retry}
          />
          {modeSwitcher}
        </Screen>
      );
    case 'none':
      return (
        <Screen scroll footer={signOut}>
          <EmptyState
            icon={Building2}
            title="No hotel assigned"
            message="Ask the hotel owner to add you as front desk staff."
          />
          {modeSwitcher}
        </Screen>
      );
    case 'unavailable':
      return (
        <Screen scroll footer={signOut}>
          <EmptyState
            icon={Building2}
            title="This hotel isn't available right now"
            message="Contact the hotel owner."
          />
          {modeSwitcher}
        </Screen>
      );
    case 'pick':
      return (
        <Screen scroll header={<Header title="Choose a hotel" />} footer={signOut}>
          <View>
            {state.hotels.map((h) => (
              <ListRow
                key={h.id}
                title={h.name}
                subtitle={h.place === '' ? undefined : h.place}
                onPress={() => {
                  state.choose(h.id);
                }}
              />
            ))}
          </View>
          {modeSwitcher}
        </Screen>
      );
    case 'ready':
      // The layout renders the desk instead; nothing to gate.
      return null;
  }
}
