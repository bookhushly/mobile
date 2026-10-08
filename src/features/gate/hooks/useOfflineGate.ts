import * as Network from 'expo-network';
import { useEffect, useMemo, useRef, useState } from 'react';

import { postBatch } from '@/features/gate/api/batch';
import { fetchRosterPage } from '@/features/gate/api/roster';
import { listExpiry } from '@/features/gate/domain/listExpiry';
import type { ScanQueueDeps } from '@/features/gate/domain/scanQueue';
import {
  createOfflineController,
  type OfflineController,
} from '@/features/gate/offline/controller';
import { gateDb } from '@/features/gate/offline/gateDb';
import { useSyncView } from '@/features/gate/state/syncView';
import { api, APP_VERSION, clock, clockGuard, connectivity } from '@/shared/api/instance';
import { captureException } from '@/shared/monitoring';

export type OfflineScanHooks = Pick<ScanQueueDeps, 'fallback' | 'skipOnline' | 'onLive'>;

export function useOfflineGate(p: {
  eventId: string;
  userId: string | null;
  focused: boolean;
  startsAt: string | null;
}): { scan: OfflineScanHooks; controller: OfflineController | null } {
  const { eventId, userId, focused } = p;
  const setSync = useSyncView((s) => s.set);
  const startsAt = useRef(p.startsAt);
  useEffect(() => {
    startsAt.current = p.startsAt;
  }, [p.startsAt]);

  // endsAt is read later, when a sync finishes, never during render (false positive for react-hooks/refs).
  // eslint-disable-next-line react-hooks/refs
  const [controller] = useState(() =>
    userId === null
      ? null
      : createOfflineController({
          eventId,
          db: () => gateDb(userId),
          fetchPage: (q) => fetchRosterPage(api, eventId, q),
          post: (deviceId, items) => postBatch(api, eventId, deviceId, items),
          serverNow: () => clock.serverNow(),
          clockState: () => clockGuard.state(),
          connectivity,
          endsAt: () => listExpiry(startsAt.current),
          appVersion: APP_VERSION,
          random: Math.random,
          publish: setSync,
          report: captureException,
        }),
  );

  useEffect(() => {
    if (controller === null || !focused) return;
    controller.start();
    return () => {
      controller.stop();
    };
  }, [controller, focused]);

  // The OS saying "no network" degrades at once; the server answering is what restores.
  useEffect(() => {
    const sub = Network.addNetworkStateListener((s) => {
      if (s.isConnected === false) connectivity.networkLost();
    });
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(
    () => () => {
      useSyncView.getState().reset();
    },
    [],
  );

  const scan = useMemo<OfflineScanHooks>(
    () =>
      controller === null
        ? {}
        : {
            fallback: controller.decide,
            skipOnline: connectivity.isDegraded,
            onLive: controller.noteLive,
          },
    [controller],
  );
  return { scan, controller };
}
