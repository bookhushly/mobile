import { Phone, Truck } from 'lucide-react-native';
import { Alert, Linking, View } from 'react-native';

import type { Stage } from '@/features/customer/domain/carRental/carStatus';
import { trackMarks, trackPhase } from '@/features/customer/domain/logistics/tracking';
import '@/features/customer/offline/imageCache';
import type { LogisticsRequest } from '@/features/customer/schemas/logistics';
import { CarPhoto } from '@/features/customer/ui/car/CarPhoto';
import { RequestTimeline } from '@/features/customer/ui/car/RequestTimeline';
import { untilWords } from '@/features/customer/ui/car/RfqStatusView';
import { stateName } from '@/features/customer/ui/car/StateSheet';
import { LOGISTICS_TERMS } from '@/features/customer/ui/car/quoteTerms';
import { formatNaira } from '@/shared/lib/formatNaira';
import { lagosToday, shortDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Button, Stack, Text } from '@/shared/ui';

type Props = { request: LogisticsRequest; stage: Stage; nowMs: number };

const THUMB = 72;
const PROOF_H = 180;

const HEAD = {
  paid: 'Booked',
  pickedUp: 'It’s been picked up',
  onTheWay: 'It’s on the way',
  delivered: 'It’s been delivered',
  confirmed: 'Delivered',
} as const;

// Design L3: after paying, the timeline becomes tracking, with the times the company marks.
// The company's phone is on the request only once it's paid (web rule), so Call shows only then.
export function TrackingView({ request: r, stage, nowMs }: Props) {
  const today = lagosToday(nowMs);
  const at = (iso: string | null) => (iso === null ? null : untilWords(iso, today));
  const phase = trackPhase({ ...r, confirmed: r.status === 'completed' });
  const marks = trackMarks(phase);
  const offer = r.selectedOffer;
  const name = offer === null ? 'Your delivery' : LOGISTICS_TERMS.nameOf(offer, r);
  const photo = offer?.vehicle?.imageUrls[0] ?? offer?.imageUrls[0] ?? null;
  const company = r.selectedVendor?.name ?? 'The company';
  const dial = (r.selectedVendor?.phone ?? '').replace(/[^\d+]/g, '');
  const phone = /\d{7,}/.test(dial) ? dial : null;
  const title =
    stage === 'refunded'
      ? 'Your money was returned'
      : stage === 'problem'
        ? 'We’re looking into it'
        : HEAD[phase];
  return (
    <Stack gap="s6">
      <View style={{ gap: space.s2 }}>
        <Text variant="label" tone="textSecondary" testID="logistics-stage">
          {`${stage === 'refunded' ? 'Refunded' : stage === 'problem' ? 'Problem reported' : 'Paid'} · ${shortDate(r.pickupDate)}`}
        </Text>
        <Text variant="titleLg" accessibilityRole="header">
          {title}
        </Text>
        {phase === 'delivered' ? (
          <Text variant="body" tone="textSecondary">
            {`${company} marked it delivered. Check it arrived, then confirm so they’re paid.`}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}>
        <CarPhoto source={photo} width={THUMB} height={THUMB} icon={Truck} />
        <View style={{ flex: 1, gap: space.s1 }}>
          <Text variant="bodyStrong">{name}</Text>
          <Text variant="bodySm" tone="textSecondary">
            {offer === null ? company : `${company} · ${formatNaira(offer.amount)} quote`}
          </Text>
        </View>
      </View>
      <RequestTimeline
        testID="logistics-tracking"
        items={[
          { title: 'Paid', line: null, mark: marks[0] },
          {
            title: 'Picked up',
            line:
              r.pickedUpAt === null
                ? `Waiting for pick-up · ${stateName(r.pickupState)}`
                : [at(r.pickedUpAt), stateName(r.pickupState)].join(' · '),
            mark: marks[1],
          },
          {
            title: 'On the way',
            line: r.inTransitAt === null ? null : `Since ${at(r.inTransitAt) ?? ''}`,
            mark: marks[2],
          },
          {
            title: 'Delivered',
            line: [at(r.deliveredAt), r.deliveryAddress].filter(Boolean).join(' · '),
            mark: marks[3],
          },
        ]}
      />
      {r.proofUrl === null ? null : (
        <View
          style={{ gap: space.s2 }}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Proof of delivery photo from ${company}`}
        >
          <Text variant="label">Proof of delivery</Text>
          <CarPhoto source={r.proofUrl} height={PROOF_H} icon={Truck} />
        </View>
      )}
      {phone === null ? null : (
        <Button
          label={`Call ${company}`}
          icon={Phone}
          variant="secondary"
          onPress={() => {
            Linking.openURL(`tel:${phone}`).catch(() => {
              Alert.alert('Couldn’t start a call', `Call ${phone} from your phone app.`);
            });
          }}
          testID="logistics-call"
        />
      )}
    </Stack>
  );
}
