import { useIsFocused } from 'expo-router';
import { CircleCheck, QrCode as QrIcon, SearchX } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { showCheckInCode, spacedCode } from '@/features/customer/domain/checkInCode';
import { fromHotel, kindWord, type MyBooking } from '@/features/customer/domain/myBookings';
import { useBooking } from '@/features/customer/hooks/useBooking';
import { CodeSheet } from '@/features/customer/ui/CodeSheet';
import { savedAtLabel } from '@/features/customer/ui/savedAt';
import { clock } from '@/shared/api/instance';
import { stayRange } from '@/shared/lib/lagosDay';
import { useBrightScreen } from '@/shared/platform/useBrightScreen';
import { layout, space } from '@/shared/theme';
import {
  Banner,
  EmptyState,
  ErrorState,
  QrCode,
  SkeletonRows,
  StatusPill,
  Text,
  useWide,
} from '@/shared/ui';

type Props = {
  userId: string;
  /** null: the route param wasn't a UUID. */
  bookingId: string | null;
  onClose: () => void;
};

const QR_MAX = 400;

type Shown = { booking: MyBooking; code: string; saved: boolean };

function Body({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1, paddingHorizontal: space.s5 }}>{children}</View>;
}

function Code({ shown }: { shown: Shown }) {
  const { width } = useWindowDimensions();
  const gutter = useWide() ? layout.tabletGutter : layout.phoneGutter;
  const size = Math.min(width - gutter * 2, QR_MAX);
  const checkedIn = shown.booking.status === 'Checked in';
  return (
    <ScrollView
      contentContainerStyle={{
        alignItems: 'center',
        gap: space.s5,
        paddingHorizontal: gutter,
        paddingVertical: space.s5,
      }}
    >
      {checkedIn ? <StatusPill tone="success" icon={CircleCheck} label="Checked in" /> : null}
      <QrCode value={shown.code} size={size} accessibilityLabel="Check-in code" />
      <Text variant="display" tabular selectable align="center">
        {spacedCode(shown.code)}
      </Text>
      <Text variant="body" tone="textSecondary" align="center">
        Show this at the front desk
      </Text>
    </ScrollView>
  );
}

function HotelCode({ userId, id, onClose }: { userId: string; id: string; onClose: () => void }) {
  const b = useBooking(userId, 'hotel', id);
  const focused = useIsFocused();
  let shown: Shown | null = null;
  let allowed = true;
  if (b.row !== undefined && b.row !== null) {
    const code = b.row.check_in_code;
    if (showCheckInCode(b.row) && code !== null)
      shown = { booking: fromHotel(b.row, b.today), code: code.trim(), saved: false };
    else allowed = false;
  } else if (b.row === undefined && b.fromWallet !== null) {
    // Offline (C9): the wallet keeps the code only when the web rule showed it.
    const code = b.fromWallet.checkInCode?.trim() ?? '';
    if (b.fromWallet.kind === 'hotel' && code !== '')
      shown = { booking: b.fromWallet, code, saved: true };
    else allowed = false;
  }
  useBrightScreen(focused && shown !== null);

  if (shown !== null) {
    const e = shown.booking;
    const note = !shown.saved
      ? undefined
      : b.savedAt === null
        ? 'Showing your saved code.'
        : `Showing your saved code — last updated ${savedAtLabel(b.savedAt, clock.serverNow())}.`;
    return (
      <CodeSheet
        title={e.title ?? kindWord('hotel')}
        subtitle={stayRange(e.start, e.end)}
        onClose={onClose}
        notice={note === undefined ? undefined : <Banner tone="neutral" message={note} />}
      >
        <Code shown={shown} />
      </CodeSheet>
    );
  }
  let body: ReactNode;
  if (b.row === null)
    body = <EmptyState icon={SearchX} title="This booking isn't on your account" />;
  else if (!allowed) body = <EmptyState icon={QrIcon} title="No check-in code for this booking" />;
  else if (b.error)
    body = (
      <ErrorState
        title="Couldn't load your check-in code"
        message="Check the connection and try again."
        onRetry={() => {
          void b.refetch();
        }}
      />
    );
  else body = <SkeletonRows count={3} />;
  return (
    <CodeSheet title="Check-in code" onClose={onClose}>
      <Body>{body}</Body>
    </CodeSheet>
  );
}

// C10: the hotel check-in code, full screen, for the front desk.
export function CheckInCodeScreen({ userId, bookingId, onClose }: Props) {
  if (bookingId === null)
    return (
      <CodeSheet title="Check-in code" onClose={onClose}>
        <Body>
          <EmptyState icon={SearchX} title="This booking isn't on your account" />
        </Body>
      </CodeSheet>
    );
  return <HotelCode key={bookingId} userId={userId} id={bookingId} onClose={onClose} />;
}
