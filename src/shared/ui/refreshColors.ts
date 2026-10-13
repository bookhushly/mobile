import { color } from '@/shared/theme';

// Theme colours for a pull-to-refresh spinner (Android would otherwise show its default blue).
// `Screen` applies them to its own refresh control; lists outside `Screen`'s scroll spread them.
export const refreshColors = {
  tintColor: color.textSecondary,
  colors: [color.actionFill],
  progressBackgroundColor: color.surface,
};
