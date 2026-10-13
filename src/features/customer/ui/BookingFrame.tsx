import { ArrowLeft } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';

import { kindWord, type MyBooking } from '@/features/customer/domain/myBookings';
import { HIDDEN_LINE } from '@/features/customer/ui/BookingRow';
import { chipTone } from '@/features/customer/ui/chipTone';
import { openWeb, WEB_DASHBOARD } from '@/features/customer/ui/links';
import { space } from '@/shared/theme';
import { Banner, Header, IconButton, Screen, StatusPill, Text } from '@/shared/ui';

type Props = {
  /** Absent while loading or after a failed load. */
  booking?: MyBooking;
  onBack: () => void;
  onRefresh?: () => Promise<unknown>;
  /** Banners under the title (saved data, tickets being issued). */
  notice?: ReactNode;
  /** The primary action, pinned in the thumb zone. */
  footer?: ReactNode;
  children?: ReactNode;
};

// C12 shell shared by every kind: back, title (or the kind word, C4), status, the pending-payment
// banner (C5), the body rows, and the "change or cancel on the web" line.
export function BookingFrame({ booking: b, onBack, onRefresh, notice, footer, children }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh =
    onRefresh === undefined
      ? undefined
      : () => {
          setRefreshing(true);
          void onRefresh().finally(() => {
            setRefreshing(false);
          });
        };
  return (
    <Screen
      scroll
      refreshControl={
        refresh === undefined ? undefined : (
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        )
      }
      header={
        <Header
          title="Booking"
          left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
        />
      }
      footer={footer}
    >
      {b !== undefined ? (
        <View style={{ gap: space.s3 }}>
          <Text variant="titleLg" accessibilityRole="header">
            {b.title ?? kindWord(b.kind)}
          </Text>
          {b.title === null ? (
            <Text variant="body" tone="textSecondary">
              {HIDDEN_LINE}
            </Text>
          ) : null}
          <StatusPill tone={chipTone(b.tone)} label={b.status} />
        </View>
      ) : null}
      {b?.pending === true ? (
        <Banner
          tone="info"
          message="Finish paying on bookhushly.com"
          action={{
            label: 'Open bookhushly.com',
            onPress: () => {
              openWeb(WEB_DASHBOARD);
            },
          }}
        />
      ) : null}
      {notice}
      {children}
      {b !== undefined ? (
        <Text variant="bodySm" tone="textSecondary">
          To change or cancel, use bookhushly.com
        </Text>
      ) : null}
    </Screen>
  );
}
