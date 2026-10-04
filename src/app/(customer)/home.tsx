import { useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useModeSwitcher } from '@/features/mode/hooks/useModeSwitcher';
import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';
import { CustomerShell } from '@/features/customer/screens/CustomerShell';
import { api } from '@/shared/api/instance';
import { probeAuthedCall } from '@/shared/api/probe';

// Phase 0 only: proves Bearer + the API client end to end. Removed in Phase 1/4 cleanup.
export default function CustomerHomeRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useAuth((s) => s.signOut);
  const { modes, choose } = useModeSwitcher(state.status === 'signedIn' ? state.userId : null);
  const [probe, setProbe] = useState('API check: running…');

  useEffect(() => {
    void probeAuthedCall(api).then((r) => {
      setProbe(r.ok ? 'API check: ok' : `API check: ${r.error.kind}`);
    });
  }, []);

  return (
    <CustomerShell
      identity={state.status === 'signedIn' ? state.email : ''}
      footnote={probe}
      onSignOut={() => {
        void signOut();
      }}
    >
      <ModeSwitcher modes={modes} current="customer" onChoose={choose} />
    </CustomerShell>
  );
}
