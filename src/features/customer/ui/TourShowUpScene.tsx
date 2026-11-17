import { WifiOff } from 'lucide-react-native';

import { TourCard } from '@/features/customer/ui/TourCard';
import { TourChip } from '@/features/customer/ui/TourChip';
import { TourFloat, type TourMotion } from '@/features/customer/ui/TourFloat';
import { space } from '@/shared/theme';
import { Divider, QrCode, Text } from '@/shared/ui';

// The code points at the website, so scanning the picture leads somewhere harmless.
const SAMPLE_CODE = 'https://bookhushly.com';
const CODE_PT = 148;

// Show up: a ticket as Bookings shows it at the door, with its code, the offline promise pinned
// to its corner.
export function TourShowUpScene(m: TourMotion) {
  return (
    // Handed a ticket: it slides up from below and straightens, its code appears, then the
    // offline promise lands on its corner.
    <TourFloat
      {...m}
      depth={0.16}
      tilt={-2}
      enter={{ y: space.s11, turn: -6, delay: 0 }}
      style={{ width: '72%', alignSelf: 'center' }}
    >
      <TourCard>
        <Text variant="labelSm" numberOfLines={1}>
          Poetry Open Mic Night
        </Text>
        <Text variant="caption" tone="textSecondary" numberOfLines={1}>
          Sat 17 Oct · 7:00 pm · General
        </Text>
        <Divider />
        <TourFloat
          {...m}
          enter={{ scale: 0.9, delay: 240 }}
          style={{ alignItems: 'center', paddingTop: space.s1 }}
        >
          <QrCode value={SAMPLE_CODE} size={CODE_PT} accessibilityLabel="Ticket code" />
        </TourFloat>
      </TourCard>
      <TourFloat
        {...m}
        enter={{ scale: 0.5, pop: true, delay: 460 }}
        style={{ position: 'absolute', right: -space.s7, bottom: -space.s4 }}
      >
        <TourChip icon={WifiOff} label="Works offline" tone="success" />
      </TourFloat>
    </TourFloat>
  );
}
