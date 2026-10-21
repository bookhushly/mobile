import { router, useIsFocused } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';

import { holdEndsAt } from '@/features/customer/domain/checkout/paymentFlow';
import { kindWord, type MyBooking } from '@/features/customer/domain/myBookings';
import { useServerNow } from '@/features/customer/hooks/useServerNow';
import { checkoutStore } from '@/features/customer/offline/checkoutStore';
import { HIDDEN_LINE } from '@/features/customer/ui/BookingRow';
import { chipTone } from '@/features/customer/ui/chipTone';
import { openWeb, WEB_DASHBOARD } from '@/features/customer/ui/links';
import { CHECKOUT_PAYMENTS_ENABLED } from '@/shared/config/features';
import { space } from '@/shared/theme';
import { Banner, Header, IconButton, refreshColors, Screen, StatusPill, Text } from '@/shared/ui';

type Props = {
  /** Absent while loading or after a failed load. */
  booking?: MyBooking;
  /** The signed-in customer: a payment this device started shows as being checked (P21). */
  userId?: string;
  onBack: () => void;
  onRefresh?: () => Promise<unknown>;
  /** Banners under the title (saved data, tickets being issued). */
  notice?: ReactNode;
  /** The primary action, pinned in the thumb zone. */
  footer?: ReactNode;
  /** The Manage booking section (spec E9), under the details. */
  manage?: ReactNode;
  children?: ReactNode;
};

// C12 shell shared by every kind: back, title (or the kind word, C4), status, the pending-payment
// banner (C5), the body rows, and the Manage booking section (spec E9).
export function BookingFrame({
  booking: b,
  userId = '',
  onBack,
  onRefresh,
  notice,
  footer,
  manage,
  children,
}: Props) {
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
          <RefreshControl refreshing={refreshing} onRefresh={refresh} {...refreshColors} />
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
      {b?.pending === true ? <PendingBanner booking={b} userId={userId} /> : null}
      {notice}
      {children}
      {manage}
    </Screen>
  );
}

/**
 * Whether this device has a payment open for the booking (P5), re-read on focus and on each
 * refetch; null while the first read is under way.
 */
function useStoredPayment(userId: string, b: MyBooking): boolean | null {
  const focused = useIsFocused();
  const [stored, setStored] = useState<boolean | null>(userId === '' ? false : null);
  useEffect(() => {
    if (userId === '' || !focused) return;
    let live = true;
    checkoutStore
      .get(userId, b.kind, b.id)
      .then((e) => {
        if (live) setStored(e !== null && e.payment !== null);
      })
      .catch(() => {
        if (live) setStored(false);
      });
    return () => {
      live = false;
    };
    // `b` changes on every refetch, which is when a resumed payment may have settled.
  }, [userId, b, focused]);
  return stored;
}

// Spec P21, P8: a stored payment is being checked; else Pay now (events always, stays within
// the hold, on the server clock); else a stay past its hold can be booked again; else the web.
function PendingBanner({ booking: b, userId }: { booking: MyBooking; userId: string }) {
  const stored = useStoredPayment(userId, b);
  // No flash of Pay now before a stored payment is found.
  if (stored === null) return null;
  if (stored) return <Banner tone="info" message="Checking your payment…" />;
  if (!CHECKOUT_PAYMENTS_ENABLED || (b.kind !== 'event' && b.createdAt === null))
    return <WebPayBanner />;
  if (b.kind === 'event') return <PayNowBanner booking={b} />;
  return <StayPayBanner booking={b} createdAt={b.createdAt ?? ''} />;
}

// Its own component: only a pending stay re-renders on the second tick.
function StayPayBanner({ booking: b, createdAt }: { booking: MyBooking; createdAt: string }) {
  const now = useServerNow();
  const ends = holdEndsAt(b.kind, createdAt);
  if (ends !== null && now < ends) return <PayNowBanner booking={b} />;
  const listingId = b.listingId ?? null;
  return (
    <Banner
      tone="neutral"
      message="This hold has ended"
      action={
        listingId === null
          ? undefined
          : {
              label: 'Book again',
              onPress: () => {
                router.push({
                  pathname: '/listing/[kind]/[id]',
                  params: { kind: b.kind, id: listingId },
                });
              },
            }
      }
    />
  );
}

function PayNowBanner({ booking: b }: { booking: MyBooking }) {
  return (
    <Banner
      tone="info"
      message="Finish paying to confirm this booking"
      action={{
        label: 'Pay now',
        onPress: () => {
          router.push({
            pathname: '/pay/[kind]/[bookingId]',
            params: { kind: b.kind, bookingId: b.id },
          });
        },
      }}
    />
  );
}

function WebPayBanner() {
  return (
    <Banner
      tone="info"
      message="Finish paying on bookhushly.com"
      action={{
        label: 'Pay on bookhushly.com',
        onPress: () => {
          openWeb(WEB_DASHBOARD);
        },
      }}
    />
  );
}
