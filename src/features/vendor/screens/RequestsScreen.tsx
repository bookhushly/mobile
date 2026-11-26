import { Inbox } from 'lucide-react-native';
import { RefreshControl, View } from 'react-native';

import {
  splitRequests,
  type RequestTab,
  type VendorRequest,
} from '@/features/vendor/domain/requests';
import { RequestRow } from '@/features/vendor/ui/RequestRow';
import { space } from '@/shared/theme';
import {
  EmptyState,
  ErrorState,
  refreshColors,
  Screen,
  SegmentedControl,
  SkeletonRows,
  Text,
} from '@/shared/ui';

type Props = {
  nowMs: number;
  tab: RequestTab;
  onTab: (t: RequestTab) => void;
  state:
    | { status: 'loading' }
    | { status: 'error'; retry: () => void }
    | { status: 'ready'; requests: VendorRequest[]; refreshing: boolean; refresh: () => void };
  onOpen: (r: VendorRequest) => void;
};

const EMPTY: Record<RequestTab, { title: string; message: string }> = {
  new: {
    title: 'No new requests',
    message: 'When someone in the states you serve asks for a quote, it shows here.',
  },
  quoted: {
    title: 'No quotes out',
    message: 'Quotes you send wait here until the customer chooses.',
  },
  won: { title: 'Nothing won yet', message: 'When a customer chooses your quote, it shows here.' },
};

/** Requests (design v13): new to quote, quotes you've sent, and the ones you won. */
export function RequestsScreen({ nowMs, tab, onTab, state, onOpen }: Props) {
  const split = state.status === 'ready' ? splitRequests(state.requests, nowMs) : null;
  const list = split?.[tab] ?? [];
  return (
    <Screen
      scroll
      refreshControl={
        state.status === 'ready' ? (
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={state.refresh}
            {...refreshColors}
          />
        ) : undefined
      }
    >
      <View style={{ gap: space.s5, paddingTop: space.s5, paddingBottom: space.s8 }}>
        <Text variant="titleLg" accessibilityRole="header">
          Requests
        </Text>
        <SegmentedControl
          value={tab}
          onChange={onTab}
          testID="vendor-requests-tabs"
          options={[
            { value: 'new', label: 'New', ...(split ? { count: split.new.length } : {}) },
            { value: 'quoted', label: 'Quoted', ...(split ? { count: split.quoted.length } : {}) },
            { value: 'won', label: 'Won', ...(split ? { count: split.won.length } : {}) },
          ]}
        />
        {state.status === 'loading' ? (
          <SkeletonRows count={4} />
        ) : state.status === 'error' ? (
          <ErrorState
            title="We couldn’t load your requests"
            message="Check your connection and try again."
            onRetry={state.retry}
          />
        ) : list.length === 0 ? (
          <EmptyState icon={Inbox} title={EMPTY[tab].title} message={EMPTY[tab].message} />
        ) : (
          <View>
            {list.map((r) => (
              <RequestRow
                key={r.id}
                request={r}
                nowMs={nowMs}
                onPress={() => {
                  onOpen(r);
                }}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}
