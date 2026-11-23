import { ArrowLeft, CarFront } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';

import { tripDays } from '@/features/customer/domain/carRental/carRequest';
import { pendingQuotes } from '@/features/customer/domain/carRental/carStatus';
import { useCarRequest } from '@/features/customer/hooks/useCarRequests';
import type { CarOffer } from '@/features/customer/schemas/carRental';
import { QuoteCard } from '@/features/customer/ui/car/QuoteCard';
import { RequestLoadError } from '@/features/customer/ui/car/RequestLoadError';
import { dateRange } from '@/features/customer/ui/car/carWords';
import { space } from '@/shared/theme';
import { EmptyState, Header, IconButton, refreshColors, Screen, SkeletonRows } from '@/shared/ui';

type Props = {
  userId: string;
  id: string;
  onBack: () => void;
  onOpenQuote: (offerId: string) => void;
};

// Design 3A's list: lowest first, the car before the company.
export function CarQuotesScreen({ userId, id, onBack, onOpenQuote }: Props) {
  const q = useCarRequest(userId, id);
  const [refreshing, setRefreshing] = useState(false);
  const r = q.request;
  const quotes = r === null ? [] : pendingQuotes(r.offers);
  const days = r === null ? 0 : tripDays({ pickupDate: r.pickupDate, returnDate: r.returnDate });
  const header = (
    <Header
      title={
        r === null ? 'Quotes' : quotes.length === 1 ? '1 quote' : `${String(quotes.length)} quotes`
      }
      subtitle={r === null ? undefined : `${dateRange(r.pickupDate, r.returnDate)} · lowest first`}
      left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
    />
  );
  if (r === null) {
    return (
      <Screen header={header}>
        {q.loading ? (
          <SkeletonRows count={3} />
        ) : (
          <RequestLoadError error={q.error} what="the quotes" onRetry={() => void q.refetch()} />
        )}
      </Screen>
    );
  }
  return (
    <Screen header={header}>
      <FlatList
        data={quotes}
        keyExtractor={(o: CarOffer) => o.id}
        initialNumToRender={3}
        windowSize={5}
        contentContainerStyle={{ gap: space.s5, paddingVertical: space.s5 }}
        renderItem={({ item }) => (
          <QuoteCard
            offer={item}
            askedType={r.vehicleType}
            days={days}
            onPress={(o) => {
              onOpenQuote(o.id);
            }}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={CarFront}
            title="No quotes to choose from"
            message="A quote may have been withdrawn. Pull to refresh."
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void q.refetch().finally(() => {
                setRefreshing(false);
              });
            }}
            {...refreshColors}
          />
        }
      />
    </Screen>
  );
}
