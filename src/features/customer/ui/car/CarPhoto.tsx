import { Image } from 'expo-image';
import { Car, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { color, radius } from '@/shared/theme';
import { Icon } from '@/shared/ui';

type Props = {
  /** A company's https photo, a bundled option photo, or null (no photo: a grey block, a car). */
  source: string | number | null;
  /** `'100%'`: fill a row that grows with the text beside it. */
  height: number | '100%';
  width?: number;
  /** Corner radius; defaults to the card radius, 0 inside a card that clips its own corners. */
  corner?: number;
  recyclingKey?: string;
  /** Drawn on the grey block when there's no photo (a car by default, a truck for logistics). */
  icon?: LucideIcon;
};

// DESIGN_SYSTEM §6: a missing photo is a grey block with an icon, never a stock photo posing as a
// company's car (stock option photos appear only where a type is being chosen or was asked for).
export function CarPhoto({
  source,
  height,
  width,
  corner = radius.r4,
  recyclingKey,
  icon = Car,
}: Props) {
  const box = {
    height,
    ...(width === undefined ? {} : { width }),
    borderRadius: corner,
    backgroundColor: color.wash,
  };
  if (source === null) {
    return (
      <View style={[box, { alignItems: 'center', justifyContent: 'center' }]}>
        <Icon as={icon} size="lg" tone="textSecondary" />
      </View>
    );
  }
  return (
    <Image
      source={typeof source === 'string' ? { uri: source } : source}
      contentFit="cover"
      accessible={false}
      cachePolicy="memory-disk"
      transition={0}
      {...(recyclingKey === undefined ? {} : { recyclingKey })}
      style={box}
    />
  );
}
