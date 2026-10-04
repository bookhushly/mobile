import * as Sentry from '@sentry/react-native';

import { env } from '@/shared/config/env';
import { scrubBreadcrumb, scrubEvent } from '@/shared/lib/scrub';

export function initMonitoring(release: string): void {
  if (!env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    release,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event),
    beforeBreadcrumb: (b) => scrubBreadcrumb(b),
  });
}

export function captureException(e: unknown): void {
  if (env.sentryDsn) Sentry.captureException(e);
}
