import { Check, CreditCard } from 'lucide-react-native';
import { View } from 'react-native';

import { TourCard } from '@/features/customer/ui/TourCard';
import { TourChip } from '@/features/customer/ui/TourChip';
import { TourFloat, type TourMotion } from '@/features/customer/ui/TourFloat';
import { space } from '@/shared/theme';
import { Divider, Text, formatNaira } from '@/shared/ui';

const NIGHTLY = 85000;
const NIGHTS = 2;
const BREAKFAST = 12000;

function Row({ label, amount, total = false }: { label: string; amount: number; total?: boolean }) {
  const variant = total ? 'labelSm' : 'caption';
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.s3 }}>
      <Text variant={variant} tone={total ? 'textPrimary' : 'textSecondary'} numberOfLines={1}>
        {label}
      </Text>
      <Text variant={variant} tone={total ? 'textPrimary' : 'textSecondary'} tabular>
        {formatNaira(amount)}
      </Text>
    </View>
  );
}

// The bill's lines come in one after another, a beat apart, the total last.
const LINE_START = 160;
const LINE_BEAT = 70;

// Pay in naira: the price summary as checkout shows it, every line in naira, the total last, with
// how you pay and the no-surprises promise pinned to its edges. In motion it adds up: the card
// rises, the lines arrive in order, the promise lands, then the way to pay slides up.
export function TourPayScene(m: TourMotion) {
  const line = (n: number) => ({ y: space.s2, delay: LINE_START + n * LINE_BEAT });
  return (
    <TourFloat
      {...m}
      depth={0.16}
      tilt={-2}
      enter={{ y: space.s9, delay: 0 }}
      style={{ width: '90%', alignSelf: 'center' }}
    >
      <TourCard>
        <TourFloat {...m} enter={line(0)}>
          <Text variant="caption" tone="textMuted" numberOfLines={1}>
            Lagoon-view room · {String(NIGHTS)} nights
          </Text>
        </TourFloat>
        <TourFloat {...m} enter={line(1)}>
          <Row
            label={`${formatNaira(NIGHTLY)} × ${String(NIGHTS)} nights`}
            amount={NIGHTLY * NIGHTS}
          />
        </TourFloat>
        <TourFloat {...m} enter={line(2)}>
          <Row label="Breakfast for two" amount={BREAKFAST} />
        </TourFloat>
        <TourFloat {...m} enter={line(3)}>
          <Divider />
        </TourFloat>
        <TourFloat {...m} enter={line(4)}>
          <Row label="Total" amount={NIGHTLY * NIGHTS + BREAKFAST} total />
        </TourFloat>
      </TourCard>
      <TourFloat
        {...m}
        enter={{ scale: 0.5, pop: true, delay: LINE_START + 5 * LINE_BEAT + 80 }}
        style={{ position: 'absolute', left: space.s5, top: -space.s7 }}
      >
        <TourChip icon={Check} label="Full price before you pay" />
      </TourFloat>
      <TourFloat
        {...m}
        enter={{ y: space.s5, delay: LINE_START + 5 * LINE_BEAT + 180 }}
        style={{ position: 'absolute', right: space.s5, bottom: -space.s7 }}
      >
        <TourChip icon={CreditCard} label="Pay with Paystack" tone="dark" />
      </TourFloat>
    </TourFloat>
  );
}
