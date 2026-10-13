import { router } from 'expo-router';
import { Search } from 'lucide-react-native';

import { NoticeScreen } from '@/features/customer/screens/NoticeScreen';

// Placeholder until the Search screen lands (Phase 4b Task 6).
export default function SearchRoute() {
  return (
    <NoticeScreen
      title="Search"
      icon={Search}
      heading="Search is on its way"
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/explore');
      }}
    />
  );
}
