import { Stack, SuccessMark, Text } from '@/shared/ui';

type Props = { title: string; message?: string | null };

// The result step every action sheet shares: a drawn check, what happened, what's next.
export function ActionDone({ title, message }: Props) {
  return (
    <Stack gap="s4">
      <SuccessMark size={64} animate />
      <Text variant="displaySm" accessibilityRole="header" accessibilityLiveRegion="polite">
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
