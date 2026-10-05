import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { gateKeys } from '@/features/gate/api/keys';
import { submitScan } from '@/features/gate/api/scan';
import { createScanSession, type ScanSession } from '@/features/gate/domain/scanSession';
import { useScanView } from '@/features/gate/state/scanView';
import { api, clock } from '@/shared/api/instance';
import { createFeedback } from '@/shared/platform/feedback';

// Lets the once-built session call the newest callback without reading a ref during render.
function latestCallback(initial: () => void) {
  let fn = initial;
  return {
    set: (next: () => void) => {
      fn = next;
    },
    call: () => {
      fn();
    },
  };
}

// One Feedback instance per scanner screen: it plays the cues and owns the mute preference.
export function useScanSession(
  eventId: string,
  opts: { onNotAssigned: () => void },
): { session: ScanSession; muted: boolean; toggleMute: () => void } {
  const qc = useQueryClient();
  const setView = useScanView((s) => s.set);
  // Holder so the session (built once) always calls the latest callback.
  const [notAssigned] = useState(() => latestCallback(opts.onNotAssigned));
  useEffect(() => {
    notAssigned.set(opts.onNotAssigned);
  }, [notAssigned, opts.onNotAssigned]);
  const [feedback] = useState(createFeedback);
  const [session] = useState(() =>
    createScanSession({
      submit: (code) => submitScan(api, eventId, code),
      now: () => clock.serverNow(),
      // Monotonic: hold times must not move when the wall clock or server offset does.
      localNow: () => performance.now(),
      random: Math.random,
      sleep: (ms) => new Promise<void>((r) => setTimeout(r, ms)),
      onChange: setView,
      onCue: (cue) => {
        feedback.cue(cue);
      },
      onAdmitted: () => {
        void qc.invalidateQueries({ queryKey: gateKeys.summary(eventId) });
      },
      onNotAssigned: notAssigned.call,
    }),
  );

  const [muted, setMuted] = useState(false);
  useEffect(() => {
    let live = true;
    void feedback.load().then(() => {
      if (live) setMuted(feedback.isMuted());
    });
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
      session.reset();
    },
    [session],
  );

  return { session, muted, toggleMute };
}
