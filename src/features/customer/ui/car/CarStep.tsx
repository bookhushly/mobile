import { Image } from 'expo-image';
import { Car, CircleCheck } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import {
  VEHICLE_TYPES,
  type CarDraft,
  type VehicleType,
} from '@/features/customer/domain/carRental/carRequest';
import { VEHICLE_PHOTO } from '@/features/customer/ui/car/carPhotos';
import { VEHICLE } from '@/features/customer/ui/car/carWords';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, Text, useDensity } from '@/shared/ui';

type Props = { draft: CarDraft; onChange: (p: Partial<CarDraft>) => void };

const PHOTO_W = 96;
const PHOTO_H = 64;

function Row({
  title,
  line,
  photo,
  checked,
  onPress,
  testID,
}: {
  title: string;
  line: string;
  photo: number | null;
  checked: boolean;
  onPress: () => void;
  testID: string;
}) {
  const d = useDensity();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={`${title}, ${line}`}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: d.rowMin,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s4,
        padding: space.s3,
        borderRadius: radius.r4,
        borderCurve: 'continuous',
        borderWidth: checked ? borderWidth.thick : borderWidth.hairline,
        borderColor: checked ? color.textPrimary : color.border,
        backgroundColor: pressed ? color.wash : color.surface,
      })}
    >
      {photo === null ? (
        <View
          style={{
            width: PHOTO_W,
            height: PHOTO_H,
            borderRadius: radius.r3,
            backgroundColor: color.wash,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon as={Car} size="lg" tone="textSecondary" />
        </View>
      ) : (
        <Image
          source={photo}
          contentFit="cover"
          accessible={false}
          style={{
            width: PHOTO_W,
            height: PHOTO_H,
            borderRadius: radius.r3,
            backgroundColor: color.wash,
          }}
        />
      )}
      <View style={{ flex: 1, gap: space.s1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="bodySm" tone="textSecondary" numberOfLines={2}>
          {line}
        </Text>
      </View>
      {checked ? <Icon as={CircleCheck} size="md" /> : null}
    </Pressable>
  );
}

// Step 4, like Uber's ride options: a photo, the type, seats and an example. Optional: "Any car"
// lets every company quote what it has.
export function CarStep({ draft, onChange }: Props) {
  const d = useDensity();
  const pick = (v: VehicleType | null) => {
    onChange({ vehicleType: v });
  };
  return (
    <View accessibilityRole="radiogroup" style={{ gap: d.targetGap }}>
      {VEHICLE_TYPES.map((t) => (
        <Row
          key={t}
          title={VEHICLE[t].label}
          line={`${VEHICLE[t].seats} · e.g. ${VEHICLE[t].example}`}
          photo={VEHICLE_PHOTO[t]}
          checked={draft.vehicleType === t}
          onPress={() => {
            pick(t);
          }}
          testID={`car-type-${t}`}
        />
      ))}
      <Row
        title="Any car"
        line="Companies quote what they have"
        photo={null}
        checked={draft.vehicleType === null}
        onPress={() => {
          pick(null);
        }}
        testID="car-type-any"
      />
    </View>
  );
}
