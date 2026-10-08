import type { LucideIcon } from 'lucide-react-native';

import { iconSize, textTone, type ColorRole, type IconSizeKey } from '@/shared/theme';

type Props = {
  as: LucideIcon;
  size?: IconSizeKey | 16 | 20 | 24 | 32;
  tone?: ColorRole;
  /** Kit-internal escape hatch for fills chosen by role elsewhere (outcome fg). */
  color?: string;
  strokeWidth?: number;
};

export function Icon({
  as: Glyph,
  size = 'md',
  tone = 'textPrimary',
  color,
  strokeWidth = 1.75,
}: Props) {
  const px = typeof size === 'number' ? size : iconSize[size];
  return <Glyph size={px} color={color ?? textTone[tone]} strokeWidth={strokeWidth} />;
}
