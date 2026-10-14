// The Today card's main action: the rule lives in the domain (Explore's Today banner uses it too).
export {
  bookingAction as mainAction,
  type BookingAction as MainAction,
} from '@/features/customer/domain/todayBanner';
