import type { ChipTone } from '@/features/customer/domain/myBookings';
import type { StatusTone } from '@/shared/theme';

// The domain's chip tones, as the kit's status tones (word + colour, never violet).
export function chipTone(t: ChipTone): StatusTone {
  switch (t) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'danger':
      return 'danger';
    case 'info':
      return 'info';
    case 'neutral':
      return 'neutral';
  }
}
