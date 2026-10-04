---
paths:
  - "src/lib/db/**"
  - "src/lib/storage/**"
  - "src/lib/supabase/**"
  - "src/lib/crypto/**"
  - "src/features/**/offline/**"
  - "src/features/auth/**"
---
# Storage, session, crypto, offline

- Secrets/tokens only in `expo-secure-store`, small values only. First-launch marker in non-secure storage: if absent but Keychain items exist (iOS survives uninstall), wipe them.
- Large/PII data: `expo-sqlite` with SQLCipher (`PRAGMA key` right after open), random 32-byte key in SecureStore, WAL, `PRAGMA user_version` migrations, async API, bulk writes in one exclusive transaction with prepared statements.
- Supabase session: AES key in SecureStore + encrypted session blob (SecureStore can't hold it); `AppState` → `startAutoRefresh`/`stopAutoRefresh`; `detectSessionInUrl: false`. Client checks are never authorisation.
- Outbox rows: client UUID + `(device_id, client_seq)`, state, attempts, backoff with jitter; delete only after server ack; written in the same transaction as the local change.
- Crypto: `@noble/curves` Ed25519 (strictness must match the server); **benchmark scrypt N=8192 on a low-end Android before committing** (fallback `react-native-quick-crypto`); verify with the KAT in requirements FR-3.15; XOR-accumulate compares. Never hand-roll primitives.
- No PII, tokens or ticket codes in logs/analytics. No secrets in `EXPO_PUBLIC_*`.
