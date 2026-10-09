// One sentence for every transient failure (429, 503 without `code`, timeout, network) in the
// account screens: shown in a neutral banner, never red, never as a refusal (spec §5).
export function transientMessage(retryAfterSec?: number): string {
  const when =
    retryAfterSec === undefined
      ? 'a minute'
      : `${String(retryAfterSec)} ${retryAfterSec === 1 ? 'second' : 'seconds'}`;
  return `We couldn’t reach Bookhushly — try again in ${when}`;
}
