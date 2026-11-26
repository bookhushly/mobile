import { CameraView } from 'expo-camera';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Linking, Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteLocalFile } from '@/shared/platform/deleteLocalFile';
import { useCameraAccess } from '@/shared/ui/camera';
import { color, space } from '@/shared/theme';
import { Button, Text, useMotionTier } from '@/shared/ui';

// Enough to read a label or see the items; small enough to upload on a weak connection.
const PHOTO_QUALITY = 0.6;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The photo's local file; the caller uploads it with the milestone. */
  onUse: (uri: string) => void;
};

/** Take one photo of the delivered items, check it, then use it or retake. */
export function DeliveryPhotoSheet({ visible, onClose, onUse }: Props) {
  const insets = useSafeAreaInsets();
  const motion = useMotionTier();
  const camera = useRef<CameraView>(null);
  const { permission, canAsk, request } = useCameraAccess();
  const [ready, setReady] = useState(false);
  const [taking, setTaking] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Delivery photos show a customer's doorstep: a photo not used is deleted straight away.
  const close = () => {
    if (uri !== null) deleteLocalFile(uri);
    setUri(null);
    setFailed(false);
    onClose();
  };

  const take = async () => {
    if (camera.current === null || !ready || taking) return;
    setTaking(true);
    setFailed(false);
    try {
      const p = await camera.current.takePictureAsync({ quality: PHOTO_QUALITY });
      setUri(p.uri);
    } catch {
      setFailed(true);
    } finally {
      setTaking(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType={motion === 'full' ? 'slide' : 'none'}
      onRequestClose={close}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: color.inverse,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        {permission !== 'granted' ? (
          <View style={{ flex: 1, justifyContent: 'center', padding: space.s6, gap: space.s5 }}>
            <Text variant="headline" tone="onInverse" accessibilityRole="header">
              Take a delivery photo
            </Text>
            <Text variant="body" tone="onInverseMuted">
              {permission === 'denied' && !canAsk
                ? 'Camera access is off. Turn it on in Settings to add the photo.'
                : 'Bookhushly needs the camera to photograph the delivered items for the customer.'}
            </Text>
            {permission === 'denied' && !canAsk ? (
              <Button
                label="Open Settings"
                onInverse="light"
                onPress={() => void Linking.openSettings()}
              />
            ) : (
              <Button label="Allow camera" onInverse="light" onPress={request} />
            )}
            <Button label="Cancel" variant="ghost" onInverse="light" onPress={close} />
          </View>
        ) : uri === null ? (
          <>
            <CameraView
              ref={camera}
              style={{ flex: 1 }}
              facing="back"
              onCameraReady={() => {
                setReady(true);
              }}
            />
            <View style={{ padding: space.s6, gap: space.s4 }}>
              {failed ? (
                <Text
                  variant="bodySm"
                  tone="onInverse"
                  align="center"
                  accessibilityLiveRegion="polite"
                >
                  The photo didn’t take. Try again.
                </Text>
              ) : null}
              <Button
                label="Take photo"
                onInverse="light"
                loading={taking}
                disabled={!ready}
                onPress={() => void take()}
                testID="vendor-photo-take"
              />
              <Button label="Cancel" variant="ghost" onInverse="light" onPress={close} />
            </View>
          </>
        ) : (
          <>
            <Image
              source={{ uri }}
              contentFit="contain"
              style={{ flex: 1 }}
              accessibilityLabel="Your delivery photo"
            />
            <View style={{ padding: space.s6, gap: space.s4 }}>
              <Button
                label="Use photo"
                onInverse="light"
                onPress={() => {
                  onUse(uri);
                  setUri(null);
                }}
                testID="vendor-photo-use"
              />
              <Button
                label="Retake"
                variant="ghost"
                onInverse="light"
                onPress={() => {
                  deleteLocalFile(uri);
                  setUri(null);
                }}
              />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
