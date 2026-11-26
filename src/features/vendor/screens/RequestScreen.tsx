import { ArrowLeft, Clock, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { offerLine, type RequestDetail } from '@/features/vendor/domain/requests';
import { timeLeft } from '@/features/vendor/domain/today';
import type { QuoteProblem } from '@/features/vendor/hooks/useVendorRequests';
import { RequestDetails } from '@/features/vendor/ui/RequestDetails';
import { Route } from '@/features/vendor/ui/Route';
import { WithdrawQuoteSheet } from '@/features/vendor/ui/WithdrawQuoteSheet';
import { ServicePhoto } from '@/features/vendor/ui/ServicePhoto';

import { radius, space, vendorSize } from '@/shared/theme';
import {
  Button,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Screen,
  SkeletonRows,
  Text,
} from '@/shared/ui';

const quotesWord = (n: number) =>
  n === 0 ? 'No quotes yet' : `${String(n)} ${n === 1 ? 'quote' : 'quotes'} so far`;

type Props = {
  nowMs: number;
  state:
    | { status: 'loading' }
    | { status: 'error'; notFound: boolean; retry: () => void }
    | { status: 'ready'; request: RequestDetail };
  onBack: () => void;
  onQuote: () => void;
  onOpenJobs: () => void;
  withdraw: {
    busy: boolean;
    problem: QuoteProblem | null;
    run: () => Promise<boolean>;
  };
};

/** One request in full (design v13): what was asked, never who asked until they pay. */
export function RequestScreen({ nowMs, state, onBack, onQuote, onOpenJobs, withdraw }: Props) {
  const [confirming, setConfirming] = useState(false);
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
            title={
              state.notFound ? 'This request isn’t available' : 'We couldn’t load this request'
            }
            message={
              state.notFound
                ? 'It may have closed, or it’s outside the states you serve.'
                : 'Check your connection and try again.'
            }
            onRetry={state.notFound ? onBack : state.retry}
          />
        )}
      </Screen>
    );

  const r = state.request;
  const open = Date.parse(r.closesAt) > nowMs;
  const offer = r.myOffer;
  const quotable = open && (offer === null || offer.status === 'withdrawn');

  let footer;
  if (quotable) {
    footer = (
      <View style={{ gap: space.s3 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.s2 }}>
          <Icon as={Lock} size="xs" tone="textSecondary" />
          <Text variant="caption" tone="textSecondary">
            Their name and phone show once they pay
          </Text>
        </View>
        <Button label="Send a quote" onPress={onQuote} testID="vendor-send-quote" />
      </View>
    );
  } else if (offer?.status === 'pending') {
    footer = (
      <View style={{ gap: space.s3 }}>
        <Text variant="label" align="center" tabular>
          {offerLine(offer)}
        </Text>
        <Button
          label="Withdraw quote"
          variant="secondary"
          loading={withdraw.busy}
          onPress={() => {
            setConfirming(true);
          }}
          testID="vendor-withdraw"
        />
      </View>
    );
  } else if (offer?.status === 'accepted') {
    footer = (
      <View style={{ gap: space.s3 }}>
        <Text variant="label" align="center" tabular>
          {offerLine(offer)}
        </Text>
        <Button label="Open Jobs" onPress={onOpenJobs} />
      </View>
    );
  } else {
    footer = (
      <Text variant="label" align="center" tabular>
        {offer === null || offer.status === 'withdrawn'
          ? 'This request has closed'
          : offerLine(offer)}
      </Text>
    );
  }

  return (
    <Screen scroll header={header} footer={footer}>
      <View style={{ gap: space.s6, paddingBottom: space.s7 }}>
        <View style={{ borderRadius: radius.r4, overflow: 'hidden' }}>
          <ServicePhoto photo={r.photo} height={vendorSize.heroPhoto} />
        </View>
        <View style={{ gap: space.s2 }}>
          <Text variant="titleLg" accessibilityRole="header">
            {r.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
            <Icon as={Clock} size="xs" />
            <Text variant="labelSm" tabular>
              {open ? timeLeft(r.closesAt, nowMs).replace(' left', ' to quote') : 'Closed'}
            </Text>
            <Text variant="caption" tone="textSecondary">
              {`· ${quotesWord(r.quotes)}`}
            </Text>
          </View>
        </View>
        <Route from={r.from} to={r.to} />
        <RequestDetails request={r} />
      </View>
      <WithdrawQuoteSheet
        visible={confirming}
        open={open}
        busy={withdraw.busy}
        problem={withdraw.problem}
        onClose={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          void withdraw.run().then((done) => {
            if (done) setConfirming(false);
          });
        }}
      />
    </Screen>
  );
}
