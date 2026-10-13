import { Share2 } from 'lucide-react-native';
import { Platform, Share, View } from 'react-native';

import type { SavedKind } from '@/features/customer/api/savedDb';
import type { Saved } from '@/features/customer/hooks/useSaved';
import { HeartButton } from '@/features/customer/ui/HeartButton';
import type { ListingSummary } from '@/features/customer/ui/listingSummary';
import { IconButton, useDensity } from '@/shared/ui';

type Props = {
  kind: SavedKind;
  id: string;
  summary: ListingSummary;
  /** The web page (D11/D13). */
  url: string;
  saved: Saved;
};

/**
 * D13: the native share sheet with the title and the web link. iOS attaches `url` itself (a URL in
 * the message too would show twice); Android ignores `url`, so the link goes in the message.
 */
export function shareListing(title: string, url: string, os: string = Platform.OS): void {
  const content =
    os === 'ios' ? { title, message: title, url } : { title, message: `${title}\n${url}` };
  Share.share(content).catch(() => undefined);
}

// Header actions: share and the heart (D9, D13).
export function ListingActions({ kind, id, summary: s, url, saved }: Props) {
  const d = useDensity();
  return (
    <View style={{ flexDirection: 'row', gap: d.targetGap }}>
      <IconButton
        icon={Share2}
        accessibilityLabel={`Share ${s.title}`}
        onPress={() => {
          shareListing(s.title, url);
        }}
        testID="listing-share"
      />
      <HeartButton
        title={s.title}
        saved={saved.isSaved(kind, id)}
        disabled={!saved.ready}
        testID="listing-heart"
        onToggle={() => {
          void saved.toggle({
            listingId: id,
            kind,
            title: s.title,
            image: s.images[0] ?? null,
            location: s.area,
          });
        }}
      />
    </View>
  );
}
