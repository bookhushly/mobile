/** A latch: the first `run(fn)` calls `fn`, every later call is ignored. */
export function onceGuard(): (fn: () => void) => void {
  let done = false;
  return (fn) => {
    if (done) return;
    done = true;
    fn();
  };
}
