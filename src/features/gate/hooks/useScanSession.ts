import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { gateKeys } from '@/features/gate/api/keys';
import { submitScan } from '@/features/gate/api/scan';
import { createScanSession, type ScanSession } from '@/features/gate/domain/scanSession';
import { useScanView } from '@/features/gate/state/scanView';
import { api, clock } from '@/shared/api/instance';
import { trailing } from '@/shared/lib/trailing';
import { createFeedback } from '@/shared/platform/feedback';

// After admissions the door counter refreshes once things go quiet, not once per guest.
const SUMMARY_REFRESH_MS = 2_000;

// One Feedback instance per scanner screen: it plays the cues and owns the mute preference.
export function useScanSession(eventId: string): {
  session: ScanSession;
  muted: boolean;
  toggleMute: () => void;
} {
  const qc = useQueryClient();
  const setView = useScanView((s) => s.set);
  const [feedback] = useState(createFeedback);
  const [refreshSummary] = useState(() =>
    trailing(() => {
      void qc.invalidateQueries({ queryKey: gateKeys.summary(eventId) });
    }, SUMMARY_REFRESH_MS),
  );
  const [session] = useState(() =>
    createScanSession({
      submit: (code) => submitScan(api, eventId, code),
      now: () => clock.serverNow(),
      // Monotonic: hold times and cooldowns must not move when the wall clock or server offset does.
      localNow: () => performance.now(),
      random: Math.random,
      sleep: (ms) => new Promise<void>((r) => setTimeout(r, ms)),
      onChange: setView,
      onCue: (cue) => {
        feedback.cue(cue);
      },
      onAdmitted: () => {
        refreshSummary.call();
      },
    }),
  );

  const [muted, setMuted] = useState(false);
  useEffect(() => {
    let live = true;
    void feedback
      .load()
      .then(() => {
        if (live) setMuted(feedback.isMuted());
      })
      .catch(() => undefined);
    return () => {
      live = false;
      feedback.release();
    };
  }, [feedback]);
  const toggleMute = useCallback(() => {
    const next = !feedback.isMuted();
    setMuted(next);
    void feedback.setMuted(next);
  }, [feedback]);

  // Timed overlays advance on their own deadline; no polling interval.
  const currentId = useScanView((s) => s.view.current?.id ?? null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      const deadline = session.nextDeadline();
      if (deadline === null) return;
      timer = setTimeout(
        () => {
          session.tick();
          arm();
        },
        Math.max(0, deadline - performance.now()),
      );
    };
    arm();
    return () => {
      clearTimeout(timer);
    };
  }, [session, currentId]);

  useEffect(
    () => () => {
      refreshSummary.cancel();
      session.reset();
    },
    [session, refreshSummary],
  );

  return { session, muted, toggleMute };
}
