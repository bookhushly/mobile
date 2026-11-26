import { Phone } from 'lucide-react-native';
import { View } from 'react-native';

import { borderWidth, color, radius, space } from '@/shared/theme';
import { IconButton, Text } from '@/shared/ui';

type Props = {
  name: string;
  /** Null until the customer has paid (the web never sends it before). */
  phone: string | null;
  onCall: (phone: string) => void;
};

/** The customer on a job, one tap from a call once they've paid. */
export function CustomerCard({ name, phone, onCall }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s4,
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
        borderRadius: radius.r4,
        padding: space.s4,
      }}
    >
      <View style={{ flex: 1, gap: space.s1 }}>
        <Text variant="label">{name}</Text>
        <Text variant="caption" tone="textSecondary">
          {phone === null ? 'Their phone shows once they pay' : 'Customer'}
        </Text>
      </View>
      {phone === null ? null : (
        <IconButton
          icon={Phone}
          accessibilityLabel={`Call ${name}`}
          onPress={() => {
            onCall(phone);
          }}
        />
      )}
    </View>
  );
}
