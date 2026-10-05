import { createLogger } from './logger';

// The single sanctioned console user in the app.
export const log = createLogger(
  (l) => {
    if (!__DEV__) return;
    // eslint-disable-next-line no-console
    console[l.level === 'debug' ? 'info' : l.level](l.msg, l.data ?? '');
  },
  { production: !__DEV__ },
);
