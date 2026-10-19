import { Card, Stack, Text } from '@/shared/ui';

type Props = { title: string; when: string; extra?: string | null };

// What an action is about, at the top of its sheet (Airbnb / Booking.com: the booking first).
export function BookingSummary({ title, when, extra }: Props) {
  return (
    <Card>
      <Stack gap="s1">
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="bodySm" tone="textSecondary">
          {when}
        </Text>
        {extra !== undefined && extra !== null ? (
          <Text variant="bodySm" tone="textSecondary">
            {extra}
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}
