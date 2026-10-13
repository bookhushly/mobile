import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color, space } from '@/shared/theme';
import { IconButton, Text, useMotionTier } from '@/shared/ui';

type Props = {
  title: string;
  images: readonly string[];
  /** The photo tapped in the pager. */
  startIndex: number;
  onClose: () => void;
};

// Spec D14: full-size photos load only here. Mounted only while open, so it is the one Modal on
// screen. Swipe between photos; Close (or back) returns to the listing.
export function GalleryViewer({ title, images, startIndex, onClose }: Props) {
  const { width } = useWindowDimensions();
  const tier = useMotionTier();
  const start = Math.min(images.length - 1, Math.max(0, startIndex));
  const [index, setIndex] = useState(start);
  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(Math.min(images.length - 1, Math.max(0, i)));
  };
  return (
    <Modal
      visible
      animationType={tier === 'none' ? 'none' : 'fade'}
      onRequestClose={onClose}
      testID="gallery-viewer"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: color.inverse }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.s3,
            paddingHorizontal: space.s3,
            minHeight: 56,
          }}
        >
          <IconButton icon={X} variant="inverse" accessibilityLabel="Close" onPress={onClose} />
          <Text variant="label" tone="onInverse" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </Text>
          <Text variant="label" tone="onInverse" tabular testID="viewer-counter">
            {`${String(index + 1)}/${String(images.length)}`}
          </Text>
        </View>
        <FlatList
          horizontal
          pagingEnabled
          data={images}
          initialScrollIndex={start}
          keyExtractor={(u, i) => `${String(i)}:${u}`}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onSettle}
          initialNumToRender={1}
          windowSize={3}
          renderItem={({ item, index: i }) => (
            <View style={{ width, flex: 1, justifyContent: 'center' }}>
              <Image
                source={{ uri: item }}
                style={{ width, height: '100%' }}
                contentFit="contain"
                cachePolicy="memory-disk"
                recyclingKey={item}
                transition={0}
                accessibilityLabel={`Photo ${String(i + 1)} of ${String(images.length)}, ${title}`}
              />
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
