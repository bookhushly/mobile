import { router } from 'expo-router';

import { VendorJobs } from '@/features/vendor/screens/VendorJobsContainers';

export default function VendorJobsTab() {
  return (
    <VendorJobs
      onOpen={(j) => {
        router.push({ pathname: '/vendor/job/[id]', params: { id: j.id } });
      }}
    />
  );
}
