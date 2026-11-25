import type { SecurityService } from '@/features/customer/domain/security/securityRequest';

// Unsplash option photos (assets/images/security/SOURCES.md): what each service looks like, never
// a company's real team.
export const SECURITY_PHOTO: Record<SecurityService, number> = {
  residential: require('../../../../../assets/images/security/residential.webp') as number,
  corporate: require('../../../../../assets/images/security/corporate.webp') as number,
  event_security: require('../../../../../assets/images/security/event.webp') as number,
  personal_security: require('../../../../../assets/images/security/personal.webp') as number,
  escort: require('../../../../../assets/images/security/escort.webp') as number,
};

export const SECURITY_CARD_PHOTO =
  require('../../../../../assets/images/security/security.webp') as number;
