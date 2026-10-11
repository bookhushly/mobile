import { DeskPlaceholderScreen } from '@/features/receptionist/screens/DeskPlaceholderScreen';

export default function ActivityRoute() {
  return (
    <DeskPlaceholderScreen
      back
      title="Shift activity"
      message="This session's check-ins and room changes arrive next."
    />
  );
}
