import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { needsYou, stageWords, type Stage } from '@/features/customer/domain/carRental/carStatus';
import type { CarRequest } from '@/features/customer/schemas/carRental';
import { CarPhoto } from '@/features/customer/ui/car/CarPhoto';
import { VEHICLE_PHOTO } from '@/features/customer/ui/car/carPhotos';
import { stateName } from '@/features/customer/ui/car/WhereStep';
import { dateRange } from '@/features/customer/ui/car/carWords';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, Text, useDensity } from '@/shared/ui';

type Props = { request: CarRequest; stage: Stage; onPress: (id: string) => void };

const THUMB = 72;

/** "Car · Lagos → Ogun". */
export function carRowTitle(r: CarRequest): string {
  const from = stateName(r.pickupState);
  const to =
    r.destinationState === null || r.destinationState === r.pickupState
      ? null
      : stateName(r.destinationState);
  return to === null ? `Car · ${from}` : `Car · ${from} → ${to}`;
}

type RowProps = {
  id: string;
  title: string;
  when: string;
  status: string;
  /** Bold status: the customer has something to do. */
  urgent: boolean;
  photo: string | number | null;
  /** For a request with no photo (a car, a truck). */
  icon?: LucideIcon;
  onPress: (id: string) => void;
};

// Owner, 2026-11-23: a photo, the status as a quiet line above the name (bold when it needs you),
// the dates, a chevron. No coloured tags. Car rental and logistics rows.
export function RequestRow({ id, title, when, status, urgent, photo, icon, onPress }: RowProps) {
  const d = useDensity();
  return (
    <Pressable
      testID={`request-row-${id}`}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${when}, ${status}`}
      onPress={() => {
        onPress(id);
      }}
      style={({ pressed }) => ({
        minHeight: d.rowMin,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s4,
        paddingVertical: space.s4,
        borderBottomWidth: borderWidth.hairline,
        borderBottomColor: color.border,
        backgroundColor: pressed ? color.wash : 'transparent',
      })}
    >
      <CarPhoto
        source={photo}
        width={THUMB}
        height={THUMB}
        recyclingKey={id}
        corner={radius.r3}
        {...(icon === undefined ? {} : { icon })}
      />
      <View style={{ flex: 1, gap: space.s1 }}>
        <Text
          variant={urgent ? 'labelSm' : 'caption'}
          tone={urgent ? 'textPrimary' : 'textSecondary'}
          numberOfLines={1}
        >
          {status}
        </Text>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="bodySm" tone="textSecondary" numberOfLines={1}>
          {when}
        </Text>
      </View>
      <Icon as={ChevronRight} size="md" tone="textSecondary" />
    </Pressable>
  );
}

/** A car rental request in Bookings. */
export function CarRequestRow({ request: r, stage, onPress }: Props) {
  // Once a quote is chosen, only the company's own photo stands for the car; before that, the
  // option photo of the type asked for (what the request is for, not a company's car).
  const chosen = r.selectedOffer;
  const photo =
    chosen === null
      ? r.vehicleType === null
        ? null
        : VEHICLE_PHOTO[r.vehicleType]
      : (chosen.vehicle?.imageUrls[0] ?? chosen.imageUrls[0] ?? null);
  return (
    <RequestRow
      id={r.id}
      title={carRowTitle(r)}
      when={dateRange(r.pickupDate, r.returnDate)}
      status={stageWords(stage, r.offerCount)}
      urgent={needsYou(stage, r.vendorCompletedAt)}
      photo={photo}
      onPress={onPress}
    />
  );
}
