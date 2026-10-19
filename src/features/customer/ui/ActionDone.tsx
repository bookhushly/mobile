import { Stack, SuccessMark, Text } from '@/shared/ui';

type Props = { title: string; message?: string | null };

// The result step every action sheet shares: a drawn check, what happened, what's next. The
// result is the one in-body heading a sheet keeps (titleLg, not the serif display: UX review U6).
export function ActionDone({ title, message }: Props) {
  return (
    <Stack gap="s4">
      <SuccessMark size={64} animate />
      <Text variant="titleLg" accessibilityRole="header" accessibilityLiveRegion="polite">
        {title}
      </Text>
      {message !== undefined && message !== null ? (
        <Text variant="body" tone="textSecondary">
          {message}
        </Text>
      ) : null}
    </Stack>
  );
}
