import { router, useLocalSearchParams } from 'expo-router';

import { VendorRequest } from '@/features/vendor/containers/VendorRequest';

export default function VendorRequestRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = typeof id === 'string' ? id : '';
  return (
    <VendorRequest
      id={requestId}
      onBack={() => {
        router.back();
      }}
      onQuote={() => {
        router.push({ pathname: '/vendor/request/[id]/quote', params: { id: requestId } });
      }}
      onOpenJobs={() => {
        router.navigate('/vendor/jobs');
      }}
    />
  );
}
