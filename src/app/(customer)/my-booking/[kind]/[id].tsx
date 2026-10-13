import { router, useLocalSearchParams } from 'expo-router';
import { SearchX, Ticket } from 'lucide-react-native';

import { bookingRefParams } from '@/features/customer/domain/routeParams';
import { NoticeScreen } from '@/features/customer/screens/NoticeScreen';

const back = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/bookings');
};

export default function MyBookingRoute() {
  const params = useLocalSearchParams<{ kind: string; id: string }>();
  const ref = bookingRefParams(params.kind, params.id);
  if (ref === null)
    return (
      <NoticeScreen
        title="Booking"
        icon={SearchX}
        heading="This booking isn't on your account"
        onBack={back}
      />
    );
  // Filled in by the booking details task.
  return <NoticeScreen title="Booking" icon={Ticket} heading="Booking details" onBack={back} />;
}
