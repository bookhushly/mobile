import { Button } from './Button';
import { Card } from './Card';
import { Screen } from './Screen';
import { Stack } from './Stack';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle: string;
  identity: string;
  onSignOut: () => void;
  footnote?: string;
};

export function ShellPlaceholder({ title, subtitle, identity, onSignOut, footnote }: Props) {
  return (
    <Screen>
      <Stack gap="s3">
        <Text variant="titleLg">{title}</Text>
        <Text variant="body" tone="textSecondary">
          {subtitle}
        </Text>
      </Stack>
      <Card>
        <Stack gap="s2">
          <Text variant="label" tone="textMuted">
            Signed in as
          </Text>
          <Text variant="bodyStrong" testID="shell-identity">
            {identity}
          </Text>
        </Stack>
      </Card>
      {footnote ? (
        <Text variant="caption" tone="textMuted" testID="shell-footnote">
          {footnote}
        </Text>
      ) : null}
      <Button variant="secondary" label="Sign out" onPress={onSignOut} testID="shell-sign-out" />
    </Screen>
  );
}
