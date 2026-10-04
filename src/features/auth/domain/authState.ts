export type SessionLite = { userId: string; email: string };

export type AuthState =
  { status: 'loading' } | { status: 'signedOut' } | ({ status: 'signedIn' } & SessionLite);

export type SessionEvent =
  | { type: 'INITIAL_SESSION'; session: SessionLite | null }
  | { type: 'SIGNED_IN'; session: SessionLite }
  | { type: 'TOKEN_REFRESHED'; session: SessionLite | null }
  | { type: 'USER_UPDATED'; session: SessionLite | null }
  | { type: 'SIGNED_OUT' };

export function reduceAuth(state: AuthState, event: SessionEvent): AuthState {
  switch (event.type) {
    case 'INITIAL_SESSION':
      return event.session ? { status: 'signedIn', ...event.session } : { status: 'signedOut' };
    case 'SIGNED_IN':
      return { status: 'signedIn', ...event.session };
    case 'TOKEN_REFRESHED':
    case 'USER_UPDATED':
      return event.session ? { status: 'signedIn', ...event.session } : state;
    case 'SIGNED_OUT':
      return { status: 'signedOut' };
  }
}
