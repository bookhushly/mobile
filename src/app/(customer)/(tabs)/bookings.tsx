import { Ticket } from 'lucide-react-native';

import { EmptyState, Header, Screen } from '@/shared/ui';

// Filled in by the bookings task.
export default function BookingsRoute() {
  return (
    <Screen header={<Header title="Bookings" />}>
      <EmptyState icon={Ticket} title="Your bookings show here" />
    </Screen>
  );
}
