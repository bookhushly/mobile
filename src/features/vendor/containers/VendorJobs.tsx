import { useState } from 'react';

import type { JobTab, VendorJob as JobItem } from '@/features/vendor/domain/jobs';

import { useVendorJobs } from '@/features/vendor/hooks/useVendorJobs';

import { JobsScreen } from '@/features/vendor/screens/JobsScreen';
import { clock } from '@/shared/api/instance';

import { useWho } from '@/features/vendor/hooks/useVendorScreen';

export function VendorJobs({ onOpen }: { onOpen: (j: JobItem) => void }) {
  const q = useVendorJobs(useWho());
  const [tab, setTab] = useState<JobTab>('upcoming');
  const [refreshing, setRefreshing] = useState(false);
  return (
    <JobsScreen
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
                jobs: q.data,
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
