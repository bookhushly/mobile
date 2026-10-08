import { CircleAlert, CircleCheck, Info, TriangleAlert, WifiOff } from 'lucide-react-native';
import { View } from 'react-native';

import { color, radius, space, type ColorRole, type StatusTone } from '@/shared/theme';

import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

const GLYPH = {
  neutral: WifiOff,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
} as const;
const FG: Record<StatusTone, ColorRole> = {
  neutral: 'neutralFg',
  info: 'infoFg',
  success: 'successFg',
  warning: 'warningFg',
  danger: 'dangerFg',
};

type Props = {
  tone: StatusTone;
  title?: string;
  message: string;
  action?: { label: string; onPress: () => void };
  live?: 'polite' | 'assertive';
  testID?: string;
};

// Inline status. Transient failures use `neutral`: never red for something the user didn't cause.
export function Banner({
  tone,
  title,
  message,
  action,
  live = 'polite',
  testID = 'banner',
}: Props) {
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        gap: space.s3,
        padding: space.s4,
        borderRadius: radius.r3,
        backgroundColor: color.status[tone].bg,
      }}
    >
      <Icon as={GLYPH[tone]} size="sm" tone={FG[tone]} />
      <View style={{ flex: 1, gap: space.s2 }}>
        {title !== undefined ? (
          <Text variant="bodyStrong" tone={FG[tone]}>
            {title}
          </Text>
        ) : null}
        <Text variant="bodySm" tone={FG[tone]} accessibilityLiveRegion={live}>
          {message}
        </Text>
        {action !== undefined ? (
          <View style={{ alignSelf: 'flex-start', marginTop: space.s2 }}>
            <Button variant="secondary" label={action.label} onPress={action.onPress} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
