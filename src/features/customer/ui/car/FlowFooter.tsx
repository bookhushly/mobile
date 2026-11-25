import type { ReactNode } from 'react';
import { View } from 'react-native';

import { space } from '@/shared/theme';
import { Banner, Button } from '@/shared/ui';

type Props = {
  /** Step content kept just above the button (the When step's time chips). */
  above?: ReactNode;
  /** Signed in, but the name and phone haven't loaded. */
  detailsUnknown: boolean;
  profileLoading: boolean;
  onRetryProfile: () => void;
  problem: { words: string; refused: boolean } | null;
  label: string;
  disabled: boolean;
  loading: boolean;
  onPress: () => void;
  testID: string;
};

/** A request flow's footer: what's in the way (if anything), then one full-width button. */
export function FlowFooter({
  above,
  detailsUnknown,
  profileLoading,
  onRetryProfile,
  problem,
  label,
  disabled,
  loading,
  onPress,
  testID,
}: Props) {
  return (
    <View style={{ gap: space.s4 }}>
      {above}
      {detailsUnknown ? (
        <Banner
          tone="neutral"
          message={
            profileLoading
              ? 'Getting your details…'
              : 'Couldn’t load your details. Check your connection and try again.'
          }
          {...(profileLoading ? {} : { action: { label: 'Try again', onPress: onRetryProfile } })}
          testID="car-details-unknown"
        />
      ) : null}
      {problem === null ? null : (
        <Banner tone={problem.refused ? 'danger' : 'neutral'} message={problem.words} />
      )}
      <Button
        label={label}
        disabled={disabled || detailsUnknown}
        loading={loading}
        onPress={onPress}
        testID={testID}
      />
    </View>
  );
}
