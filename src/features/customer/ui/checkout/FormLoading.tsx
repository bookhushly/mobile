import type { ReactNode } from 'react';

import { ErrorState, Screen, SkeletonRows } from '@/shared/ui';

type Props = { header: ReactNode; failed: boolean; title: string; onRetry: () => void };

// The form waits for what it can't guess (extras, questions): skipping them would send a booking
// the server refuses or prices differently.
export function FormLoading({ header, failed, title, onRetry }: Props) {
  return (
    <Screen header={header}>
      {failed ? (
        <ErrorState
          title={title}
          message="Nothing was booked. Check your connection and try again."
          onRetry={onRetry}
        />
      ) : (
        <SkeletonRows count={4} />
      )}
    </Screen>
  );
}
