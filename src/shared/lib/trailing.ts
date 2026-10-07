/**
 * Trailing debounce: `fn` runs once, `waitMs` after the last `call()`. With `maxWaitMs` it also
 * runs at the latest that long after the first call of a burst, so steady calls cannot starve it.
 */
export function trailing(fn: () => void, waitMs: number, opts: { maxWaitMs?: number } = {}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let burstStart: number | undefined;
  return {
    call() {
      clearTimeout(timer);
      const now = Date.now();
      burstStart ??= now;
      const untilMax =
        opts.maxWaitMs === undefined ? waitMs : Math.max(0, burstStart + opts.maxWaitMs - now);
      timer = setTimeout(
        () => {
          timer = undefined;
          burstStart = undefined;
          fn();
        },
        Math.min(waitMs, untilMax),
      );
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
      burstStart = undefined;
    },
  };
}
