import { useState } from 'react';

import type { RequestTab, VendorRequest as RequestItem } from '@/features/vendor/domain/requests';

import { useVendorRequests } from '@/features/vendor/hooks/useVendorRequests';

import { RequestsScreen } from '@/features/vendor/screens/RequestsScreen';
import { clock } from '@/shared/api/instance';

import { useWho } from '@/features/vendor/hooks/useVendorScreen';

export function VendorRequests({ onOpen }: { onOpen: (r: RequestItem) => void }) {
  const q = useVendorRequests(useWho());
  const [tab, setTab] = useState<RequestTab>('new');
  const [refreshing, setRefreshing] = useState(false);
  return (
    <RequestsScreen
      nowMs={clock.serverNow()}
      tab={tab}
      onTab={setTab}
      onOpen={onOpen}
      state={
        q.isPending
          ? { status: 'loading' }
          : q.isError
            ? { status: 'error', retry: () => void q.refetch() }
            : {
                status: 'ready',
                requests: q.data,
                refreshing,
                refresh: () => {
                  setRefreshing(true);
                  void q.refetch().finally(() => {
                    setRefreshing(false);
                  });
                },
              }
      }
    />
  );
}
