import { Phone } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Linking, Pressable, View } from 'react-native';

import type { BookingView } from '@/features/receptionist/domain/bookingState';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import { guestName, nightsLabel } from '@/features/receptionist/ui/GuestRow';
import { stageLabel } from '@/features/receptionist/ui/stageLabel';
import { blockerText, warningText } from '@/features/receptionist/ui/warningText';
import { shortDate, type IsoDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Banner, Divider, Icon, Stack, StatusPill, Text, useDensity } from '@/shared/ui';

type Props = { booking: BookingRow; view: BookingView; today: IsoDate; testID?: string };

export function paymentLabel(status: BookingRow['payment_status']): string {
  switch (status) {
    case 'completed':
      return 'Paid';
    case 'refunded':
      return 'Refunded';
    case 'failed':
      return 'Failed';
    case 'pending':
    case null:
      return 'Not paid';
  }
}

export function roomDetail(b: BookingRow): string {
  const r = b.hotel_rooms;
  if (r === null) return 'No room yet';
  const type = r.hotel_room_types?.name;
  return [
    `Room ${String(r.room_number)}`,
    type === undefined || type === '' ? null : type,
    r.floor === null ? null : `Floor ${String(r.floor)}`,
  ]
    .filter((s): s is string => s !== null)
    .join(' · ');
}

export function partyLabel(b: BookingRow): string | null {
  const parts: string[] = [];
  if (b.adults !== null) parts.push(`${String(b.adults)} ${b.adults === 1 ? 'adult' : 'adults'}`);
  if (b.children !== null && b.children > 0)
    parts.push(`${String(b.children)} ${b.children === 1 ? 'child' : 'children'}`);
  return parts.length === 0 ? null : parts.join(', ');
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.s1, paddingVertical: space.s3 }}>
      <Text variant="labelSm" tone="textMuted">
        {label}
      </Text>
      {children}
    </View>
  );
}

function Value({ children }: { children: string }) {
  return <Text variant="body">{children}</Text>;
}

// Label/value booking rows (Mobbin §2: Hyatt, Trip.com). Presentational: the stage, warnings and
// blocker come from `viewBooking`. The full phone number is shown only here (R19).
export function BookingSummary({ booking: b, view, today, testID }: Props) {
  const d = useDensity();
  const status = stageLabel(view.stage);
  const party = partyLabel(b);
  const blocker = view.blocker === null ? null : blockerText(view.blocker, today);
  const phone = b.guest_phone;
  return (
    <Stack gap="s4" testID={testID}>
      <Stack gap="s3">
        <StatusPill tone={status.tone} label={status.label} />
        <Text variant="titleLg" accessibilityRole="header">
          {guestName(b)}
        </Text>
      </Stack>
      {blocker !== null ? <Banner tone={blocker.tone} message={blocker.message} /> : null}
      {view.warnings.map((w) => (
        <Banner key={w.kind} tone="info" message={warningText(w)} />
      ))}
      <View>
        <Row label="Code">
          <Text variant="body" tabular>
            {b.check_in_code ?? 'No code'}
          </Text>
        </Row>
        <Divider />
        <Row label="Dates">
          <Value>
            {`${shortDate(b.check_in_date)} – ${shortDate(b.check_out_date)}, ${nightsLabel(view.nights)}`}
          </Value>
        </Row>
        <Divider />
        <Row label="Room">
          <Value>{roomDetail(b)}</Value>
        </Row>
        {party !== null ? (
          <>
            <Divider />
            <Row label="Guests">
              <Value>{party}</Value>
            </Row>
          </>
        ) : null}
        <Divider />
        <Row label="Payment">
          <Value>{paymentLabel(b.payment_status)}</Value>
        </Row>
        {phone !== null && phone !== '' ? (
          <>
            <Divider />
            <Row label="Phone">
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Call ${phone}`}
                onPress={() => {
                  void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(
                    () => undefined,
                  );
                }}
                style={{
                  minHeight: d.minTarget,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.s3,
                  alignSelf: 'flex-start',
                }}
              >
                <Icon as={Phone} size="sm" tone="linkText" />
                <Text variant="body" tone="linkText" tabular>
                  {phone}
                </Text>
              </Pressable>
            </Row>
          </>
        ) : null}
        {b.special_requests !== null && b.special_requests.trim() !== '' ? (
          <>
            <Divider />
            <Row label="Special requests">
              <Value>{b.special_requests}</Value>
            </Row>
          </>
        ) : null}
      </View>
    </Stack>
  );
}
