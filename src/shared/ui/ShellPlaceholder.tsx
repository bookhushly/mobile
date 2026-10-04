import type { ReactNode } from 'react';

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
  children?: ReactNode;
};

export function ShellPlaceholder({
  title,
  subtitle,
  identity,
  onSignOut,
  footnote,
  children,
}: Props) {
  return (
    <Screen>
      <Stack gap="s3">
        <Text variant="titleLg" accessibilityRole="header">
          {title}
        </Text>
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
      {children}
      {footnote ? (
        <Text variant="caption" tone="textMuted" testID="shell-footnote">
          {footnote}
        </Text>
      ) : null}
      <Button variant="secondary" label="Sign out" onPress={onSignOut} testID="shell-sign-out" />
    </Screen>
  );
}
