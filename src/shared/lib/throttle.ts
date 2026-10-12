/**
 * Leading + trailing throttle: the first `call()` runs `fn` at once; calls inside the next `gapMs`
 * collapse into one run at the end of that gap. Runs are always at least `gapMs` apart.
 */
export function throttle(fn: () => void, gapMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastRun: number | undefined;
  let pending = false;
  const run = () => {
    lastRun = Date.now();
    pending = false;
    fn();
  };
  const arm = (delay: number) => {
    timer = setTimeout(() => {
      timer = undefined;
      if (pending) {
        run();
        arm(gapMs);
      }
    }, delay);
  };
  return {
    call() {
      if (timer !== undefined) {
        pending = true;
        return;
      }
      const since = lastRun === undefined ? Infinity : Date.now() - lastRun;
      if (since >= gapMs) {
        run();
        arm(gapMs);
      } else {
        pending = true;
        arm(gapMs - since);
      }
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
      pending = false;
    },
  };
}
