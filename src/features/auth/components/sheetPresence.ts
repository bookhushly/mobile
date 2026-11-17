// How many form sheets are mounted in the auth stack. A sheet that opens over another (Sign in to
// Create account) must not slide up from the bottom again: the white surface is already there,
// so only its content changes.
let open = 0;

/** Read during render: true when another sheet is already up. Pure, so safe to call twice. */
export function anotherSheetIsUp(): boolean {
  return open > 0;
}

/** From an effect: this sheet is up until the returned cleanup runs. */
export function holdSheet(): () => void {
  open += 1;
  return () => {
    open = Math.max(0, open - 1);
  };
}

/** True when this sheet is the only one, so leaving it goes back to Welcome. */
export function isOnlySheet(): boolean {
  return open <= 1;
}

/** Tests only. */
export function resetSheetsForTests(): void {
  open = 0;
}
