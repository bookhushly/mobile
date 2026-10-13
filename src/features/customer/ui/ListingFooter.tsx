import { ExternalLink } from 'lucide-react-native';
import { View } from 'react-native';

import type { CardPrice } from '@/features/customer/domain/listingCard';
import { PriceTag } from '@/features/customer/ui/PriceTag';
import { space } from '@/shared/theme';
import { Banner, Button, Text } from '@/shared/ui';

type Props = {
  price: CardPrice;
  /** Events: "Sat 17 Oct" beside the price. */
  when?: string | null;
  label: string;
  /** Why the button is off ("Sold out"); it then reads the reason (D12). */
  blocked: string | null;
  /** The one-time "sign in on the website" note (D11). */
  showNote: boolean;
  onBook: () => void;
};

export const WEB_NOTE = 'You may need to sign in on the website.';

// Spec §3, D11: sticky price summary + the hand-off to bookhushly.com. The label never promises
// booking in the app. No urgency copy.
export function ListingFooter({ price, when, label, blocked, showNote, onBook }: Props) {
  return (
    <View style={{ gap: space.s3 }} testID="listing-footer">
      {showNote && blocked === null ? <Banner tone="info" message={WEB_NOTE} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
        <View style={{ flexShrink: 1 }}>
          <PriceTag price={price} testID="footer-price" />
        </View>
        {when != null ? (
          <Text variant="bodySm" tone="textSecondary" numberOfLines={1}>
            {price === null ? when : `· ${when}`}
          </Text>
        ) : null}
      </View>
      <Button
        label={blocked ?? label}
        icon={blocked === null ? ExternalLink : undefined}
        disabled={blocked !== null}
        onPress={onBook}
        testID="listing-book"
      />
    </View>
  );
}
