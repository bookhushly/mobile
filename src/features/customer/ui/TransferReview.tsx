import type { Notice } from '@/features/customer/ui/actionText';
import { BookingSummary } from '@/features/customer/ui/BookingSummary';
import { Banner, Inline, Spinner, Stack, Text } from '@/shared/ui';

type Props = {
  title: string;
  when: string;
  tickets: number;
  /** The recipient, in full so a typo can still be caught; null when unknown (a lost answer). */
  email: string | null;
  checking: boolean;
  notice: Notice | null;
};

function ticketsWord(n: number): string {
  return `${String(n)} ticket${n === 1 ? '' : 's'}`;
}

// Spec E7 step 2 (Posh "Confirm details", One "can't be cancelled"): event, date, tickets, To.
export function TransferReview({ title, when, tickets, email, checking, notice }: Props) {
  return (
    <Stack gap="s4">
      <Text variant="displaySm" accessibilityRole="header">
        Check before you send
      </Text>
      <BookingSummary title={title} when={when} extra={tickets > 0 ? ticketsWord(tickets) : null} />
      {email !== null ? (
        <Stack gap="s1">
          <Text variant="label" tone="textSecondary">
            To
          </Text>
          <Text variant="bodyStrong" testID="transfer-to">
            {email}
          </Text>
        </Stack>
      ) : null}
      <Text variant="bodyStrong">You’ll lose these tickets. This can’t be undone.</Text>
      {checking ? (
        <Inline gap="s2">
          <Spinner tone="textSecondary" />
          <Text variant="bodySm" tone="textSecondary" accessibilityLiveRegion="polite">
            Checking your booking…
          </Text>
        </Inline>
      ) : null}
      {notice !== null ? (
        <Banner tone={notice.tone} message={notice.message} testID="transfer-notice" />
      ) : null}
    </Stack>
  );
}
