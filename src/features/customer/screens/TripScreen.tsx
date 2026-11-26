import { ArrowLeft, Check } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import {
  canComplete,
  isBookedService,
  missingServices,
  progressLine,
  serviceInfo,
  tripProgress,
  tripWhen,
  type Trip,
  type TripService,
  type TripServiceType,
} from '@/features/customer/domain/trips/trips';
import { color, radius, space } from '@/shared/theme';
import {
  Banner,
  Button,
  ErrorState,
  Header,
  Icon,
  IconButton,
  ListRow,
  refreshColors,
  Screen,
  SectionHeader,
  Sheet,
  SkeletonRows,
  Text,
  TextLink,
} from '@/shared/ui';

export type TripProblem = { title: string; message: string };

type Props = {
  state:
    | { status: 'loading' }
    | { status: 'error'; notFound: boolean; retry: () => void }
    | { status: 'ready'; trip: Trip; refreshing: boolean; refresh: () => void };
  busy: boolean;
  problem: TripProblem | null;
  onBack: () => void;
  /** "Browse hotels", "Request a car": book this planned service, linked to the trip. */
  onBook: (s: TripService) => void;
  onAdd: (type: TripServiceType) => Promise<boolean>;
  onComplete: () => void;
  onArchive: () => Promise<boolean>;
};

function ServiceRow({ s, onBook }: { s: TripService; onBook: () => void }) {
  const info = serviceInfo(s.type);
  const booked = isBookedService(s.status);
  return (
    <View style={{ gap: space.s3, paddingVertical: space.s4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
        <View style={{ flex: 1, gap: space.s1 }}>
          <Text variant="bodyStrong">{info.label}</Text>
          <Text variant="bodySm" tone="textSecondary">
            {info.caption}
          </Text>
        </View>
        {booked ? (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1 }}
            accessible
            accessibilityLabel={`${info.label}, booked`}
          >
            <Icon as={Check} size="xs" />
            <Text variant="labelSm">Booked</Text>
          </View>
        ) : s.status === 'cancelled' ? (
          <Text variant="labelSm" tone="textSecondary">
            Cancelled
          </Text>
        ) : null}
      </View>
      {booked || s.status === 'cancelled' ? null : (
        <Button
          label={info.cta}
          variant="secondary"
          onPress={onBook}
          testID={`trip-book-${s.type}`}
        />
      )}
    </View>
  );
}

/** One trip (the web's trip page): where, when, what's booked, and what's still to book. */
export function TripScreen({
  state,
  busy,
  problem,
  onBack,
  onBook,
  onAdd,
  onComplete,
  onArchive,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const header = (
    <Header
      title=""
      left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
    />
  );
  if (state.status !== 'ready')
    return (
      <Screen header={header}>
        {state.status === 'loading' ? (
          <SkeletonRows count={5} />
        ) : (
          <ErrorState
            title={state.notFound ? 'This trip isn’t available' : 'We couldn’t load this trip'}
            message={
              state.notFound
                ? 'It may have been archived.'
                : 'Your trip is safe. Check your connection and try again.'
            }
            onRetry={state.notFound ? onBack : state.retry}
            {...(state.notFound ? { retryLabel: 'Back to your trips' } : {})}
          />
        )}
      </Screen>
    );

  const t = state.trip;
  const p = tripProgress(t);
  const missing = missingServices(t);
  const facts = [t.destination, tripWhen(t.startDate, t.endDate)].filter(
    (x): x is string => x !== null,
  );
  const footer = canComplete(t) ? (
    <Button label="Mark complete" loading={busy} onPress={onComplete} testID="trip-complete" />
  ) : undefined;

  return (
    <Screen
      scroll
      header={header}
      footer={footer}
      refreshControl={
        <RefreshControl
          refreshing={state.refreshing}
          onRefresh={state.refresh}
          {...refreshColors}
        />
      }
    >
      <View style={{ gap: space.s6, paddingBottom: space.s8 }}>
        <View style={{ gap: space.s2 }}>
          <Text variant="titleLg" accessibilityRole="header">
            {t.name}
          </Text>
          {facts.length === 0 ? null : (
            <Text variant="body" tone="textSecondary">
              {facts.join(' · ')}
            </Text>
          )}
          <Text variant="label" testID="trip-progress">
            {t.status === 'completed'
              ? 'Complete'
              : p.total > 0 && p.booked === p.total
                ? 'Everything’s booked. You’re ready to go.'
                : progressLine(t)}
          </Text>
        </View>
        {problem === null ? null : (
          <Banner tone="warning" title={problem.title} message={problem.message} />
        )}
        {t.notes === null ? null : (
          <View style={{ backgroundColor: color.wash, borderRadius: radius.r4, padding: space.s5 }}>
            <Text variant="bodySm">{t.notes}</Text>
          </View>
        )}
        <View>
          <SectionHeader label="On this trip" />
          {t.services.length === 0 ? (
            <Text variant="bodySm" tone="textSecondary">
              Nothing added yet.
            </Text>
          ) : (
            t.services.map((s) => (
              <ServiceRow
                key={s.id}
                s={s}
                onBook={() => {
                  onBook(s);
                }}
              />
            ))
          )}
        </View>
        {missing.length === 0 || t.status !== 'planning' ? null : (
          <Button
            label="Add a service"
            variant="secondary"
            loading={busy}
            onPress={() => {
              setAdding(true);
            }}
            testID="trip-add"
          />
        )}
        <View style={{ alignItems: 'flex-start' }}>
          <TextLink
            label="Archive trip"
            onPress={() => {
              setArchiving(true);
            }}
            testID="trip-archive"
          />
        </View>
      </View>

      <Sheet
        visible={adding}
        title="Add a service"
        onClose={() => {
          setAdding(false);
        }}
        testID="trip-add-sheet"
      >
        {missing.map((type) => {
          const info = serviceInfo(type);
          return (
            <ListRow
              key={type}
              title={info.label}
              subtitle={info.caption}
              onPress={() => {
                // Closes at once: the page shows it saving, and says so if it didn't.
                setAdding(false);
                void onAdd(type);
              }}
              testID={`trip-add-${type}`}
            />
          );
        })}
      </Sheet>

      <Sheet
        visible={archiving}
        title="Archive this trip?"
        onClose={() => {
          setArchiving(false);
        }}
        footer={
          <Button
            label="Archive trip"
            loading={busy}
            onPress={() => {
              void onArchive().then((done) => {
                if (done) setArchiving(false);
              });
            }}
            testID="trip-archive-confirm"
          />
        }
      >
        <Text variant="body">
          It leaves your trips. Bookings you made for it aren’t changed or cancelled.
        </Text>
      </Sheet>
    </Screen>
  );
}
