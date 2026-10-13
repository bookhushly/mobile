import { Heart } from 'lucide-react-native';
import { View } from 'react-native';

import { borderWidth, color, iconSize, iconStroke } from '@/shared/theme';
import { PressableScale, useDensity } from '@/shared/ui';

type Props = {
  /** The listing's name, for the spoken label. */
  title: string;
  saved: boolean;
  /** The saved list hasn't loaded yet, so the heart can't know its state. */
  disabled?: boolean;
  onToggle: () => void;
  testID?: string;
};

// Spec §6 / D9: a toggle with `selected`; "Save X" / "Remove X from saved". Saved is shown by the
// fill as well as the colour. No bounce: only the kit press scale, which Reduce Motion turns off.
export function HeartButton({ title, saved, disabled = false, onToggle, testID }: Props) {
  const d = useDensity();
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove ${title} from saved` : `Save ${title}`}
      accessibilityState={{ selected: saved, disabled }}
      disabled={disabled}
      onPress={onToggle}
    >
      <View
        style={{
          width: d.minTarget,
          height: d.minTarget,
          borderRadius: d.minTarget / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: color.surface,
          borderWidth: borderWidth.hairline,
          borderColor: color.border,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Heart
          size={iconSize.sm}
          strokeWidth={iconStroke}
          color={saved ? color.actionFill : color.textPrimary}
          fill={saved ? color.actionFill : 'transparent'}
        />
      </View>
    </PressableScale>
  );
}
