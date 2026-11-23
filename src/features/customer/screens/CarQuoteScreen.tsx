import { ArrowLeft, BadgeCheck } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { tripDays } from '@/features/customer/domain/carRental/carRequest';
import { pendingQuotes, perDay } from '@/features/customer/domain/carRental/carStatus';
import { useCarActions } from '@/features/customer/hooks/useCarActions';
import { usePayOnOpen } from '@/features/customer/hooks/useCarPayment';
import { useCarRequest } from '@/features/customer/hooks/useCarRequests';
import { RatingLine } from '@/features/customer/ui/RatingLine';
import { initials } from '@/features/customer/ui/initials';
import { QuotePhotos } from '@/features/customer/ui/car/QuotePhotos';
import { RequestLoadError } from '@/features/customer/ui/car/RequestLoadError';
import { CAR_TRY_AGAIN, carRefusedWords } from '@/features/customer/ui/car/carActionWords';
import { carName, daysWords } from '@/features/customer/ui/car/carWords';
import { formatNaira } from '@/shared/lib/formatNaira';
import { borderWidth, color, radius, space } from '@/shared/theme';
import {
  Banner,
  Button,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Screen,
  Sheet,
  SkeletonRows,
  Text,
} from '@/shared/ui';

type Props = {
  userId: string;
  id: string;
  offerId: string;
  onBack: () => void;
  /** Chosen: on to the request, which opens the checkout. */
  onChosen: () => void;
};

const AVATAR = 44;

function Person({ name, line }: { name: string; line: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}>
      <View
        style={{
          width: AVATAR,
          height: AVATAR,
          borderRadius: radius.rFull,
          backgroundColor: color.wash,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        importantForAccessibility="no-hide-descendants"
      >
        <Text variant="label">{initials(name, '')}</Text>
      </View>
      <View style={{ flex: 1, gap: space.s1 }}>
        <Text variant="bodyStrong">{name}</Text>
        <Text variant="bodySm" tone="textSecondary">
          {line}
        </Text>
      </View>
    </View>
  );
}

// Design 3A's full quote: the car, the company, the driver, their note, then a two-line footer
// (the total with its breakdown, then one full-width button).
export function CarQuoteScreen({ userId, id, offerId, onBack, onChosen }: Props) {
  const q = useCarRequest(userId, id);
  const actions = useCarActions(userId, id);
  const askPayOnOpen = usePayOnOpen((s) => s.ask);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<{ words: string; refused: boolean } | null>(null);
  const r = q.request;
  const o = r?.offers.find((x) => x.id === offerId) ?? null;
  const back = <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />;

  if (r === null || o === null) {
    return (
      <Screen header={<Header title="Quote" left={back} />}>
        {q.loading ? (
          <SkeletonRows count={4} />
        ) : r !== null ? (
          <ErrorState
            title="This quote isn’t available any more"
            message="Go back to see the others."
          />
        ) : (
          <RequestLoadError error={q.error} what="this quote" onRetry={() => void q.refetch()} />
        )}
      </Screen>
    );
  }

  const name = carName(o.vehicle, r.vehicleType);
  const days = tripDays({ pickupDate: r.pickupDate, returnDate: r.returnDate });
  const daily = perDay(o.amount, days);
  const others = pendingQuotes(r.offers).filter((x) => x.id !== o.id).length;
  const open = r.status === 'open' && o.status === 'pending';
  const vendor = o.vendor?.name ?? 'This company';
  // The company's own photos only (none: a grey block with a car, never a stock photo).
  const photos = [...(o.vehicle?.imageUrls ?? []), ...o.imageUrls];

  const choose = async () => {
    setProblem(null);
    const out = await actions.select(o.id);
    switch (out.kind) {
      case 'ok':
        setConfirming(false);
        askPayOnOpen(id);
        onChosen();
        return;
      case 'tryAgain':
        setProblem({ words: CAR_TRY_AGAIN, refused: false });
        return;
      case 'signIn':
        setProblem({ words: 'Sign in again to choose this quote.', refused: true });
        return;
      case 'refused':
        setProblem({ words: carRefusedWords(out.code), refused: true });
        return;
    }
  };

  const breakdown =
    daily === null ? daysWords(days) : `${daysWords(days)} · ${formatNaira(daily)} a day`;
  return (
    <Screen
      scroll
      header={<Header title="Quote" left={back} />}
      footer={
        open ? (
          <View style={{ gap: space.s4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s3 }}>
              <Text variant="title" tabular>
                {formatNaira(o.amount)}
              </Text>
              <Text variant="bodySm" tone="textSecondary" style={{ flex: 1 }}>
                {breakdown}
              </Text>
            </View>
            <Button
              label="Choose this quote"
              onPress={() => {
                setProblem(null);
                setConfirming(true);
              }}
              testID="car-choose"
            />
          </View>
        ) : undefined
      }
    >
      <View style={{ gap: space.s6, paddingTop: space.s4, paddingBottom: space.s7 }}>
        <QuotePhotos photos={photos} label={name} />
        <View style={{ gap: space.s2 }}>
          <Text variant="titleLg" accessibilityRole="header">
            {name}
          </Text>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s3 }}
          >
            {o.vehicle?.seats == null ? null : (
              <Text variant="body" tone="textSecondary">{`${String(o.vehicle.seats)} seats`}</Text>
            )}
            {o.vehicle?.verified === true ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1 }}>
                <Icon as={BadgeCheck} size="md" />
                <Text variant="body">Verified car</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View
          style={{
            gap: space.s5,
            paddingTop: space.s5,
            borderTopWidth: borderWidth.hairline,
            borderTopColor: color.border,
          }}
        >
          <View style={{ gap: space.s2 }}>
            <Person name={vendor} line="Car rental company" />
            <RatingLine avg={o.vendor?.rating ?? null} count={o.vendor?.reviewCount ?? null} />
          </View>
          {o.driver?.name ? (
            <Person
              name={`Driver: ${o.driver.name}`}
              line={[
                o.driver.years === null ? null : `${String(o.driver.years)} years driving`,
                o.driver.verified ? 'Verified driver' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ) : null}
        </View>
        {o.message === null ? null : <Text variant="body">{`“${o.message}”`}</Text>}
        {open ? null : <Banner tone="neutral" message="This quote can’t be chosen any more." />}
      </View>
      <Sheet
        visible={confirming}
        title={`Choose ${vendor}’s quote?`}
        onClose={() => {
          setConfirming(false);
        }}
        closeDisabled={actions.busy === 'select'}
        scroll
        testID="car-choose-sheet"
        footer={
          <View style={{ gap: space.s3 }}>
            <Button
              label="Choose and pay"
              loading={actions.busy === 'select'}
              disabled={actions.busy === 'select'}
              onPress={() => void choose()}
              testID="car-choose-confirm"
            />
            <Button
              label="Keep looking"
              variant="ghost"
              disabled={actions.busy === 'select'}
              onPress={() => {
                setConfirming(false);
              }}
            />
          </View>
        }
      >
        <View style={{ gap: space.s5 }}>
          <Text variant="body">
            {`${others === 0 ? '' : others === 1 ? 'The other quote will be declined. ' : `The other ${String(others)} quotes will be declined. `}Next you pay; your money is held until you confirm the trip’s done.`}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.s3 }}>
            <Text variant="body" style={{ flex: 1 }}>{`${name} · ${daysWords(days)}`}</Text>
            <Text variant="bodyStrong" tabular>
              {formatNaira(o.amount)}
            </Text>
          </View>
          <Text variant="bodySm" tone="textSecondary">
            The payment page shows the final amount, with any service charge, before you pay.
          </Text>
          {problem === null ? null : (
            <Banner tone={problem.refused ? 'danger' : 'neutral'} message={problem.words} />
          )}
        </View>
      </Sheet>
    </Screen>
  );
}
