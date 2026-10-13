import { router, useLocalSearchParams } from 'expo-router';
import { Ticket, SearchX } from 'lucide-react-native';

import { bookingIdParam } from '@/features/customer/domain/routeParams';
import { NoticeScreen } from '@/features/customer/screens/NoticeScreen';

const back = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/bookings');
};

export default function TicketsRoute() {
  const params = useLocalSearchParams<{ bookingId: string }>();
  const id = bookingIdParam(params.bookingId);
  if (id === null)
    return (
      <NoticeScreen
        title="Tickets"
        icon={SearchX}
        heading="This booking isn't on your account"
        onBack={back}
      />
    );
  // Filled in by the ticket viewer and check-in code task.
  return <NoticeScreen title="Tickets" icon={Ticket} heading="Your tickets" onBack={back} />;
}
