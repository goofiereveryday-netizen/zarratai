import type { Table } from "dexie";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  getOfflineDatabase,
  getPendingSyncCount,
  notifyLocalDataChanged,
  recordTimestamp,
  type OutboxEntry,
  type SyncRecord,
  type SyncTableName,
} from "./database";

const SYNC_TABLES: SyncTableName[] = [
  "farms",
  "consultations",
  "messages",
  "user_preferences",
];
const PULL_PAGE_SIZE = 500;

type AnySyncTable = Table<SyncRecord, string>;
type SyncSummary = {
  synced: number;
  pending: number;
  error?: string;
};

function tableFor(tableName: SyncTableName): AnySyncTable {
  const db = getOfflineDatabase();
  switch (tableName) {
    case "farms":
      return db.farms as unknown as AnySyncTable;
    case "consultations":
      return db.consultations as unknown as AnySyncTable;
    case "messages":
      return db.messages as unknown as AnySyncTable;
    case "user_preferences":
      return db.userPreferences as unknown as AnySyncTable;
  }
}

function timestamp(record: {
  updated_at?: string | null;
  created_at?: string | null;
}): number {
  return Date.parse(recordTimestamp(record)) || 0;
}

function isOnline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine;
}

async function removeOutboxEntry(entry: OutboxEntry): Promise<void> {
  if (entry.id !== undefined) await getOfflineDatabase().outbox.delete(entry.id);
}

async function keepOutboxEntry(entry: OutboxEntry, reason: string): Promise<void> {
  if (entry.id === undefined) return;
  await getOfflineDatabase().outbox.update(entry.id, {
    attempts: entry.attempts + 1,
    last_error: reason.slice(0, 300),
  });
}

async function pullRemoteRows(
  supabase: SupabaseClient,
  userId: string,
  remoteRows: Map<string, SyncRecord>,
): Promise<{ errors: string[]; changed: boolean }> {
  const errors: string[] = [];
  const db = getOfflineDatabase();
  let changed = false;

  for (const tableName of SYNC_TABLES) {
    const table = tableFor(tableName);
    const remoteIds = new Set<string>();
    let offset = 0;
    let completePull = false;
    while (!completePull) {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .range(offset, offset + PULL_PAGE_SIZE - 1);
      if (error) {
        console.warn(`Could not pull ${tableName}:`, error.message);
        errors.push(tableName);
        break;
      }
      const page = data ?? [];
      for (const rawRow of page) {
        const remote = rawRow as unknown as SyncRecord;
        if (!remote.id || remote.user_id !== userId) continue;
        remoteIds.add(remote.id);
        remoteRows.set(`${tableName}:${remote.id}`, remote);

        const queued = await db.outbox
          .where("[user_id+table+entity_id]")
          .equals([userId, tableName, remote.id])
          .first();

        if (queued?.operation === "delete") {
          if (timestamp({ created_at: queued.created_at }) >= timestamp(remote)) {
            continue;
          }
          await removeOutboxEntry(queued);
        }

        const local = await table.get(remote.id);
        if (local && timestamp(local) > timestamp(remote)) continue;

        if (!local || JSON.stringify(local) !== JSON.stringify(remote)) changed = true;
        await table.put(remote);
        if (queued?.operation === "upsert") await removeOutboxEntry(queued);
      }
      completePull = page.length < PULL_PAGE_SIZE;
      offset += PULL_PAGE_SIZE;
    }

    if (!completePull) continue;
    const localRows = await table.where("user_id").equals(userId).toArray();
    for (const local of localRows) {
      if (remoteIds.has(local.id)) continue;
      const queued = await db.outbox
        .where("[user_id+table+entity_id]")
        .equals([userId, tableName, local.id])
        .first();
      if (queued?.operation === "upsert") continue;
      await table.delete(local.id);
      if (queued?.operation === "delete") await removeOutboxEntry(queued);
      changed = true;
    }
  }
  return { errors, changed };
}

async function pushOutbox(
  supabase: SupabaseClient,
  userId: string,
  remoteRows: Map<string, SyncRecord>,
): Promise<{ synced: number; failed: boolean }> {
  const db = getOfflineDatabase();
  const entries = await db.outbox.where("user_id").equals(userId).sortBy("id");
  let synced = 0;
  let failed = false;

  for (const entry of entries) {
    const table = tableFor(entry.table);
    const remote = remoteRows.get(`${entry.table}:${entry.entity_id}`);

    if (entry.operation === "delete") {
      if (remote && timestamp(remote) > timestamp({ created_at: entry.created_at })) {
        await table.put(remote);
        await removeOutboxEntry(entry);
        synced += 1;
        continue;
      }
      const { error } = await supabase
        .from(entry.table)
        .delete()
        .eq("id", entry.entity_id)
        .eq("user_id", userId);
      if (error) {
        await keepOutboxEntry(entry, error.message);
        failed = true;
        break;
      }
      await removeOutboxEntry(entry);
      synced += 1;
      continue;
    }

    const local = await table.get(entry.entity_id);
    if (!local || local.user_id !== userId) {
      await removeOutboxEntry(entry);
      continue;
    }
    if (remote && timestamp(remote) > timestamp(local)) {
      await table.put(remote);
      await removeOutboxEntry(entry);
      synced += 1;
      continue;
    }

    const { error } = await supabase
      .from(entry.table)
      .upsert(local as never, { onConflict: "id" });
    if (error) {
      await keepOutboxEntry(entry, error.message);
      failed = true;
      break;
    }
    await removeOutboxEntry(entry);
    synced += 1;
  }

  return { synced, failed };
}

let syncInFlight = new Map<string, Promise<SyncSummary>>();

export function syncUserData(userId: string): Promise<SyncSummary> {
  const existing = syncInFlight.get(userId);
  if (existing) return existing;

  const task = runSync(userId).finally(() => syncInFlight.delete(userId));
  syncInFlight.set(userId, task);
  return task;
}

async function runSync(userId: string): Promise<SyncSummary> {
  const db = getOfflineDatabase();
  if (!isOnline()) {
    return { synced: 0, pending: await getPendingSyncCount(userId) };
  }

  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user || session.user.id !== userId) {
    return { synced: 0, pending: await getPendingSyncCount(userId), error: "Authentication changed; sync paused." };
  }

  const remoteRows = new Map<string, SyncRecord>();
  const pullResult = await pullRemoteRows(supabase, userId, remoteRows);
  const pushResult = await pushOutbox(supabase, userId, remoteRows);
  const pending = await getPendingSyncCount(userId);
  if (pushResult.synced > 0 || pullResult.changed) notifyLocalDataChanged();

  return {
    synced: pushResult.synced,
    pending,
    ...(pushResult.failed || pullResult.errors.length > 0
      ? { error: pushResult.failed ? "Some changes are still waiting to sync." : "Some cloud data could not be refreshed." }
      : {}),
  };
}

export async function getSyncPendingCount(userId: string): Promise<number> {
  return getPendingSyncCount(userId);
}
