import { router } from 'expo-router';

import { VendorTodayScreen } from '@/features/vendor/screens/VendorTodayScreen';

export default function VendorToday() {
  return (
    <VendorTodayScreen
      onOpenRequests={() => {
        router.navigate('/vendor/requests');
      }}
      onOpenRequest={(id) => {
        router.push({ pathname: '/vendor/request/[id]', params: { id } });
      }}
      onOpenJobs={() => {
        router.navigate('/vendor/jobs');
      }}
      onOpenJob={(id) => {
        router.push({ pathname: '/vendor/job/[id]', params: { id } });
      }}
      onOpenBookings={() => {
        router.navigate('/vendor/bookings');
      }}
      onOpenBooking={(id) => {
        router.push({ pathname: '/vendor/booking/[id]', params: { id } });
      }}
      onOpenEvents={() => {
        router.navigate('/vendor/events');
      }}
      onOpenEarnings={() => {
        router.navigate('/vendor/earnings');
      }}
    />
  );
}
