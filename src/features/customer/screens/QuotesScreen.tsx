import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';

import { pendingQuotes } from '@/features/customer/domain/carRental/carStatus';
import type { RfqRow } from '@/features/customer/hooks/rfqKinds';
import { useRfqRequest } from '@/features/customer/hooks/useCarRequests';
import type { QuoteTerms } from '@/features/customer/ui/car/quoteTerms';
import type { CarOffer } from '@/features/customer/schemas/carRental';
import { QuoteCard } from '@/features/customer/ui/car/QuoteCard';
import { RequestLoadError } from '@/features/customer/ui/car/RequestLoadError';
import { space } from '@/shared/theme';
import { EmptyState, Header, IconButton, refreshColors, Screen, SkeletonRows } from '@/shared/ui';

type Props<R extends RfqRow, B> = {
  terms: QuoteTerms<R, B>;
  userId: string;
  id: string;
  onBack: () => void;
  onOpenQuote: (offerId: string) => void;
};

// Design 3A's list (car rental and logistics): lowest first, the vehicle before the company.
export function QuotesScreen<R extends RfqRow, B>({
  terms,
  userId,
  id,
  onBack,
  onOpenQuote,
}: Props<R, B>) {
  const q = useRfqRequest(terms.kind, userId, id);
  const [refreshing, setRefreshing] = useState(false);
  const r = q.request;
  const quotes = r === null ? [] : pendingQuotes(r.offers);
  const span = r === null ? null : terms.spanOf(r);
  const header = (
    <Header
      title={
        r === null ? 'Quotes' : quotes.length === 1 ? '1 quote' : `${String(quotes.length)} quotes`
      }
      subtitle={r === null ? undefined : `${terms.whenOf(r)} · lowest first`}
      left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
    />
  );
  if (r === null) {
    return (
      <Screen header={header}>
        {q.loading ? (
          <SkeletonRows count={3} />
        ) : (
          <RequestLoadError
            error={q.error}
            what="the quotes"
            icon={terms.icon}
            requestsWord={terms.requestsWord}
            onRetry={() => void q.refetch()}
          />
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
            name={terms.nameOf(item, r)}
            span={span}
            vehicleWord={terms.vehicleWord}
            showSeats={terms.showSeats}
            icon={terms.icon}
            {...(terms.factsOf === undefined ? {} : { facts: terms.factsOf(item, r) })}
            photoOptional={terms.photoOptional === true}
            onPress={(o) => {
              onOpenQuote(o.id);
            }}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={terms.icon}
            title="No quotes to choose from"
            message="A quote may have been withdrawn. Pull to refresh."
            action={{ label: 'Back to the request', onPress: onBack }}
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
