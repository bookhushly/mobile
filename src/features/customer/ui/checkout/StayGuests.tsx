import type { ReactNode } from 'react';
import { View } from 'react-native';

import { space } from '@/shared/theme';
import { Stack, Stepper, Text } from '@/shared/ui';

type Props = {
  kind: 'hotel' | 'apartment';
  adults: number;
  kids: number;
  /** The room's or apartment's maximum; null when the listing doesn't say. */
  max: number | null;
  error: string | undefined;
  onChange: (adults: number, kids: number) => void;
};

/** Steppers need an upper bound; the server checks the real one. */
const UNKNOWN_MAX = 10;

function Row({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}>
      <View style={{ flex: 1, gap: space.s1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {sub !== undefined ? (
          <Text variant="bodySm" tone="textSecondary">
            {sub}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

// Guests capped at the room's max occupancy (hotels: adults + children) or the apartment's max.
export function StayGuests({ kind, adults, kids, max, error, onChange }: Props) {
  const cap = max ?? UNKNOWN_MAX;
  const sub = max === null ? undefined : `Up to ${String(max)}`;
  return (
    <Stack gap="s3" testID="guests">
      <Text variant="headline">Guests</Text>
      {kind === 'hotel' ? (
        <>
          <Row label="Adults" sub={sub}>
            <Stepper
              label="Adults"
              value={adults}
              min={1}
              max={Math.max(1, cap - kids)}
              onChange={(n) => {
                onChange(n, kids);
              }}
              testID="adults"
            />
          </Row>
          <Row label="Children">
            <Stepper
              label="Children"
              value={kids}
              min={0}
              max={Math.max(0, cap - adults)}
              onChange={(n) => {
                onChange(adults, n);
              }}
              testID="children"
            />
          </Row>
        </>
      ) : (
        <Row label="Guests" sub={sub}>
          <Stepper
            label="Guests"
            value={adults}
            min={1}
            max={Math.max(1, cap)}
            onChange={(n) => {
              onChange(n, 0);
            }}
            testID="adults"
          />
        </Row>
      )}
      {error !== undefined ? (
        <Text
          variant="bodySm"
          tone="dangerFg"
          accessibilityLiveRegion="polite"
          testID="guests-error"
        >
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
