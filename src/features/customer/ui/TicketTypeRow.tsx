import { View } from 'react-native';

import type { TicketStockWord } from '@/features/customer/domain/listingDetail';
import { PriceTag } from '@/features/customer/ui/PriceTag';
import { borderWidth, color, space } from '@/shared/theme';
import { StatusPill, Text, useDensity } from '@/shared/ui';

export type TicketTypeModel = {
  name: string;
  /** The effective price now (early bird while it lasts); 0 → Free. */
  price: number;
  description: string | null;
  /** "Early bird until Fri 16 Oct", or null. */
  earlyBird: string | null;
  /** D12 wording; null while plenty are left or once the event is off sale. */
  stock: TicketStockWord | null;
};

// Mobbin §5: each ticket type with its price and a stock word (word + colour, never colour alone).
export function TicketTypeRow({ ticket: t }: { ticket: TicketTypeModel }) {
  const d = useDensity();
  return (
    <View
      testID={`ticket-${t.name}`}
      style={{
        minHeight: d.rowMin,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.s4,
        paddingVertical: space.s4,
        borderBottomWidth: borderWidth.hairline,
        borderBottomColor: color.border,
      }}
    >
      <View style={{ flex: 1, gap: space.s1 }}>
        <Text variant="bodyStrong">{t.name}</Text>
        {t.description !== null ? (
          <Text variant="bodySm" tone="textSecondary">
            {t.description}
          </Text>
        ) : null}
        {t.earlyBird !== null ? (
          <Text variant="bodySm" tone="successFg">
            {t.earlyBird}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: space.s2 }}>
        <PriceTag price={t.price > 0 ? { amount: t.price } : { text: 'Free' }} />
        {t.stock !== null ? (
          <StatusPill
            size="sm"
            tone={t.stock === 'Sold out' ? 'neutral' : 'warning'}
            label={t.stock}
          />
        ) : null}
      </View>
    </View>
  );
}
