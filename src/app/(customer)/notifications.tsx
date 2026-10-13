import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';

import { NoticeScreen } from '@/features/customer/screens/NoticeScreen';

// Filled in by the notifications task.
export default function NotificationsRoute() {
  return (
    <NoticeScreen
      title="Notifications"
      icon={Bell}
      heading="No notifications yet"
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/bookings');
      }}
    />
  );
}
