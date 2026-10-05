/** Trailing debounce: `fn` runs once, `waitMs` after the last `call()`. */
export function trailing(fn: () => void, waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    call() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        fn();
      }, waitMs);
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
