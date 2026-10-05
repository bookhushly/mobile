import type { LucideIcon } from 'lucide-react-native';

type Props = { as: LucideIcon; size?: 16 | 20 | 24 | 32; color: string };

export function Icon({ as: Glyph, size = 24, color }: Props) {
  return <Glyph size={size} color={color} strokeWidth={1.75} />;
}
