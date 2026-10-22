import Dexie, { type Table } from "dexie";
import type { Farm } from "@/lib/farms";
import type {
  Consultation,
  ConsultationMessage,
} from "@/lib/consultations";

export const OFFLINE_DATA_CHANGED_EVENT = "zarratai:offline-data-changed";
export const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;

export type SyncTableName =
  | "farms"
  | "consultations"
  | "messages"
  | "user_preferences";
export type SyncRecord =
  | Farm
  | Consultation
  | ConsultationMessage
  | UserPreference;
export type SyncOperation = "upsert" | "delete";

export type UserPreference = {
  id: string;
  user_id: string;
  preference_key: string;
  value: unknown;
  created_at: string;
  updated_at: string;
};

export type OutboxEntry = {
  id?: number;
  user_id: string;
  table: SyncTableName;
  entity_id: string;
  operation: SyncOperation;
  payload: SyncRecord | null;
  created_at: string;
  attempts: number;
  last_error: string | null;
};

export type WeatherCacheEntry<T = unknown> = {
  key: string;
  data: T;
  cached_at: number;
  expires_at: number;
};

type AnySyncTable = Table<SyncRecord, string>;

class ZarratOfflineDatabase extends Dexie {
  farms!: Table<Farm, string>;
  consultations!: Table<Consultation, string>;
  messages!: Table<ConsultationMessage, string>;
  userPreferences!: Table<UserPreference, string>;
  outbox!: Table<OutboxEntry, number>;
  weatherCache!: Table<WeatherCacheEntry, string>;

  constructor() {
    super("zarratai-offline-v1");
    this.version(1).stores({
      farms: "&id,user_id,created_at,updated_at,[user_id+created_at]",
      consultations:
        "&id,user_id,farm_id,status,created_at,updated_at,[user_id+farm_id+status],[user_id+created_at]",
      messages:
        "&id,user_id,consultation_id,created_at,[user_id+consultation_id],[user_id+consultation_id+created_at]",
      userPreferences:
        "&id,user_id,preference_key,updated_at,[user_id+preference_key]",
      outbox:
        "++id,user_id,table,entity_id,operation,created_at,[user_id+created_at],[user_id+table+entity_id]",
      weatherCache: "&key,expires_at",
    });
  }
}

let database: ZarratOfflineDatabase | null = null;

export function getOfflineDatabase(): ZarratOfflineDatabase {
  if (typeof indexedDB === "undefined") {
    throw new Error("Offline storage is only available in a browser or Tauri WebView.");
  }
  if (!database) database = new ZarratOfflineDatabase();
  return database;
}

function getSyncTable(name: SyncTableName): AnySyncTable {
  const db = getOfflineDatabase();
  switch (name) {
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

async function replaceOutboxMutation(
  db: ZarratOfflineDatabase,
  entry: Omit<OutboxEntry, "id" | "attempts" | "last_error">,
): Promise<void> {
  await db.outbox
    .where("[user_id+table+entity_id]")
    .equals([entry.user_id, entry.table, entry.entity_id])
    .delete();
  await db.outbox.add({ ...entry, attempts: 0, last_error: null });
}

export async function saveLocalRecord<T extends SyncRecord>(
  tableName: SyncTableName,
  row: T,
): Promise<void> {
  const db = getOfflineDatabase();
  const table = getSyncTable(tableName);
  const record = row as SyncRecord;
  await db.transaction("rw", table, db.outbox, async () => {
    await table.put(record);
    await replaceOutboxMutation(db, {
      user_id: record.user_id,
      table: tableName,
      entity_id: record.id,
      operation: "upsert",
      payload: record,
      created_at: recordTimestamp(record),
    });
  });
  notifyLocalDataChanged();
}

export async function deleteLocalRecord(
  tableName: SyncTableName,
  userId: string,
  entityId: string,
  deletedAt = new Date().toISOString(),
): Promise<void> {
  const db = getOfflineDatabase();
  const table = getSyncTable(tableName);
  await db.transaction("rw", table, db.outbox, async () => {
    const existing = await table.get(entityId);
    if (existing?.user_id === userId) await table.delete(entityId);
    await replaceOutboxMutation(db, {
      user_id: userId,
      table: tableName,
      entity_id: entityId,
      operation: "delete",
      payload: null,
      created_at: deletedAt,
    });
  });
  notifyLocalDataChanged();
}

export async function selectLocalFarm(
  userId: string,
  selectedFarmId: string,
): Promise<boolean> {
  const db = getOfflineDatabase();
  const now = new Date().toISOString();
  let selectedFound = false;
  await db.transaction("rw", db.farms, db.outbox, async () => {
    const farms = await db.farms.where("user_id").equals(userId).toArray();
    const selected = farms.find((farm) => farm.id === selectedFarmId);
    if (!selected) return;
    selectedFound = true;
    for (const farm of farms) {
      const next = { ...farm, is_selected: farm.id === selectedFarmId, updated_at: now };
      if (farm.is_selected !== next.is_selected) {
        await db.farms.put(next);
        await replaceOutboxMutation(db, {
          user_id: userId,
          table: "farms",
          entity_id: next.id,
          operation: "upsert",
          payload: next,
          created_at: now,
        });
      }
    }
  });
  if (selectedFound) notifyLocalDataChanged();
  return selectedFound;
}

export async function getLocalFarms(userId: string): Promise<Farm[]> {
  return getOfflineDatabase().farms
    .where("user_id")
    .equals(userId)
    .sortBy("created_at");
}

export async function getLocalFarm(userId: string, farmId: string): Promise<Farm | null> {
  const row = await getOfflineDatabase().farms.get(farmId);
  return row?.user_id === userId ? row : null;
}

export async function getLocalSelectedFarm(userId: string): Promise<Farm | null> {
  const farms = await getLocalFarms(userId);
  return farms.find((farm) => farm.is_selected) ?? null;
}

export async function getLocalConsultations(userId: string): Promise<Consultation[]> {
  return getOfflineDatabase().consultations
    .where("user_id")
    .equals(userId)
    .toArray()
    .then((rows) => rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")));
}

export async function getLocalConsultation(
  userId: string,
  consultationId: string,
): Promise<Consultation | null> {
  const row = await getOfflineDatabase().consultations.get(consultationId);
  return row?.user_id === userId ? row : null;
}

export async function getLocalActiveConsultation(
  userId: string,
  farmId: string,
): Promise<Consultation | null> {
  const rows = await getOfflineDatabase().consultations
    .where("[user_id+farm_id+status]")
    .equals([userId, farmId, "active"])
    .toArray();
  return rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0] ?? null;
}

export async function getLocalMessages(
  userId: string,
  consultationId: string,
): Promise<ConsultationMessage[]> {
  const rows = await getOfflineDatabase().messages
    .where("[user_id+consultation_id]")
    .equals([userId, consultationId])
    .toArray();
  return rows.sort((a, b) => {
    const byTime = (a.created_at ?? "").localeCompare(b.created_at ?? "");
    return byTime || a.id.localeCompare(b.id);
  });
}

export async function getLocalPreference<T = unknown>(
  userId: string,
  preferenceKey: string,
): Promise<T | null> {
  const row = await getOfflineDatabase().userPreferences
    .where("[user_id+preference_key]")
    .equals([userId, preferenceKey])
    .first();
  return (row?.value as T | undefined) ?? null;
}

export async function saveLocalPreference(
  userId: string,
  preferenceKey: string,
  value: unknown,
): Promise<void> {
  const db = getOfflineDatabase();
  const now = new Date().toISOString();
  const compoundKey = [userId, preferenceKey];
  await db.transaction("rw", db.userPreferences, db.outbox, async () => {
    const current = await db.userPreferences
      .where("[user_id+preference_key]")
      .equals(compoundKey)
      .first();
    const row: UserPreference = {
      id: current?.id ?? `${userId}:${preferenceKey}`,
      user_id: userId,
      preference_key: preferenceKey,
      value,
      created_at: current?.created_at ?? now,
      updated_at: now,
    };
    await db.userPreferences.put(row);
    await replaceOutboxMutation(db, {
      user_id: userId,
      table: "user_preferences",
      entity_id: row.id,
      operation: "upsert",
      payload: row,
      created_at: now,
    });
  });
  notifyLocalDataChanged();
}

export async function getWeatherCache<T>(key: string): Promise<WeatherCacheEntry<T> | null> {
  return ((await getOfflineDatabase().weatherCache.get(key)) as WeatherCacheEntry<T> | undefined) ?? null;
}

export async function setWeatherCache<T>(key: string, data: T): Promise<void> {
  const now = Date.now();
  await getOfflineDatabase().weatherCache.put({
    key,
    data,
    cached_at: now,
    expires_at: now + WEATHER_CACHE_TTL_MS,
  });
}

export async function getPendingSyncCount(userId: string): Promise<number> {
  return getOfflineDatabase().outbox.where("user_id").equals(userId).count();
}

export function notifyLocalDataChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OFFLINE_DATA_CHANGED_EVENT));
  }
}

export function recordTimestamp(record: {
  updated_at?: string | null;
  created_at?: string | null;
}): string {
  return record.updated_at ?? record.created_at ?? new Date(0).toISOString();
}
