import { Navigation, Phone, ShieldCheck } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Alert, Linking, View } from 'react-native';

import type { Stage } from '@/features/customer/domain/carRental/carStatus';
import type { SecurityRequest } from '@/features/customer/schemas/security';
import { directionsUrl } from '@/features/customer/ui/car/BookedView';
import { CarPhoto } from '@/features/customer/ui/car/CarPhoto';
import { stateName } from '@/features/customer/ui/car/StateSheet';
import { dateRange, timeWords } from '@/features/customer/ui/car/carWords';
import { SECURITY_SERVICE, SHIFT, teamWords } from '@/features/customer/ui/security/securityWords';
import { formatNaira } from '@/shared/lib/formatNaira';
import { longDate } from '@/shared/lib/lagosDay';
import { borderWidth, color, space } from '@/shared/theme';
import { Button, Stack, Text } from '@/shared/ui';

type Props = { request: SecurityRequest; stage: Stage };

const THUMB = 72;

const HEAD: Partial<Record<Stage, { eyebrow: string; title: string }>> = {
  booked: { eyebrow: 'Paid', title: 'Your security is booked' },
  onTrip: { eyebrow: 'Under way', title: 'Your guards are on duty' },
  done: { eyebrow: 'Done', title: 'The job is done' },
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

// After paying: what's booked, when, where, the team. The company's phone is on the request only
// once it's paid (web rule), so Call shows only then.
export function SecurityBookedView({ request: r, stage }: Props) {
  const head = HEAD[stage] ?? { eyebrow: 'Booked', title: 'Your security is booked' };
  const company = r.selectedVendor?.name ?? 'The company';
  const dial = (r.selectedVendor?.phone ?? '').replace(/[^\d+]/g, '');
  const phone = /\d{7,}/.test(dial) ? dial : null;
  const place = [r.address, r.landmark, stateName(r.pickupState)].filter(Boolean).join(', ');
  const starts =
    r.startTime === null
      ? longDate(r.pickupDate)
      : `${longDate(r.pickupDate)}, from ${timeWords(r.startTime)}`;
  const offer = r.selectedOffer;
  return (
    <Stack gap="s6">
      <View style={{ gap: space.s2 }}>
        <Text variant="label" tone="textSecondary" testID="security-stage">
          {`${head.eyebrow} · ${dateRange(r.pickupDate, r.endDate)}`}
        </Text>
        <Text variant="titleLg" accessibilityRole="header">
          {head.title}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}>
        <CarPhoto
          // A stock photo never stands in for the company's team (SOURCES.md): the shield instead.
          source={null}
          width={THUMB}
          height={THUMB}
          icon={ShieldCheck}
        />
        <View style={{ flex: 1, gap: space.s1 }}>
          <Text variant="bodyStrong">{SECURITY_SERVICE[r.service].label}</Text>
          <Text variant="bodySm" tone="textSecondary">
            {offer === null ? company : `${company} · ${formatNaira(offer.amount)} quote`}
          </Text>
        </View>
      </View>
      <Section title="When">
        <Text variant="bodyStrong">{starts}</Text>
        <Text variant="body" tone="textSecondary">
          {[
            r.endDate === null
              ? r.duration === 'one_time' || r.duration === 'hourly'
                ? null
                : 'No end date'
              : `Until ${longDate(r.endDate)}`,
            r.shift === null ? null : SHIFT[r.shift],
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </Section>
      <Section title="Where">
        <Text variant="body" tone="textSecondary">
          {place}
        </Text>
        <Button
          label="Directions"
          icon={Navigation}
          variant="secondary"
          onPress={() => {
            open(
              directionsUrl(place),
              'Couldn’t open Maps',
              `Search for ${place} in your maps app.`,
            );
          }}
        />
      </Section>
      <Section title="The team">
        <Text variant="body">{teamWords(r)}</Text>
        {r.canine || r.vehicle ? (
          <Text variant="bodySm" tone="textSecondary">
            {r.canine && r.vehicle
              ? 'With a guard dog and a patrol vehicle'
              : r.canine
                ? 'With a guard dog'
                : 'With a patrol vehicle'}
          </Text>
        ) : null}
        {phone === null ? null : (
          <Button
            label={`Call ${company}`}
            icon={Phone}
            variant="secondary"
            onPress={() => {
              open(`tel:${phone}`, 'Couldn’t start a call', `Call ${phone} from your phone app.`);
            }}
            testID="security-call"
          />
        )}
      </Section>
    </Stack>
  );
}
