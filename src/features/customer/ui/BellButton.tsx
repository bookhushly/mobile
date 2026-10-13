import { Bell } from 'lucide-react-native';
import { View } from 'react-native';

import { color, radius, space } from '@/shared/theme';
import { IconButton, Text } from '@/shared/ui';

// The Bookings header bell (C2/C13). The count badge is visual only: the label carries it.
export function BellButton({ unread, onPress }: { unread: number; onPress: () => void }) {
  return (
    <View>
      <IconButton
        icon={Bell}
        accessibilityLabel={
          unread > 0 ? `Notifications, ${String(unread)} unread` : 'Notifications'
        }
        onPress={onPress}
      />
      {unread > 0 ? (
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={{
            position: 'absolute',
            top: -space.s1,
            right: -space.s1,
            minWidth: space.s6,
            paddingHorizontal: space.s1,
            borderRadius: radius.rFull,
            backgroundColor: color.actionFill,
            alignItems: 'center',
          }}
        >
          <Text variant="caption" tone="onAction" tabular maxScale={1}>
            {unread > 99 ? '99+' : String(unread)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
