type Deps = {
  remote: () => Promise<{ error: unknown }>;
  removeLocal: () => Promise<void>;
  onSignedOut: () => void;
};

/** Sign out must always succeed locally, even offline with an expired token. */
export async function performSignOut(deps: Deps): Promise<void> {
  let failed = false;
  try {
    failed = (await deps.remote()).error !== null;
  } catch {
    failed = true;
  }
  try {
    if (failed) await deps.removeLocal();
  } catch {
    // Storage that can't be cleared must not keep the user signed in (or skip the wipes).
  } finally {
    deps.onSignedOut();
  }
}
