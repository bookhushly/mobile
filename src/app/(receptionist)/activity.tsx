import { router } from 'expo-router';

import { ActivityScreen } from '@/features/receptionist/screens/ActivityScreen';

export default function ActivityRoute() {
  return (
    <ActivityScreen
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/today');
      }}
    />
  );
}
