type Deps = {
  remote: () => Promise<{ error: unknown }>;
  removeLocal: () => Promise<void>;
  onSignedOut: () => void;
};

/** The local session could not be removed: the user is still signed in on this device. */
export class SignOutIncomplete extends Error {
  constructor() {
    super('sign-out incomplete: local session not removed');
  }
}

/**
 * Sign out succeeds locally even offline with an expired token, but only reports success once
 * the local session is really gone (a shared phone must not sign the last user back in at the
 * next launch). Removing it is retried once; if that fails too, `SignOutIncomplete` is thrown
 * and `onSignedOut` (and so the sign-out wipes) never runs.
 */
export async function performSignOut(deps: Deps): Promise<void> {
  let failed = false;
  try {
    // Success clears the local session itself.
    failed = (await deps.remote()).error !== null;
  } catch {
    failed = true;
  }
  if (failed) {
    try {
      await deps.removeLocal();
    } catch {
      try {
        await deps.removeLocal();
      } catch {
        throw new SignOutIncomplete();
      }
    }
  }
  deps.onSignedOut();
}
