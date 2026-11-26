import { router, useLocalSearchParams } from 'expo-router';

import { VendorQuote } from '@/features/vendor/screens/VendorRequestsContainers';

export default function VendorQuoteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VendorQuote
      id={typeof id === 'string' ? id : ''}
      onBack={() => {
        router.back();
      }}
      // Back to the request, which now shows the quote as sent.
      onSent={() => {
        router.back();
      }}
    />
  );
}
