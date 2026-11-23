import type { ReactNode } from 'react';
import { Navigation, Phone } from 'lucide-react-native';
import { Alert, Linking, Platform, View } from 'react-native';

import type { Stage } from '@/features/customer/domain/carRental/carStatus';
import type { CarRequest } from '@/features/customer/schemas/carRental';
import { CarPhoto } from '@/features/customer/ui/car/CarPhoto';
import { stateName } from '@/features/customer/ui/car/WhereStep';
import { TRIP, carName, dateRange, timeWords } from '@/features/customer/ui/car/carWords';
import { formatNaira } from '@/shared/lib/formatNaira';
import { longDate } from '@/shared/lib/lagosDay';
import { borderWidth, color, space } from '@/shared/theme';
import { Button, Stack, Text } from '@/shared/ui';

type Props = { request: CarRequest; stage: Stage };

const PHOTO = 180;

const HEAD: Partial<Record<Stage, { eyebrow: string; title: string }>> = {
  booked: { eyebrow: 'Paid', title: 'Your car is booked' },
  onTrip: { eyebrow: 'On your trip', title: 'Enjoy the ride' },
  done: { eyebrow: 'Trip done', title: 'Your trip is done' },
  problem: { eyebrow: 'Problem reported', title: 'We’re looking into it' },
  refunded: { eyebrow: 'Refunded', title: 'Your money was returned' },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View
      style={{
        gap: space.s3,
        paddingTop: space.s6,
        borderTopWidth: borderWidth.hairline,
        borderTopColor: color.border,
      }}
    >
      <Text variant="headline" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Opens a link; when nothing on the phone can, says what to do instead of doing nothing. */
function open(url: string, title: string, instead: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert(title, instead);
  });
}

/** Maps search for a typed address: Apple Maps on iPhone, Google Maps elsewhere (no key needed). */
export function directionsUrl(address: string): string {
  const q = encodeURIComponent(address);
  return Platform.OS === 'ios'
    ? `https://maps.apple.com/?q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

// Design 3A's booked screen, top to bottom: what's booked, pick-up, return. The company's phone is
// on the request only once it is paid (web rule), so Call appears only then.
export function BookedView({ request: r, stage }: Props) {
  const offer = r.selectedOffer;
  const head = HEAD[stage] ?? { eyebrow: 'Booked', title: 'Your car is booked' };
  const photo = offer?.vehicle?.imageUrls[0] ?? offer?.imageUrls[0] ?? null;
  const meet = [r.pickupAddress, stateName(r.pickupState)].filter(Boolean).join(', ');
  const ends = [
    r.destinationAddress,
    r.destinationState === null ? null : stateName(r.destinationState),
  ]
    .filter(Boolean)
    .join(', ');
  const who = [
    r.selectedVendor?.name,
    r.tripType === 'chauffeur' && offer?.driver?.name
      ? `driver ${offer.driver.name}`
      : TRIP[r.tripType].short,
  ]
    .filter(Boolean)
    .join(' · ');
  // Only once paid (web rule), and only a number that can be dialled.
  const dial = (r.selectedVendor?.phone ?? '').replace(/[^\d+]/g, '');
  const phone = /\d{7,}/.test(dial) ? dial : null;
  return (
    <Stack gap="s6">
      <View style={{ gap: space.s2 }}>
        <Text variant="label" tone="textSecondary" testID="car-stage">
          {`${head.eyebrow} · ${dateRange(r.pickupDate, r.returnDate)}`}
        </Text>
        <Text variant="titleLg" accessibilityRole="header">
          {head.title}
        </Text>
      </View>
      <View style={{ gap: space.s3 }}>
        <CarPhoto source={photo} height={PHOTO} />
        <View style={{ gap: space.s1 }}>
          <Text variant="title">{carName(offer?.vehicle ?? null, r.vehicleType)}</Text>
          <Text variant="body" tone="textSecondary">
            {who}
          </Text>
          {offer === null ? null : (
            <Text variant="body" tabular>
              {stage === 'refunded'
                ? `${formatNaira(offer.amount)} quote, refunded`
                : `${formatNaira(offer.amount)} quote`}
            </Text>
          )}
        </View>
      </View>
      <Section title="Pick-up">
        <Text variant="bodyStrong">
          {r.pickupTime === null
            ? longDate(r.pickupDate)
            : `${longDate(r.pickupDate)}, ${timeWords(r.pickupTime)}`}
        </Text>
        <Text variant="body" tone="textSecondary">
          {meet}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.s3 }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Directions"
              icon={Navigation}
              variant="secondary"
              onPress={() => {
                open(
                  directionsUrl(meet),
                  'Couldn’t open Maps',
                  `Search for ${meet} in your maps app.`,
                );
              }}
            />
          </View>
          {phone === null ? null : (
            <View style={{ flex: 1 }}>
              <Button
                label="Call"
                accessibilityLabel={`Call ${r.selectedVendor?.name ?? 'the company'}`}
                icon={Phone}
                variant="secondary"
                onPress={() => {
                  open(
                    `tel:${phone}`,
                    'Couldn’t start a call',
                    `Call ${phone} from your phone app.`,
                  );
                }}
              />
            </View>
          )}
        </View>
      </Section>
      <Section title="Return">
        <Text variant="bodyStrong">{longDate(r.returnDate)}</Text>
        {ends === '' ? null : (
          <Text variant="body" tone="textSecondary">
            {ends}
          </Text>
        )}
      </Section>
    </Stack>
  );
}
