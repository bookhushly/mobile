import { ArrowLeft, X } from 'lucide-react-native';
import { View } from 'react-native';

import { color, radius, space } from '@/shared/theme';
import { IconButton, Text } from '@/shared/ui';

type Props = {
  /** 1-based. */
  step: number;
  of: number;
  /** Step 1 has nothing to go back to: it closes instead. */
  onBack: () => void;
  onClose: () => void;
};

const BAR = 4;

// Design 1A (Public, MyFitnessPal): a round back button top left, the progress line beside it.
// The line is ink on grey, so progress never leans on colour alone (the words say it too).
export function StepHeader({ step, of, onBack, onClose }: Props) {
  const first = step === 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}>
      {first ? (
        <IconButton icon={X} accessibilityLabel="Close" onPress={onClose} />
      ) : (
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />
      )}
      <View style={{ flex: 1, gap: space.s2 }}>
        {/* Spoken once, by the progress bar below. */}
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text variant="caption" tone="textSecondary">
            {`Step ${String(step)} of ${String(of)}`}
          </Text>
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Step ${String(step)} of ${String(of)}`}
          accessibilityValue={{ min: 0, max: of, now: step }}
          style={{ flexDirection: 'row', gap: space.s2 }}
        >
          {Array.from({ length: of }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: BAR,
                borderRadius: radius.rFull,
                backgroundColor: i < step ? color.textPrimary : color.border,
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
