import { StatusBar } from 'expo-status-bar';
import { Heart, MapPin, Share2, type LucideIcon } from 'lucide-react-native';
import { useContext } from 'react';
import { View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Gallery } from '@/features/customer/ui/Gallery';
import { color, iconSize, iconStroke, layout, radius, space } from '@/shared/theme';
import { Icon, PressableScale, Text, useDensity, useWide } from '@/shared/ui';

type Props = {
  title: string;
  /** "Sat 22 Nov · 8:00 pm". */
  when: string | null;
  venue: string | null;
  images: readonly string[];
  onOpenPhoto: (index: number) => void;
  saved: boolean;
  savedReady: boolean;
  onToggleSaved: () => void;
  onShare: () => void;
  /** Null without a venue. */
  onDirections: (() => void) | null;
};

function Tile({
  icon,
  label,
  onPress,
  selected,
  disabled,
  spoken,
  testID,
}: {
  icon: LucideIcon | 'heart';
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  spoken?: string;
  testID?: string;
}) {
  const d = useDensity();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={spoken ?? label}
      accessibilityState={{ selected: selected === true, disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={{ flex: 1 }}
      testID={testID}
    >
      <View
        style={{
          minHeight: d.minTarget + space.s6,
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.s2,
          paddingVertical: space.s3,
          borderRadius: radius.r3,
          borderCurve: 'continuous',
          backgroundColor: color.inverseRaised,
          opacity: disabled === true ? 0.5 : 1,
        }}
      >
        {icon === 'heart' ? (
          <Heart
            size={iconSize.sm}
            strokeWidth={iconStroke}
            color={color.onInverse}
            fill={selected === true ? color.onInverse : 'transparent'}
          />
        ) : (
          <Icon as={icon} size="sm" tone="onInverse" />
        )}
        <Text variant="labelSm" tone="onInverse" maxScale={1.3} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

/**
 * Luma's event page (owner's pick, 2026-11-15, Mobbin): the poster as a rounded square card on a
 * dark hero, the name in white under it, when and where, then Share, Save and Directions as raised
 * tiles. The price and "Get tickets" stay in the page's footer, so there is one primary action.
 * Plain ink, not Luma's blurred backdrop (DESIGN_SYSTEM: no heavy blur).
 */
export function EventHero({
  title,
  when,
  venue,
  images,
  onOpenPhoto,
  saved,
  savedReady,
  onToggleSaved,
  onShare,
  onDirections,
}: Props) {
  const d = useDensity();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0 };
  const gutter = useWide() ? layout.tabletGutter : layout.phoneGutter;
  return (
    <View
      testID="event-hero"
      style={{
        marginHorizontal: -gutter,
        paddingHorizontal: gutter,
        // Clear of the floating back button.
        paddingTop: insets.top + space.s2 + d.minTarget + space.s5,
        paddingBottom: space.s7,
        gap: space.s6,
        backgroundColor: color.inverse,
      }}
    >
      <StatusBar style="light" />
      <Gallery kind="event" title={title} images={images} onOpen={onOpenPhoto} framed />
      <View style={{ gap: space.s2 }}>
        <Text
          variant="titleLg"
          tone="onInverse"
          accessibilityRole="header"
          testID="listing-title"
        >
          {title}
        </Text>
        {when !== null ? (
          <Text variant="body" tone="onInverse" testID="event-when-line">
            {when}
          </Text>
        ) : null}
        {venue !== null ? (
          <Text variant="bodySm" tone="onInverseMuted" numberOfLines={2}>
            {venue}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: space.s3 }}>
        <Tile icon={Share2} label="Share" spoken={`Share ${title}`} onPress={onShare} />
        <Tile
          icon="heart"
          label={saved ? 'Saved' : 'Save'}
          spoken={saved ? `Remove ${title} from saved` : `Save ${title}`}
          selected={saved}
          disabled={!savedReady}
          onPress={onToggleSaved}
          testID="listing-heart"
        />
        {onDirections !== null ? (
          <Tile
            icon={MapPin}
            label="Directions"
            spoken={`Directions to ${venue ?? 'the venue'}, opens Maps`}
            onPress={onDirections}
          />
        ) : null}
      </View>
    </View>
  );
}
