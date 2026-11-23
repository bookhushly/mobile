import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { color, radius, space } from '@/shared/theme';
import { Icon, PressableScale, Text, useDensity } from '@/shared/ui';

export type Tile<T extends string> = {
  key: T;
  label: string;
  /** One short, true line under the name ("Whole homes"). */
  blurb: string;
  image: number;
  /** A short tag over the photo ("New"): ink text on a white pill. */
  badge?: string;
};

type Props<T extends string> = {
  tiles: readonly Tile<T>[];
  onPress: (key: T) => void;
  testID?: string;
};

const WIDE_HEIGHT = 200;
const HALF_HEIGHT = 180;
const ARROW_DISC = 36;

// Owner's pick (2026-11-15), after corner and Google Arts & Culture on Mobbin: big photo cards, the
// first across the row and the rest sharing the row below. The name is large and white on a deep
// fade over the bottom half (scrim to 80 % black), so it reads on any photo; a white arrow disc says
// "open".
export function CategoryTiles<T extends string>({ tiles, onPress, testID }: Props<T>) {
  const d = useDensity();
  const [first, ...rest] = tiles;
  if (first === undefined) return null;
  const card = (t: Tile<T>, wide: boolean) => (
    <PressableScale
      key={t.key}
      accessibilityRole="button"
      accessibilityLabel={t.badge === undefined ? t.label : `${t.label}, ${t.badge}`}
      accessibilityHint={t.blurb}
      onPress={() => {
        onPress(t.key);
      }}
      style={{ flex: 1 }}
    >
      <View
        style={{
          minHeight: wide ? WIDE_HEIGHT : HALF_HEIGHT,
          borderRadius: radius.r4,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: color.wash,
          justifyContent: 'flex-end',
        }}
      >
        <Image
          source={t.image}
          contentFit="cover"
          accessible={false}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[color.scrim[0], color.scrim[1], color.scrim[2]]}
          locations={[0.3, 0.65, 1]}
          style={StyleSheet.absoluteFill}
        />
        {t.badge === undefined ? null : (
          <View
            style={{
              position: 'absolute',
              top: space.s4,
              left: space.s4,
              paddingHorizontal: space.s3,
              paddingVertical: space.s1,
              borderRadius: radius.rFull,
              backgroundColor: color.surface,
            }}
          >
            <Text variant="caption" maxScale={1.2}>
              {t.badge}
            </Text>
          </View>
        )}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: space.s3,
            padding: space.s4,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              variant={wide ? 'titleLg' : 'title'}
              tone="onInverse"
              numberOfLines={2}
              maxScale={1.2}
            >
              {t.label}
            </Text>
            <Text variant="bodySm" tone="onInverse" numberOfLines={2} maxScale={1.2}>
              {t.blurb}
            </Text>
          </View>
          {wide ? (
            <View
              style={{
                width: ARROW_DISC,
                height: ARROW_DISC,
                borderRadius: radius.rFull,
                backgroundColor: color.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon as={ArrowRight} size="sm" />
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
  // Four tiles (car rentals joined, 2026-11-23): two equal rows of two, as in the approved design.
  if (tiles.length === 4) {
    return (
      <View testID={testID} style={{ gap: d.targetGap }}>
        {[tiles.slice(0, 2), tiles.slice(2)].map((row) => (
          <View
            key={row.map((t) => t.key).join()}
            style={{ flexDirection: 'row', gap: d.targetGap }}
          >
            {row.map((t) => card(t, false))}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View testID={testID} style={{ gap: d.targetGap }}>
      <View style={{ flexDirection: 'row' }}>{card(first, true)}</View>
      {rest.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: d.targetGap }}>
          {rest.map((t) => card(t, false))}
        </View>
      ) : null}
    </View>
  );
}
