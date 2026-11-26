import { ArrowLeft, Map } from 'lucide-react-native';
import { RefreshControl, View } from 'react-native';

import { progressLine, tripWhen, type Trip } from '@/features/customer/domain/trips/trips';
import { space } from '@/shared/theme';
import {
  Button,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  ListRow,
  refreshColors,
  Screen,
  SkeletonRows,
} from '@/shared/ui';

type Props = {
  state:
    | { status: 'loading' }
    | { status: 'error'; retry: () => void }
    | { status: 'ready'; trips: Trip[]; refreshing: boolean; refresh: () => void };
  onBack: () => void;
  onOpen: (id: string) => void;
  onPlan: () => void;
};

const STATUS_WORD: Partial<Record<Trip['status'], string>> = {
  completed: 'Complete',
  active: 'Under way',
};

/** The web's My trips: each open trip, where and when, and how much of it is booked. */
export function TripsScreen({ state, onBack, onOpen, onPlan }: Props) {
  const header = (
    <Header
      title="Your trips"
      left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
    />
  );
  const trips = state.status === 'ready' ? state.trips : [];
  const footer =
    state.status === 'ready' && trips.length > 0 ? (
      <Button label="Plan a trip" onPress={onPlan} testID="trips-plan" />
    ) : undefined;
  return (
    <Screen
      scroll
      header={header}
      footer={footer}
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
      <View style={{ paddingTop: space.s3 }}>
        {state.status === 'loading' ? (
          <SkeletonRows count={3} />
        ) : state.status === 'error' ? (
          <ErrorState
            title="We couldn’t load your trips"
            message="Your trips are safe. Check your connection and try again."
            onRetry={state.retry}
          />
        ) : trips.length === 0 ? (
          <EmptyState
            icon={Map}
            title="Plan your whole trip"
            message="Hotel, car, events, security and more, in one place: see what’s booked and what’s still to do."
            action={{ label: 'Plan a trip', onPress: onPlan }}
            testID="trips-empty"
          />
        ) : (
          trips.map((t) => {
            const facts = [t.destination, tripWhen(t.startDate, t.endDate)].filter(
              (x): x is string => x !== null,
            );
            const status = STATUS_WORD[t.status];
            return (
              <ListRow
                key={t.id}
                title={t.name}
                subtitle={[...facts, status ?? progressLine(t)].join(' · ')}
                onPress={() => {
                  onOpen(t.id);
                }}
                testID={`trip-${t.id}`}
              />
            );
          })
        )}
      </View>
    </Screen>
  );
}
