import { router, useLocalSearchParams } from 'expo-router';

import { VendorJob } from '@/features/vendor/screens/VendorJobsContainers';

export default function VendorJobRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VendorJob
      id={typeof id === 'string' ? id : ''}
      onBack={() => {
        router.back();
      }}
    />
  );
}
