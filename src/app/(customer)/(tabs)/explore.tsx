import { Compass } from 'lucide-react-native';

import { NoticeScreen } from '@/features/customer/screens/NoticeScreen';

// Placeholder until the Explore screen lands (Phase 4b Task 5).
export default function ExploreRoute() {
  return (
    <NoticeScreen
      title="Explore"
      icon={Compass}
      heading="Hotels, apartments and events"
      message="Browsing arrives in the next update."
    />
  );
}
