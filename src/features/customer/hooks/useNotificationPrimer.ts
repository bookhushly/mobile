import { useEffect, useState } from 'react';

import { shouldOfferPrimer } from '@/features/customer/domain/notificationPrimer';
import {
  readNotificationPermission,
  requestNotificationPermission,
  type NotificationPermission,
} from '@/shared/platform/notificationPermission';
import { plainKv } from '@/shared/platform/storage';

// Device-wide, like the OS permission itself; holds no personal data.
export const PRIMER_KEY = 'bh.notifPrimer';
const ASKED = '1';

export function useNotificationPrimer({
  customer,
  tourDone,
}: {
  customer: boolean;
  tourDone: boolean;
}): { open: boolean; accept: () => Promise<void>; dismiss: () => void } {
  const [asked, setAsked] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (!customer) return;
    let live = true;
    void Promise.all([
      plainKv.get(PRIMER_KEY).catch(() => ASKED),
      readNotificationPermission(),
    ]).then(([v, p]) => {
      if (!live) return;
      setAsked(v === ASKED);
      setPermission(p);
    });
    return () => {
      live = false;
    };
  }, [customer]);

  function close() {
    setAsked(true);
    void plainKv.set(PRIMER_KEY, ASKED).catch(() => undefined);
  }

  return {
    open: shouldOfferPrimer({ customer, tourDone, asked, permission }),
    accept: async () => {
      // Closed first, so the system prompt never appears over the primer.
      close();
      setPermission(await requestNotificationPermission());
    },
    dismiss: close,
  };
}
