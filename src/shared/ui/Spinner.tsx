import { ActivityIndicator } from 'react-native';

import { textTone, type ColorRole } from '@/shared/theme';

export function Spinner({ tone = 'textPrimary', label }: { tone?: ColorRole; label?: string }) {
  return <ActivityIndicator color={textTone[tone]} accessibilityLabel={label} />;
}
