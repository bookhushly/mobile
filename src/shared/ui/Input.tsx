import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { TextInput, useWindowDimensions, View, type TextInputProps } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { borderWidth, color, motion, radius, space, typeVariants } from '@/shared/theme';
import { fontFamily } from '@/shared/theme/fonts';

import { useDensity } from './DensityProvider';
import { useMotionTier } from './motion';
import { Stack } from './Stack';
import { Text } from './Text';

type Props = TextInputProps & {
  label: string;
  error?: string | undefined;
  hint?: string;
  /** Leading slot (search glyph). */
  left?: ReactNode;
  /** Trailing slot (clear, password reveal). */
  right?: ReactNode;
  /** Search boxes: no visible title, the placeholder says what to type (the label stays for
   * screen readers). */
  hideLabel?: boolean;
  /** Lets a form move focus to the first field with a problem. */
  ref?: Ref<TextInput>;
};

const value = typeVariants.body;
const small = typeVariants.caption;
// The title shrinks from body size to caption size as it moves up inside the box.
const SHRINK = small.size / value.size;
// Where the shrunk title sits: this far from the top of the text area.
const TITLE_TOP = space.s3;
// The border thickens on focus; the text area keeps one size so nothing on the form moves.
const THIN = borderWidth.hairline;
const THICK = borderWidth.thick;
const [e1, e2, e3, e4] = motion.easing.decelerate;
const EASE = Easing.bezier(e1, e2, e3, e4);

// Text field with its title inside the box (Airbnb, Expedia, Hyatt, Eventbrite): the title rests
// where the text goes, then moves up and shrinks once the field is focused or filled. One box,
// no loose label above it.
export function Input({
  label,
  error,
  hint,
  left,
  right,
  hideLabel = false,
  ref,
  onFocus,
  onBlur,
  onChangeText,
  style,
  placeholder,
  ...rest
}: Props) {
  const d = useDensity();
  const still = useMotionTier() === 'none';
  const [focused, setFocused] = useState(false);
  const controlled = rest.value !== undefined;
  // Uncontrolled fields still float once typed into.
  const [typed, setTyped] = useState(Boolean(rest.defaultValue));
  const filled = controlled ? rest.value !== '' : typed;
  const floated = !hideLabel && (focused || filled);

  // Inside the border at its thickest, so the box is exactly fieldHeight either way.
  // Dynamic Type grows the title and the value (up to their maxScale), so the geometry grows with
  // them; the box gets taller rather than letting the title sit on the value (design review).
  const fontScale = Math.min(useWindowDimensions().fontScale, value.maxScale);
  const lineH = value.lineHeight * fontScale;
  const titleH = small.lineHeight * fontScale;
  const textTop = hideLabel ? 0 : TITLE_TOP + titleH - space.s2;
  const height = Math.max(d.fieldHeight - 2 * THICK, textTop + lineH + space.s2);
  const restTop = (height - lineH) / 2;
  const lift = useSharedValue(floated ? 1 : 0);
  const target = useRef(floated ? 1 : 0);
  // Started straight from the focus and blur handlers, not after a re-render, so the title moves
  // on the same frame as the tap.
  function move(to: 0 | 1) {
    if (target.current === to) return;
    target.current = to;
    lift.set(still ? to : withTiming(to, { duration: motion.duration.base, easing: EASE }));
  }
  // Values set from outside (a cleared form, a prefilled profile).
  useEffect(() => {
    move(floated ? 1 : 0);
  });
  const titleStyle = useAnimatedStyle(() => {
    const t = lift.get();
    // Shrinking from the left edge moves the text's centre up by half the lost height.
    const shrunkHeight = lineH * SHRINK;
    const to = TITLE_TOP - restTop - (lineH - shrunkHeight) / 2;
    return { transform: [{ translateY: to * t }, { scale: 1 - (1 - SHRINK) * t }] };
  });

  const thick = focused || Boolean(error);
  const border = error
    ? color.status.danger.solid
    : focused
      ? color.textPrimary
      : color.borderStrong;
  return (
    <Stack gap="s3">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radius.r3,
          borderCurve: 'continuous',
          borderWidth: thick ? THICK : THIN,
          borderColor: border,
          backgroundColor: color.surface,
          // Gives back what the thicker border takes, so the text never shifts.
          paddingHorizontal: space.s5 - (thick ? THICK - THIN : 0),
          gap: space.s3,
        }}
      >
        {left}
        <View
          testID="input-area"
          style={{
            flex: 1,
            alignSelf: 'stretch',
            justifyContent: 'center',
            marginVertical: thick ? 0 : THICK - THIN,
          }}
        >
          {hideLabel ? null : (
            <Animated.View
              pointerEvents="none"
              // The input carries the label for screen readers.
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: restTop,
                  transformOrigin: 'left center',
                },
                titleStyle,
              ]}
            >
              <Text variant="body" tone={floated ? 'textSecondary' : 'textMuted'} numberOfLines={1}>
                {label}
              </Text>
            </Animated.View>
          )}
          <TextInput
            ref={ref}
            accessibilityLabel={label}
            accessibilityHint={error ?? hint}
            placeholderTextColor={color.textMuted}
            // While the title rests in the box it is the placeholder; a real one shows once it moves.
            placeholder={hideLabel || floated ? placeholder : undefined}
            {...rest}
            maxFontSizeMultiplier={value.maxScale}
            onChangeText={(t) => {
              // Controlled fields already know their value: no extra render per keystroke.
              if (!controlled) setTyped(t !== '');
              onChangeText?.(t);
            }}
            onFocus={(e) => {
              if (!hideLabel) move(1);
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              if (!filled) move(0);
              setFocused(false);
              onBlur?.(e);
            }}
            style={[
              {
                minHeight: height,
                // Room above the text for the shrunk title.
                paddingTop: textTop,
                paddingBottom: 0,
                color: color.textPrimary,
                fontFamily: fontFamily(value.font, value.weight),
                fontSize: value.size,
                lineHeight: value.lineHeight,
              },
              style,
            ]}
          />
        </View>
        {right}
      </View>
      {error ? (
        <Text variant="bodySm" tone="dangerFg" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint !== undefined ? (
        <Text variant="bodySm" tone="textMuted">
          {hint}
        </Text>
      ) : null}
    </Stack>
  );
}
