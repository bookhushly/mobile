import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

// iOS has no live regions: VoiceOver only hears what is announced. Android's
// `accessibilityLiveRegion` reads changed text by itself, so nothing is said twice there.
export function announce(message: string): void {
  if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
}

/**
 * Announces `message` (iOS) whenever it changes to a new non-null value. `onMount` also
 * announces the value present at first render: feedback that appears together with its text.
 */
export function useAnnounce(message: string | null, onMount = false): void {
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const first = prev.current === undefined;
    const changed = prev.current !== message;
    prev.current = message;
    if (message === null || !changed) return;
    if (first && !onMount) return;
    announce(message);
  }, [message, onMount]);
}
