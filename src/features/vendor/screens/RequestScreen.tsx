import {
  ArrowLeft,
  Car,
  Clock,
  Lock,
  Package,
  ShieldCheck,
  StickyNote,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { offerLine, type FactIcon, type RequestDetail } from '@/features/vendor/domain/requests';
import { timeLeft } from '@/features/vendor/domain/today';
import type { QuoteProblem } from '@/features/vendor/hooks/useVendorRequests';
import { Route } from '@/features/vendor/ui/Route';
import { ServicePhoto } from '@/features/vendor/ui/ServicePhoto';
import { shortDate } from '@/shared/lib/lagosDay';
import { borderWidth, color, radius, space, vendorSize } from '@/shared/theme';
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

const FACT_ICON: Record<FactIcon, LucideIcon> = {
  package: Package,
  truck: Truck,
  car: Car,
  users: Users,
  shield: ShieldCheck,
  clock: Clock,
  note: StickyNote,
};

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

function DateBox({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string | null;
}) {
  return (
    <View style={{ flex: 1, padding: space.s4, gap: space.s1 }}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <Text variant="label">{value}</Text>
      {detail === null ? null : (
        <Text variant="caption" tabular>
          {detail}
        </Text>
      )}
    </View>
  );
}

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
        <View
          style={{
            flexDirection: 'row',
            borderWidth: borderWidth.hairline,
            borderColor: color.border,
            borderRadius: radius.r4,
          }}
        >
          <DateBox label={r.start.label} value={shortDate(r.start.date)} detail={r.start.time} />
          {r.end === null ? null : (
            <>
              <View style={{ width: borderWidth.hairline, backgroundColor: color.border }} />
              <DateBox label={r.end.label} value={r.end.value} detail={r.end.detail} />
            </>
          )}
        </View>
        <View style={{ gap: space.s5 }}>
          {r.facts.map((f) => (
            <View key={f.title} style={{ flexDirection: 'row', gap: space.s4 }}>
              <Icon as={FACT_ICON[f.icon]} size="md" />
              <View style={{ flex: 1, gap: space.s1 }}>
                <Text variant="label">{f.title}</Text>
                {f.detail === null ? null : (
                  <Text variant="caption" tone="textSecondary">
                    {f.detail}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
        {r.note === null ? null : (
          <View
            style={{
              backgroundColor: color.wash,
              borderRadius: radius.r4,
              padding: space.s5,
              gap: space.s2,
            }}
          >
            <Text variant="caption" tone="textSecondary">
              From the customer
            </Text>
            <Text variant="bodySm">{r.note}</Text>
          </View>
        )}
      </View>
      <Sheet
        visible={confirming}
        title="Withdraw your quote?"
        onClose={() => {
          setConfirming(false);
        }}
        footer={
          <Button
            label="Withdraw quote"
            variant="destructive"
            loading={withdraw.busy}
            onPress={() => {
              void withdraw.run().then((done) => {
                if (done) setConfirming(false);
              });
            }}
            testID="vendor-withdraw-confirm"
          />
        }
      >
        {withdraw.problem === null ? null : (
          <Banner
            tone={withdraw.problem.transient ? 'neutral' : 'warning'}
            title={withdraw.problem.title}
            message={withdraw.problem.message}
          />
        )}
        <Text variant="body" tone="textSecondary">
          {open
            ? 'The customer won’t see it any more. You can send a new quote while the request is open.'
            : 'The customer won’t see it any more.'}
        </Text>
      </Sheet>
    </Screen>
  );
}
