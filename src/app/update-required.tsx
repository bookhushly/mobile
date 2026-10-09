import { Linking, Platform } from 'react-native';

import { UpdateRequiredScreen } from '@/features/mode/screens/StatusScreens';
import { storeUrl } from '@/shared/config/store';

export default function UpdateRequired() {
  return (
    <UpdateRequiredScreen
      storeUrl={storeUrl()}
      platform={Platform.OS === 'ios' ? 'ios' : 'android'}
      onOpen={(url) => {
        void Linking.openURL(url);
      }}
    />
  );
}
