/** `begin()` returns a check that is true only until the next `begin()`: drops superseded results. */
export function latestOnly(): { begin: () => () => boolean } {
  let n = 0;
  return {
    begin() {
      const mine = ++n;
      return () => n === mine;
    },
  };
}
