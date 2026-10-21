import { useRef, useState } from 'react';

import { validatePromo } from '@/features/customer/api/checkoutApi';
import { api } from '@/shared/api/instance';

// Spec P9: a preview only. The server re-validates the code at create and prices it itself.

export type AppliedPromo = {
  codeId: string;
  code: string;
  discount: number;
  /** The estimate the preview was asked for; a different total needs the code applied again. */
  forAmount: number;
};

export type PromoState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'applied'; promo: AppliedPromo }
  | { phase: 'invalid'; words: string }
  | { phase: 'error'; words: string };

const COULD_NOT_CHECK = 'Couldn’t check this code. Try again';
const IDLE: PromoState = { phase: 'idle' };

function errorText(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('error' in body)) return null;
  const e: unknown = body.error;
  return typeof e === 'string' && e.trim() !== '' ? e : null;
}

export function usePromo(
  serviceType: 'hotel' | 'event',
  serviceId: string,
): {
  state: PromoState;
  apply: (code: string, amount: number) => Promise<void>;
  remove: () => void;
} {
  const [state, setState] = useState<PromoState>(IDLE);
  const inFlight = useRef(false);

  const apply = async (raw: string, amount: number): Promise<void> => {
    const code = raw.trim();
    if (code === '' || inFlight.current) return;
    inFlight.current = true;
    setState({ phase: 'checking' });
    const r = await validatePromo(api, {
      code,
      service_type: serviceType,
      service_id: serviceId,
      amount,
    });
    inFlight.current = false;
    if (r.ok) {
      setState(
        r.value.valid
          ? {
              phase: 'applied',
              promo: {
                codeId: r.value.code_id,
                code: r.value.code,
                discount: r.value.discount_amount,
                forAmount: amount,
              },
            }
          : { phase: 'invalid', words: r.value.error },
      );
      return;
    }
    // A 400 carries the server's words; 404 is the listing gone. Anything transient is never a
    // refusal (P14).
    const e = r.error;
    const words =
      e.kind === 'notFound'
        ? 'This code doesn’t apply here'
        : e.kind === 'unknown' && e.status === 400
          ? errorText(e.body)
          : null;
    setState(
      words === null ? { phase: 'error', words: COULD_NOT_CHECK } : { phase: 'invalid', words },
    );
  };

  return {
    state,
    apply,
    remove: () => {
      setState(IDLE);
    },
  };
}
