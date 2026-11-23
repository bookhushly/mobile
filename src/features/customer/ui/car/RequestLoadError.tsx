import { CarFront } from 'lucide-react-native';

import type { ApiError } from '@/shared/lib/errors';
import { EmptyState, ErrorState } from '@/shared/ui';

type Props = {
  error: ApiError | null;
  /** "this request", "the quotes", "this quote". */
  what: string;
  onRetry: () => void;
};

// Why a car rental screen has nothing to show. Signed out, gone or not yours are answers; anything
// else (network, 429, 5xx) is "try again", never a refusal.
export function RequestLoadError({ error, what, onRetry }: Props) {
  if (error?.kind === 'auth') {
    return (
      <EmptyState
        icon={CarFront}
        title="Sign in to see this request"
        message="Car rental requests are kept on your account."
      />
    );
  }
  if (error?.kind === 'notFound' || error?.kind === 'forbidden') {
    return (
      <EmptyState
        icon={CarFront}
        title="This request wasn’t found"
        message="It may have been removed, or it’s on another account."
      />
    );
  }
  return (
    <ErrorState
      title={`Couldn’t load ${what}`}
      message="Check your connection and try again. Nothing has changed with your request."
      onRetry={onRetry}
    />
  );
}
