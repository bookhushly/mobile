import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

import { Text } from '@/shared/ui';

/** Within this many characters of the limit, the counter is announced (once per approach). */
export const NEAR_LIMIT = 20;

type Props = { length: number; max: number; testID?: string };

// UX review U3: a counter is not a live region (it would speak on every keystroke). It is
// announced once when the text comes within NEAR_LIMIT characters of the limit.
export function CharCounter({ length, max, testID }: Props) {
  const near = max - length <= NEAR_LIMIT;
  const wasNear = useRef(near);
  useEffect(() => {
    if (near && !wasNear.current) {
      AccessibilityInfo.announceForAccessibility(
        `${String(Math.max(0, max - length))} characters left`,
      );
    }
    wasNear.current = near;
  }, [near, length, max]);
  return (
    <Text variant="caption" tone="textSecondary" tabular testID={testID}>
      {`${String(length)} / ${String(max)}`}
    </Text>
  );
}
