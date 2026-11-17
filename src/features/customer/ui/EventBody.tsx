import { View } from 'react-native';

import type { EventStock } from '@/features/customer/domain/discover';
import {
  effectivePackagePrice,
  lowStockThreshold,
  ticketTiers,
} from '@/features/customer/domain/discover';
import { earlyBirdNote, ticketStockWord } from '@/features/customer/domain/listingDetail';
import { plainText } from '@/features/customer/domain/plainText';
import type { EventDetail } from '@/features/customer/schemas/listings';
import { DetailSection } from '@/features/customer/ui/DetailSection';
import { TicketTypeCard } from '@/features/customer/ui/TicketTypeCard';
import { space } from '@/shared/theme';
import { Banner } from '@/shared/ui';

type Props = { event: EventDetail; stock: EventStock; nowMs: number };

// D12: why tickets can't be had; nothing while they can.
const STOCK_BANNER: Partial<Record<EventStock, string>> = {
  soldOut: 'Sold out. Every ticket type is gone.',
  started: 'This event has started.',
  notOnSale: 'Tickets aren’t on sale right now.',
};

// Spec §3 event: why tickets can't be had (if so), then the ticket types with price, early-bird
// note and stock word. When and where are in the hero (EventHero); the description, cancellation
// and organiser follow on the page (ListingScreen), organiser last as Eventbrite and Luma do.
export function EventBody({ event: e, stock, nowMs }: Props) {
  const threshold = lowStockThreshold(e.low_stock_threshold);
  const banner = STOCK_BANNER[stock];
  // A single-tier event's implicit tier isn't a ticket type: its price is in the footer.
  const tiers = ticketTiers(e.ticket_packages);
  return (
    <>
      {banner !== undefined ? (
        <Banner tone="neutral" message={banner} testID="stock-banner" />
      ) : null}
      {tiers.length > 0 ? (
        <DetailSection label="Tickets" testID="tickets">
          <View style={{ gap: space.s3 }}>
            {tiers.map((p, i) => (
              <TicketTypeCard
                key={`${String(i)}:${p.name}`}
                ticket={{
                  name: p.name,
                  price: Math.max(0, effectivePackagePrice(p, nowMs)),
                  description: plainText(p.description ?? null),
                  earlyBird: earlyBirdNote(p, nowMs),
                  stock: ticketStockWord(p, threshold, stock),
                }}
              />
            ))}
          </View>
        </DetailSection>
      ) : null}
    </>
  );
}
