import { Bell, CalendarCheck, CalendarX, CreditCard, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { NotificationRow as Row } from '@/features/customer/schemas/notifications';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, Text, useDensity } from '@/shared/ui';

const DOT = space.s3;

// Decorative: the title carries the meaning. Types are free text on web (booking_confirmed,
// payment_received, booking_cancelled, …), so match on the words.
function typeIcon(type: string): LucideIcon {
  const t = type.toLowerCase();
  if (t.includes('cancel')) return CalendarX;
  if (/payment|payout|refund|deposit|withdraw|wallet|reversal/.test(t)) return CreditCard;
  if (t.includes('booking')) return CalendarCheck;
  return Bell;
}

type Props = {
  item: Row;
  /** Already worded ("5 min ago"). */
  when: string;
  onPress: (n: Row) => void;
  onLongPress: (n: Row) => void;
};

// Mobbin §5: type icon in a circle · title (bold when unread) · two-line message · time · dot.
export function NotificationRow({ item: n, when, onPress, onLongPress }: Props) {
  const d = useDensity();
  const unread = !n.read;
  const spoken = [unread ? 'Unread' : null, n.title, n.message, when]
    .filter((s): s is string => s !== null && s !== '')
    .join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Opens it. Long press for more options."
      accessibilityActions={[{ name: 'longpress', label: 'More options' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'longpress') onLongPress(n);
      }}
      onPress={() => {
        onPress(n);
      }}
      onLongPress={() => {
        onLongPress(n);
      }}
      style={({ pressed }) => ({
        minHeight: d.rowMin,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.s4,
        paddingVertical: space.s4,
        borderBottomWidth: borderWidth.hairline,
        borderBottomColor: color.border,
        backgroundColor: pressed ? color.wash : 'transparent',
      })}
    >
      <View
        style={{
          width: d.minTarget,
          height: d.minTarget,
          borderRadius: radius.rFull,
          backgroundColor: unread ? color.selectedWash : color.wash,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon as={typeIcon(n.type)} size="sm" tone={unread ? 'linkText' : 'textSecondary'} />
      </View>
      {/* Read rows keep full-contrast text on purpose: Mobbin §5 mutes them, but the contrast
          rules forbid muted text, so read vs unread is the title weight, the icon tint and the dot. */}
      <View style={{ flex: 1, gap: space.s1 }}>
        <Text variant={unread ? 'bodyStrong' : 'body'} numberOfLines={2}>
          {n.title}
        </Text>
        <Text variant="bodySm" tone="textSecondary" numberOfLines={2}>
          {n.message}
        </Text>
        <Text variant="caption" tone="textSecondary">
          {when}
        </Text>
      </View>
      {unread ? (
        <View
          testID={`unread-${n.id}`}
          accessibilityLabel="Unread"
          style={{
            width: DOT,
            height: DOT,
            marginTop: space.s2,
            borderRadius: radius.rFull,
            backgroundColor: color.actionFill,
          }}
        />
      ) : null}
    </Pressable>
  );
}
