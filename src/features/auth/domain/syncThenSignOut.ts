import type { SignOutCheck } from '@/shared/lib/signOutGuard';

type Deps = {
  sync: () => Promise<void>;
  signOut: () => Promise<{ blocked: SignOutCheck | null }>;
  report: (e: unknown) => void;
};

/** "Sync now" on a blocked sign-out: sync, then try again. Returns what still blocks, if anything. */
export async function syncThenSignOut(deps: Deps): Promise<SignOutCheck | null> {
  try {
    await deps.sync();
  } catch (e) {
    deps.report(e);
  }
  return (await deps.signOut()).blocked;
}
