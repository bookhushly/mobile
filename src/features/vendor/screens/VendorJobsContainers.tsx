import { useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import type { JobTab, VendorJob as JobItem } from '@/features/vendor/domain/jobs';
import { useVendorSession } from '@/features/vendor/hooks/VendorContext';
import {
  jobErrorWords,
  useJobAction,
  useVendorJob,
  useVendorJobs,
} from '@/features/vendor/hooks/useVendorJobs';
import { VendorError } from '@/features/vendor/hooks/useVendorRequests';
import { JobScreen } from '@/features/vendor/screens/JobScreen';
import { JobsScreen } from '@/features/vendor/screens/JobsScreen';
import { clock } from '@/shared/api/instance';
import { deleteLocalFile } from '@/shared/platform/deleteLocalFile';

const SUPPORT = 'support@bookhushly.com';

function useWho() {
  const { vendor } = useVendorSession();
  return { vendorId: vendor.id, kind: vendor.kind };
}

/** Open a link the phone may not handle (no mail app on many iPads): say what to do instead. */
function openOr(url: string, title: string, fallback: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert(title, fallback);
  });
}

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

export function VendorJob({ id, onBack }: { id: string; onBack: () => void }) {
  const who = useWho();
  const q = useVendorJob(who, id);
  const action = useJobAction(who, id);
  return (
    <JobScreen
      busy={action.isPending}
      problem={action.isError ? jobErrorWords(action.error) : null}
      onBack={onBack}
      onHelp={() => {
        const subject = encodeURIComponent(`Job ${id}`);
        openOr(
          `mailto:${SUPPORT}?subject=${subject}`,
          'Get help',
          `Email ${SUPPORT} and mention job ${id}.`,
        );
      }}
      onCall={(phone) => {
        openOr(`tel:${phone}`, 'Call the customer', `Their number is ${phone}.`);
      }}
      onDirections={(address) => {
        const q2 = encodeURIComponent(address);
        openOr(
          Platform.OS === 'ios'
            ? `https://maps.apple.com/?daddr=${q2}`
            : `https://www.google.com/maps/dir/?api=1&destination=${q2}`,
          'Directions',
          `Search for ${address} in your maps app.`,
        );
      }}
      onAction={(a) => {
        if (action.isPending) return;
        action.mutate(a, {
          // The photo is uploaded (or the step refused): either way the local copy goes.
          onSettled: () => {
            if (a.kind === 'milestone' && a.photoUri !== null) deleteLocalFile(a.photoUri);
          },
        });
      }}
      state={
        q.isPending
          ? { status: 'loading' }
          : q.isError
            ? {
                status: 'error',
                notFound: q.error instanceof VendorError && q.error.kind === 'notFound',
                retry: () => void q.refetch(),
              }
            : { status: 'ready', job: q.data }
      }
    />
  );
}
