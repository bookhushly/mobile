import * as Crypto from 'expo-crypto';

import { deleteDatabase, isWrongKey, openEncrypted } from '@/shared/db/expoSql';
import { migrate } from '@/shared/db/sql';
import { captureException } from '@/shared/monitoring';
import { secureKv } from '@/shared/platform/secureStore';

import { createDeviceStore, type DeviceStore } from './deviceStore';
import { createOutboxStore, type OutboxStore } from './outboxStore';
import { createRosterStore, type RosterStore } from './rosterStore';
import { MIGRATIONS } from './schema';

export type GateDb = { roster: RosterStore; outbox: OutboxStore; device: DeviceStore; close: () => Promise<void> };

// One encrypted database per account: a different account on this phone never sees, or syncs,
// another's admissions; "Sign in again" after a session expiry finds its outbox intact.
const fileOf = (userId: string) => `gate-${userId}.db`;
const keyName = (userId: string) => `bh.gate.dbkey.${userId}`;
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

async function keyFor(userId: string): Promise<string> {
  const existing = await secureKv.get(keyName(userId));
  if (existing !== null) return existing;
  // The async variant: the sync one may fall back to Math.random in development.
  const key = hex(await Crypto.getRandomBytesAsync(32));
  await secureKv.set(keyName(userId), key);
  return key;
}

export async function sweepExpired(roster: RosterStore, outbox: OutboxStore, nowMs: number): Promise<void> {
  for (const eventId of await roster.expired(nowMs)) {
    if (!(await outbox.hasUnsynced(eventId))) await roster.drop(eventId);
  }
}

async function open(userId: string): Promise<GateDb> {
  const key = await keyFor(userId);
  let conn: Awaited<ReturnType<typeof openEncrypted>>;
  try {
    conn = await openEncrypted(fileOf(userId), key);
  } catch (e) {
    // Only a key that cannot open the file (e.g. restored storage) justifies starting over.
    if (!isWrongKey(e)) throw e;
    captureException(e);
    await deleteDatabase(fileOf(userId)).catch(() => undefined);
    conn = await openEncrypted(fileOf(userId), key);
  }
  await migrate(conn.sql, MIGRATIONS);
  const roster = createRosterStore(conn.sql);
  const outbox = createOutboxStore(conn.sql, { newDeviceId: () => Crypto.randomUUID() });
  const device = createDeviceStore(conn.sql);
  await outbox.resetSending();
  await sweepExpired(roster, outbox, Date.now());
  return { roster, outbox, device, close: conn.close };
}

const opened = new Map<string, Promise<GateDb>>();

export function gateDb(userId: string): Promise<GateDb> {
  const cached = opened.get(userId);
  if (cached !== undefined) return cached;
  const p = open(userId);
  opened.set(userId, p);
  p.catch(() => {
    opened.delete(userId);
  });
  return p;
}

export async function hasGateDb(userId: string): Promise<boolean> {
  return (await secureKv.get(keyName(userId))) !== null;
}

export async function wipeGateDb(userId: string): Promise<void> {
  const p = opened.get(userId);
  opened.delete(userId);
  if (p !== undefined) {
    const db = await p.catch(() => null);
    await db?.close().catch(() => undefined);
  }
  await deleteDatabase(fileOf(userId)).catch(() => undefined);
  await secureKv.delete(keyName(userId));
}
