import { router } from 'expo-router';

import { VendorRequests } from '@/features/vendor/containers/VendorRequests';

export default function VendorRequestsTab() {
  return (
    <VendorRequests
      onOpen={(r) => {
        router.push({ pathname: '/vendor/request/[id]', params: { id: r.id } });
      }}
    />
  );
}
