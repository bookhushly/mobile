import { router } from 'expo-router';

import { VendorJobs } from '@/features/vendor/containers/VendorJobs';

export default function VendorJobsTab() {
  return (
    <VendorJobs
      onOpen={(j) => {
        router.push({ pathname: '/vendor/job/[id]', params: { id: j.id } });
      }}
    />
  );
}
