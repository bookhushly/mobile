import { View } from 'react-native';

import { PriceTag } from '@/features/customer/ui/PriceTag';
import type { TicketTypeModel } from '@/features/customer/ui/TicketTypeRow';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { StatusPill, Text } from '@/shared/ui';

/**
 * One ticket type on the event page, after Eventbrite's and Posh's ticket cards (Mobbin,
 * 2026-11-15): the name first, the price under it with how many are left beside it (word and
 * colour, never colour alone), then what the ticket includes. Display only: quantities are chosen
 * in checkout (TicketTypeRow with its stepper).
 */
export function TicketTypeCard({ ticket: t }: { ticket: TicketTypeModel }) {
  const off = t.stock === 'Sold out';
  return (
    <View
      testID={`ticket-${t.name}`}
      style={{
        gap: space.s2,
        padding: space.s5,
        borderRadius: radius.r4,
        borderCurve: 'continuous',
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
        backgroundColor: off ? color.canvas : color.surface,
      }}
    >
      <Text variant="bodyStrong" tone={off ? 'textSecondary' : 'textPrimary'}>
        {t.name}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space.s3,
        }}
      >
        <PriceTag price={t.price > 0 ? { amount: t.price } : { text: 'Free' }} />
        {t.stock !== null ? (
          <StatusPill size="sm" tone={off ? 'neutral' : 'warning'} label={t.stock} />
        ) : null}
      </View>
      {t.earlyBird !== null ? (
        <Text variant="bodySm" tone="successFg">
          {t.earlyBird}
        </Text>
      ) : null}
      {t.description !== null ? (
        <Text variant="bodySm" tone="textSecondary">
          {t.description}
        </Text>
      ) : null}
    </View>
  );
}
