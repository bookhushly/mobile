import { Ticket } from 'lucide-react-native';
import { RefreshControl, View } from 'react-native';

import { ticketsLine, type VendorEvent } from '@/features/vendor/domain/listings';
import { lagosTime, lagosToday, shortDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import {
  EmptyState,
  ErrorState,
  ListRow,
  refreshColors,
  Screen,
  SkeletonRows,
  Text,
} from '@/shared/ui';

type Props = {
  nowMs: number;
  state:
    | { status: 'loading' }
    | { status: 'error'; retry: () => void }
    | { status: 'ready'; events: VendorEvent[]; refreshing: boolean; refresh: () => void };
  onManage: () => void;
};

/** Your events: coming up first (soonest first), then past ones. Editing stays on the web. */
export function EventsScreen({ nowMs, state, onManage }: Props) {
  const events = state.status === 'ready' ? state.events : [];
  const upcoming = events
    .filter((e) => Date.parse(e.startsAt) > nowMs)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const past = events
    .filter((e) => Date.parse(e.startsAt) <= nowMs)
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  const row = (e: VendorEvent) => (
    <ListRow
      key={e.id}
      title={e.title}
      subtitle={`${shortDate(lagosToday(Date.parse(e.startsAt)))}, ${lagosTime(e.startsAt)} · ${ticketsLine(e)}`}
      onPress={onManage}
      accessibilityLabel={`${e.title}, ${ticketsLine(e)}. Manage on bookhushly.com`}
    />
  );
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
          Events
        </Text>
        {state.status === 'loading' ? (
          <SkeletonRows count={4} />
        ) : state.status === 'error' ? (
          <ErrorState
            title="We couldn’t load your events"
            message="Check your connection and try again."
            onRetry={state.retry}
          />
        ) : events.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="No events yet"
            message="Create events and tickets on bookhushly.com."
            action={{ label: 'Open bookhushly.com', onPress: onManage }}
          />
        ) : (
          <>
            {upcoming.length === 0 ? null : (
              <View>
                <Text variant="labelSm" tone="textSecondary" accessibilityRole="header">
                  Coming up
                </Text>
                {upcoming.map(row)}
              </View>
            )}
            {past.length === 0 ? null : (
              <View>
                <Text variant="labelSm" tone="textSecondary" accessibilityRole="header">
                  Past
                </Text>
                {past.map(row)}
              </View>
            )}
            <Text variant="caption" tone="textSecondary">
              Create and edit events and tickets on bookhushly.com.
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}
