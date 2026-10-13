import { Heart } from 'lucide-react-native';

import { NoticeScreen } from '@/features/customer/screens/NoticeScreen';

// Placeholder until the Saved screen lands (Phase 4b Task 8).
export default function SavedRoute() {
  return (
    <NoticeScreen
      title="Saved"
      icon={Heart}
      heading="Nothing saved yet"
      message="Tap the heart on anything you like to find it here."
    />
  );
}
