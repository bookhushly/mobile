import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { View } from 'react-native';

import { color, radius, space, type ColorRole, type StatusTone } from '@/shared/theme';

import { useAnnounce } from './announce';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

const GLYPH = {
  neutral: Info,
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
  /** Replaces the tone's glyph (a network-related caller may pass WifiOff). */
  icon?: LucideIcon;
  action?: { label: string; onPress: () => void };
  /** A close button ("Dismiss") at the end, for a note the user may wave away. */
  onDismiss?: () => void;
  /**
   * Android: the live region on the message. iOS: the message is announced when the banner
   * mounts with it and whenever it changes (a banner is always the result of something).
   */
  live?: 'polite' | 'assertive';
  /**
   * iOS: also announce the message the banner mounts with (default). Pass false for a standing
   * offer or note that is not the result of something (it would be read on every screen load);
   * on Android that also drops the live region, so TalkBack doesn't read it as it appears.
   */
  announceOnMount?: boolean;
  testID?: string;
};

// Inline status. Transient failures use `neutral`: never red for something the user didn't cause.
export function Banner({
  tone,
  title,
  message,
  icon,
  action,
  onDismiss,
  live = 'polite',
  announceOnMount = true,
  testID = 'banner',
}: Props) {
  useAnnounce(message, announceOnMount);
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
      <Icon as={icon ?? GLYPH[tone]} size="sm" tone={FG[tone]} />
      <View style={{ flex: 1, gap: space.s2 }}>
        {title !== undefined ? (
          <Text variant="bodyStrong" tone={FG[tone]}>
            {title}
          </Text>
        ) : null}
        <Text
          variant="bodySm"
          tone={FG[tone]}
          // Re-review N3: a standing note is not a live region on Android either.
          accessibilityLiveRegion={announceOnMount ? live : 'none'}
        >
          {message}
        </Text>
        {action !== undefined ? (
          <View style={{ alignSelf: 'flex-start', marginTop: space.s2 }}>
            <Button variant="secondary" label={action.label} onPress={action.onPress} />
          </View>
        ) : null}
      </View>
      {onDismiss !== undefined ? (
        <IconButton icon={X} accessibilityLabel="Dismiss" onPress={onDismiss} />
      ) : null}
    </View>
  );
}
