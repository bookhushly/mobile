import { router, useLocalSearchParams } from 'expo-router';
import { QrCode, SearchX } from 'lucide-react-native';

import { bookingIdParam } from '@/features/customer/domain/routeParams';
import { NoticeScreen } from '@/features/customer/screens/NoticeScreen';

const back = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/bookings');
};

export default function CheckInCodeRoute() {
  const params = useLocalSearchParams<{ bookingId: string }>();
  const id = bookingIdParam(params.bookingId);
  if (id === null)
    return (
      <NoticeScreen
        title="Check-in code"
        icon={SearchX}
        heading="This booking isn't on your account"
        onBack={back}
      />
    );
  // Filled in by the ticket viewer and check-in code task.
  return (
    <NoticeScreen title="Check-in code" icon={QrCode} heading="Your check-in code" onBack={back} />
  );
}
