import { Image } from 'expo-image';
import { ShieldCheck } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { PhotoKey } from '@/features/vendor/domain/today';
import { SERVICE_PHOTO } from '@/features/vendor/ui/servicePhotos';
import { color } from '@/shared/theme';
import { Icon } from '@/shared/ui';

type Props = { photo: PhotoKey; height: number; children?: ReactNode };

/** A card's photo strip, with anything laid over it (the time pill). */
export function ServicePhoto({ photo, height, children }: Props) {
  return (
    <View style={{ height, backgroundColor: color.wash, overflow: 'hidden' }}>
      {photo === 'security' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon as={ShieldCheck} size="lg" tone="textSecondary" />
        </View>
      ) : (
        <Image
          source={SERVICE_PHOTO[photo]}
          contentFit="cover"
          accessible={false}
          transition={0}
          style={{ flex: 1 }}
        />
      )}
      {children}
    </View>
  );
}
