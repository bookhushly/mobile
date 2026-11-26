import { Platform } from 'react-native';

import { jobErrorWords, useJobAction, useVendorJob } from '@/features/vendor/hooks/useVendorJobs';
import { VendorError } from '@/features/vendor/hooks/useVendorRequests';
import { JobScreen } from '@/features/vendor/screens/JobScreen';

import { deleteLocalFile } from '@/shared/platform/deleteLocalFile';

import { openOr, SUPPORT_EMAIL, useWho } from '@/features/vendor/hooks/useVendorScreen';

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
          `mailto:${SUPPORT_EMAIL}?subject=${subject}`,
          'Get help',
          `Email ${SUPPORT_EMAIL} and mention job ${id}.`,
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
