import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { color, radius, space } from '@/shared/theme';
import { Card, Stack, Text } from '@/shared/ui';

type Props = {
  title: string;
  when: string;
  extra?: string | null;
  /** The place's photo: a thumbnail at the left (Airbnb's "Confirm and pay"). */
  image?: string | null;
  children?: ReactNode;
};

const THUMB = 88;

// What an action is about, at the top of its screen or sheet (Airbnb / Booking.com: the booking
// first, with the place's photo). `children`: what happens to it (the cancel money line, U7).
export function BookingSummary({ title, when, extra, image, children }: Props) {
  return (
    <Card>
      <Stack gap="s3">
        <View style={{ flexDirection: 'row', gap: space.s4, alignItems: 'center' }}>
          {image !== undefined && image !== null ? (
            <Image
              source={{ uri: image }}
              style={{
                width: THUMB,
                height: THUMB,
                borderRadius: radius.r3,
                backgroundColor: color.wash,
              }}
              contentFit="cover"
              transition={0}
              accessible={false}
              testID="summary-photo"
            />
          ) : null}
          <View style={{ flex: 1, gap: space.s1 }}>
            <Text variant="bodyStrong">{title}</Text>
            {when !== '' ? (
              <Text variant="bodySm" tone="textSecondary">
                {when}
              </Text>
            ) : null}
            {extra !== undefined && extra !== null ? (
              <Text variant="bodySm" tone="textSecondary">
                {extra}
              </Text>
            ) : null}
          </View>
        </View>
        {children}
      </Stack>
    </Card>
  );
}
