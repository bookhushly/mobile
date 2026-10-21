import { ExternalLink } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { CardPrice } from '@/features/customer/domain/listingCard';
import { FooterNotice } from '@/features/customer/ui/FooterNotice';
import { PriceTag } from '@/features/customer/ui/PriceTag';
import { space } from '@/shared/theme';
import { Button, Text } from '@/shared/ui';

type Props = {
  price: CardPrice;
  /** Events: "Sat 17 Oct" under the price. */
  when?: string | null;
  label: string;
  /** Why the button is off ("Sold out"); it then reads the reason (D12). */
  blocked: string | null;
  onBook: () => void;
  /** The button leaves the app (4b hand-off): it carries the external-link icon. */
  external?: boolean;
  /** Floats above the row (Undo, the sign-in note); never part of it. */
  notice?: ReactNode;
};

export const WEB_NOTE = 'You may need to sign in on the website.';

// Spec §3, D11, final UX review U1: one row, the price summary on the left and the action on the
// right (the button takes the row only when there is no summary). A hand-off label never promises
// booking in the app (P2: in-app checkout drops the link icon). No urgency copy.
export function ListingFooter({
  price,
  when,
  label,
  blocked,
  onBook,
  external = true,
  notice,
}: Props) {
  const hasWhen = when !== undefined && when !== null;
  const summary = price !== null || hasWhen;
  return (
    <View>
      {notice !== undefined && notice !== null ? <FooterNotice>{notice}</FooterNotice> : null}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}
        testID="listing-footer"
      >
        {summary ? (
          <View style={{ flex: 1, gap: space.s1 }} testID="footer-summary">
            <PriceTag price={price} testID="footer-price" />
            {hasWhen ? (
              <Text variant="bodySm" tone="textSecondary" numberOfLines={1}>
                {when}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View style={summary ? { flexShrink: 0, maxWidth: '60%' } : { flex: 1 }}>
          <Button
            label={blocked ?? label}
            icon={blocked === null && external ? ExternalLink : undefined}
            disabled={blocked !== null}
            onPress={onBook}
            testID="listing-book"
          />
        </View>
      </View>
    </View>
  );
}
