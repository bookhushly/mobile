import type {
  Duration,
  GuardType,
  PropertySize,
  PropertyType,
  RiskLevel,
  SecurityService,
  Shift,
} from '@/features/customer/domain/security/securityRequest';

// The security flow's words: the web form's options (`security-questionnaire.jsx`), plainer.

export const SECURITY_SERVICE: Record<SecurityService, { label: string; line: string }> = {
  residential: { label: 'Home or estate', line: 'Houses, estates and apartments' },
  corporate: { label: 'Office or business', line: 'Offices, shops and premises' },
  event_security: { label: 'Event', line: 'Weddings, parties, conferences' },
  personal_security: { label: 'Personal protection', line: 'A bodyguard by your side' },
  escort: { label: 'Escort', line: 'Moving cash or valuables' },
};

export const DURATION: Record<Duration, string> = {
  hourly: 'A few hours',
  daily: 'Days',
  weekly: 'Weeks',
  monthly: 'Months',
  one_time: 'One event',
  ongoing: 'Ongoing',
};

export const GUARD: Record<GuardType, string> = {
  unarmed: 'Unarmed',
  armed: 'Armed',
  both: 'Both',
};

export const SHIFT: Record<Shift, string> = {
  day: 'Day (6 am–6 pm)',
  night: 'Night (6 pm–6 am)',
  '24_hours': 'Round the clock',
  rotating: 'Rotating',
};

export const PROPERTY: Record<PropertyType, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
  mixed: 'Mixed use',
};

export const SIZE: Record<PropertySize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  estate: 'Estate or complex',
};

export const RISK: Record<RiskLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

/** "2 unarmed guards · months". */
export function teamWords(t: {
  guards: number;
  guardType: GuardType | null;
  duration: Duration | null;
}): string {
  const kind =
    t.guardType === null || t.guardType === 'both' ? '' : `${GUARD[t.guardType].toLowerCase()} `;
  const guards = `${String(t.guards)} ${kind}${t.guards === 1 ? 'guard' : 'guards'}`;
  const mixed = t.guardType === 'both' ? ' (armed and unarmed)' : '';
  return t.duration === null
    ? `${guards}${mixed}`
    : `${guards}${mixed} · ${DURATION[t.duration].toLowerCase()}`;
}

/**
 * What a guide price is "per guard …" of (vendors' rate cards are per guard per hour, day, week or
 * month). Null for a one-off or ongoing job, where there's no clear unit and no guide is shown.
 */
export function priceUnit(d: Duration): string | null {
  switch (d) {
    case 'hourly':
      return 'an hour';
    case 'daily':
      return 'a day';
    case 'weekly':
      return 'a week';
    case 'monthly':
      return 'a month';
    case 'one_time':
    case 'ongoing':
      return null;
  }
}
