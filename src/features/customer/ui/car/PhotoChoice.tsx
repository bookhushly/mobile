import { Image } from 'expo-image';
import { CircleCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, PressableScale, Text } from '@/shared/ui';

type Props = {
  title: string;
  blurb: string;
  image: number;
  checked: boolean;
  onPress: () => void;
  testID?: string;
};

const PHOTO = 120;

// A physical choice shown as a photo (owner, 2026-11-23). Chosen: a 2 pt ink frame and a tick, so
// the state never rests on colour alone.
export function PhotoChoice({ title, blurb, image, checked, onPress, testID }: Props) {
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={`${title}. ${blurb}`}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: radius.r4,
          borderCurve: 'continuous',
          overflow: 'hidden',
          borderWidth: checked ? borderWidth.thick : borderWidth.hairline,
          borderColor: checked ? color.textPrimary : color.border,
          backgroundColor: color.surface,
        }}
      >
        <Image
          source={image}
          contentFit="cover"
          accessible={false}
          style={{ height: PHOTO, backgroundColor: color.wash }}
        />
        <View style={{ padding: space.s4, gap: space.s1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {title}
            </Text>
            {checked ? <Icon as={CircleCheck} size="md" /> : null}
          </View>
          <Text variant="bodySm" tone="textSecondary">
            {blurb}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}
