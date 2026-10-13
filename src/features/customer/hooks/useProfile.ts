import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import {
  customerDb,
  withSessionRetry,
  type ProfileInput,
} from '@/features/customer/api/customerDb';
import { CustomerLoadError, customerKeys } from '@/features/customer/hooks/customerKeys';
import {
  refreshSession,
  writeOutcome,
  type WriteOutcome,
} from '@/features/customer/hooks/sessionWrite';
import type { ProfileRow } from '@/features/customer/schemas/profile';
import { supabase } from '@/shared/supabase/client';

export function useProfile(userId: string): {
  profile: ProfileRow | null;
  loading: boolean;
  error: boolean;
  refetch: () => Promise<unknown>;
} {
  const q = useQuery({
    queryKey: customerKeys.profile(userId),
    queryFn: async () => {
      const r = await customerDb.profile(userId);
      if (!r.ok) throw new CustomerLoadError(r.error);
      return r.value;
    },
  });
  return {
    profile: q.data ?? null,
    loading: q.isPending,
    error: q.isError && q.data === undefined,
    refetch: q.refetch,
  };
}

export function useSaveProfile(userId: string): {
  /** `phone` is already E.164 or null (the sheet parses it). */
  save: (p: ProfileInput) => Promise<WriteOutcome>;
  saving: boolean;
} {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const save = useCallback(
    async (p: ProfileInput): Promise<WriteOutcome> => {
      // C14: only these four (plus updated_at in the db layer); never `role`.
      const input: ProfileInput = {
        name: p.name,
        phone: p.phone,
        state: p.state,
        address: p.address,
      };
      setSaving(true);
      try {
        const outcome = writeOutcome(
          await withSessionRetry(() => customerDb.saveProfile(userId, input), 1, refreshSession),
        );
        if (outcome !== 'ok') return outcome;
        const k = customerKeys.profile(userId);
        qc.setQueryData<ProfileRow | null>(k, (prev) =>
          prev === undefined || prev === null ? prev : { ...prev, ...input },
        );
        void qc.invalidateQueries({ queryKey: k }, { cancelRefetch: false });
        // Best effort: the users row is what the app reads; the auth metadata only mirrors it.
        try {
          await supabase.auth.updateUser({ data: { name: input.name } });
        } catch {
          // Ignored on purpose (see above).
        }
        return 'ok';
      } finally {
        setSaving(false);
      }
    },
    [qc, userId],
  );
  return { save, saving };
}
