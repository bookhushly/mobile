import { CircleCheck, Truck, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { CarPhoto } from '@/features/customer/ui/car/CarPhoto';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, Text, useDensity } from '@/shared/ui';

type Props = {
  title: string;
  line: string;
  /** null: a grey block with a vehicle icon ("Let the company choose"). */
  photo: number | null;
  checked: boolean;
  onPress: () => void;
  /** A tick beside the chosen row (vehicle rows, like car types); service rows use the frame only. */
  tick?: boolean;
  /** Drawn when there's no photo (a truck by default). */
  icon?: LucideIcon;
  testID?: string;
};

const PHOTO_W = 96;
const ROW_MIN = 76;

// Owner's pick A (2026-11-23): full-width photo rows, as the driver cards. The photo reads at a
// glance and the name never squeezes; chosen is a 2 pt ink frame, never colour alone.
export function PhotoRow({
  title,
  line,
  photo,
  checked,
  onPress,
  tick = false,
  icon = Truck,
  testID,
}: Props) {
  const d = useDensity();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={`${title}, ${line}`}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: Math.max(ROW_MIN, d.rowMin),
        flexDirection: 'row',
        alignItems: 'stretch',
        borderRadius: radius.r4,
        borderCurve: 'continuous',
        overflow: 'hidden',
        borderWidth: checked ? borderWidth.thick : borderWidth.hairline,
        borderColor: checked ? color.textPrimary : color.border,
        backgroundColor: pressed ? color.wash : color.surface,
      })}
    >
      <CarPhoto source={photo} width={PHOTO_W} height="100%" corner={0} icon={icon} />
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          gap: space.s1,
          paddingVertical: space.s3,
          paddingHorizontal: space.s4,
        }}
      >
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="bodySm" tone="textSecondary">
          {line}
        </Text>
      </View>
      {tick && checked ? (
        <View style={{ justifyContent: 'center', paddingRight: space.s4 }}>
          <Icon as={CircleCheck} size="md" />
        </View>
      ) : null}
    </Pressable>
  );
}
