import { ArrowLeft, BadgeCheck } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { pendingQuotes, perDay } from '@/features/customer/domain/carRental/carStatus';
import type { RfqRow } from '@/features/customer/hooks/rfqKinds';
import { useRfqActions } from '@/features/customer/hooks/useCarActions';
import { useServiceCharge } from '@/features/customer/hooks/useCheckoutData';
import { chargeEstimate } from '@/features/customer/domain/checkout/reviewText';
import { usePayOnOpen } from '@/features/customer/hooks/useCarPayment';
import { useRfqRequest } from '@/features/customer/hooks/useCarRequests';
import type { QuoteTerms } from '@/features/customer/ui/car/quoteTerms';
import { RatingLine } from '@/features/customer/ui/RatingLine';
import { initials } from '@/features/customer/ui/initials';
import { QuotePhotos } from '@/features/customer/ui/car/QuotePhotos';
import { RequestLoadError } from '@/features/customer/ui/car/RequestLoadError';
import { CAR_TRY_AGAIN, carRefusedWords } from '@/features/customer/ui/car/carActionWords';
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

type Props<R extends RfqRow, B> = {
  terms: QuoteTerms<R, B>;
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
export function QuoteScreen<R extends RfqRow, B>({
  terms,
  userId,
  id,
  offerId,
  onBack,
  onChosen,
}: Props<R, B>) {
  const q = useRfqRequest(terms.kind, userId, id);
  const actions = useRfqActions(terms.kind, userId, id);
  const charge = useServiceCharge(terms.kind.requestType);
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

  const name = terms.nameOf(o, r);
  const span = terms.spanOf(r);
  const daily = span === null ? null : perDay(o.amount, span.days);
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

  // A service charge is added at payment (web `calculateServiceCharge`): said here, not hidden.
  const est = charge.data === undefined ? null : chargeEstimate(o.amount, charge.data);
  const breakdown = [
    span === null
      ? 'Total for the job'
      : daily === null
        ? span.words
        : `${span.words} · ${formatNaira(daily)} a day`,
    est === null ? null : `+ ${formatNaira(est.amount)} ${est.label.toLowerCase()}`,
  ]
    .filter((x): x is string => x !== null)
    .join(' · ');
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
        <QuotePhotos photos={photos} label={name} icon={terms.icon} />
        <View style={{ gap: space.s2 }}>
          <Text variant="titleLg" accessibilityRole="header">
            {name}
          </Text>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s3 }}
          >
            {!terms.showSeats || o.vehicle?.seats == null ? null : (
              <Text variant="body" tone="textSecondary">{`${String(o.vehicle.seats)} seats`}</Text>
            )}
            {o.vehicle?.verified === true ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1 }}>
                <Icon as={BadgeCheck} size="md" />
                <Text variant="body">{`Verified ${terms.vehicleWord}`}</Text>
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
            <Person name={vendor} line={terms.companyWord} />
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
            {`${others === 0 ? '' : others === 1 ? 'The other quote will be declined. ' : `The other ${String(others)} quotes will be declined. `}Next you pay; your money is held until you confirm ${terms.doneWords}.`}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.s3 }}>
            <Text variant="body" style={{ flex: 1 }}>
              {span === null ? name : `${name} · ${span.words}`}
            </Text>
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
