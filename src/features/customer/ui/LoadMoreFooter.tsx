import { View } from 'react-native';

import { loadFailedLine } from '@/features/customer/ui/discoverLabels';
import type { ApiError } from '@/shared/lib/errors';
import { space } from '@/shared/theme';
import { Button, Spinner, Text } from '@/shared/ui';

type Props = {
  loadingMore: boolean;
  /** Offer "Load more" (a failed page, or pages that held nothing yet). */
  offer: boolean;
  error: ApiError | null;
  /** Inside a 429's Retry-After: the button waits. */
  waiting: boolean;
  /** Nothing shown so far, but the list goes on. */
  nothingYet: boolean;
  onLoadMore: () => void;
};

export const BUSY = 'Lots of searches right now. Try again in a moment.';

function reason(error: ApiError | null, nothingYet: boolean): string | null {
  if (error !== null) return error.kind === 'rateLimited' ? BUSY : loadFailedLine(error, 'more');
  return nothingYet ? 'Nothing here yet — load more to keep looking.' : null;
}

// D16: a failure keeps what is shown; the customer asks again (no automatic retry loop).
export function LoadMoreFooter({
  loadingMore,
  offer,
  error,
  waiting,
  nothingYet,
  onLoadMore,
}: Props) {
  if (loadingMore)
    return (
      <View style={{ paddingVertical: space.s5 }}>
        <Spinner label="Loading more" />
      </View>
    );
  if (!offer) return null;
  const line = reason(error, nothingYet);
  return (
    <View style={{ paddingVertical: space.s5, gap: space.s3 }} testID="load-more">
      {line !== null ? (
        <Text variant="bodySm" tone="textSecondary" align="center">
          {line}
        </Text>
      ) : null}
      <Button variant="secondary" label="Load more" disabled={waiting} onPress={onLoadMore} />
    </View>
  );
}
