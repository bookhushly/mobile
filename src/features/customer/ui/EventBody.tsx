import { View } from 'react-native';

import type { EventStock } from '@/features/customer/domain/discover';
import { effectivePackagePrice, lowStockThreshold } from '@/features/customer/domain/discover';
import {
  earlyBirdNote,
  eventDateLine,
  ticketStockWord,
} from '@/features/customer/domain/listingDetail';
import { plainText } from '@/features/customer/domain/plainText';
import type { EventDetail } from '@/features/customer/schemas/listings';
import { DetailRows } from '@/features/customer/ui/DetailRows';
import { DetailSection } from '@/features/customer/ui/DetailSection';
import { openMaps } from '@/features/customer/ui/links';
import { ReadMoreText } from '@/features/customer/ui/ReadMoreText';
import { TicketTypeRow } from '@/features/customer/ui/TicketTypeRow';
import { Banner } from '@/shared/ui';

type Props = { event: EventDetail; stock: EventStock; nowMs: number };

// D12: why tickets can't be had; nothing while they can.
const STOCK_BANNER: Partial<Record<EventStock, string>> = {
  soldOut: 'Sold out. Every ticket type is gone.',
  ended: 'This event has ended.',
  notOnSale: 'Tickets aren’t on sale right now.',
};

// Spec §3 event: date and time (12-hour, Lagos), venue (→ Maps), organizer, ticket types with
// price, early-bird note and stock word, cancellation policy.
export function EventBody({ event: e, stock, nowMs }: Props) {
  const venue = e.location?.trim() ?? '';
  const threshold = lowStockThreshold(e.category_data);
  const banner = STOCK_BANNER[stock];
  const cancellation = plainText(e.cancellation_policy);
  return (
    <>
      {banner !== undefined ? (
        <Banner tone="neutral" message={banner} testID="stock-banner" />
      ) : null}
      <DetailRows
        rows={[
          { label: 'When', value: eventDateLine(e) ?? '' },
          venue === ''
            ? null
            : {
                label: 'Venue',
                value: venue,
                onPress: () => {
                  openMaps(venue);
                },
              },
          { label: 'Organizer', value: e.vendor_name?.trim() ?? '' },
        ]}
      />
      {e.ticket_packages.length > 0 ? (
        <DetailSection label="Tickets" testID="tickets">
          <View>
            {e.ticket_packages.map((p, i) => (
              <TicketTypeRow
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
      {cancellation !== null ? (
        <DetailSection label="Cancellation">
          <ReadMoreText text={cancellation} />
        </DetailSection>
      ) : null}
    </>
  );
}
