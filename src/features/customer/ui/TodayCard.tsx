import { View } from 'react-native';

import { kindWord, type MyBooking } from '@/features/customer/domain/myBookings';
import { chipTone } from '@/features/customer/ui/chipTone';
import type { MainAction } from '@/features/customer/ui/mainAction';
import { space } from '@/shared/theme';
import { Button, Card, StatusPill, Text } from '@/shared/ui';

type Props = {
  booking: MyBooking;
  action: MainAction;
  onOpen: (b: MyBooking) => void;
  onShowTickets: (b: MyBooking) => void;
  onShowCheckInCode: (b: MyBooking) => void;
};

const LABEL: Record<MainAction, string> = {
  tickets: 'Show tickets',
  checkInCode: 'Show check-in code',
  open: 'View booking',
};

// C3: something happening today leads the list, with the one action that matters at the door.
export function TodayCard({ booking: b, action, onOpen, onShowTickets, onShowCheckInCode }: Props) {
  const title = b.title ?? kindWord(b.kind);
  const run = () => {
    if (action === 'tickets') onShowTickets(b);
    else if (action === 'checkInCode') onShowCheckInCode(b);
    else onOpen(b);
  };
  return (
    <Card>
      <View style={{ gap: space.s3 }}>
        <Text variant="labelSm" tone="textSecondary">
          {`Today · ${kindWord(b.kind)}`}
        </Text>
        <Text variant="headline" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="bodySm" tone="textSecondary">
          {b.next}
        </Text>
        <StatusPill tone={chipTone(b.tone)} label={b.status} size="sm" />
        <View style={{ gap: space.s2 }}>
          <Button
            variant={action === 'open' ? 'secondary' : 'primary'}
            label={LABEL[action]}
            accessibilityLabel={`${LABEL[action]}, ${title}`}
            onPress={run}
          />
          {action !== 'open' ? (
            <Button
              variant="ghost"
              label="Booking details"
              accessibilityLabel={`Booking details, ${title}`}
              onPress={() => {
                onOpen(b);
              }}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}
