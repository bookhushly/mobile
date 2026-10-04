import * as Sentry from '@sentry/react-native';

import { env } from '@/shared/config/env';

export function initMonitoring(release: string): void {
  if (!env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    release,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.user) event.user = { id: event.user.id };
      delete event.request?.cookies;
      return event;
    },
  });
}

export function captureException(e: unknown): void {
  if (env.sentryDsn) Sentry.captureException(e);
}
