/**
 * C3 — offline check-in queue (IndexedDB, plain — no external lib).
 *
 * Lives on the device. When `navigator.onLine === false` (or the check-in
 * action throws a network error), we stash the entry here instead of dropping
 * it on the floor; the next online event drains the queue back through the
 * normal action. The schema already preserves the gap: each row carries the
 * client timestamp the user actually pressed the button, so `time_delta_ms`
 * stays honest even if it lands hours later.
 */

const DB_NAME = 'antagna-attendance';
const DB_VERSION = 1;
const STORE = 'queue';

export type QueuedCheckin = {
  id: string;
  type: 'in' | 'out';
  selfieBlob: Blob;
  lat: number | null;
  lng: number | null;
  clientTimestamp: number; // epoch ms
  createdAt: number; // epoch ms (queue entry creation)
};

function isIdbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIdbAvailable()) {
      reject(new Error('indexeddb_unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('idb_open_failed'));
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function uuidv4(): string {
  // crypto.randomUUID is available in modern browsers + Node 19+.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Cheap fallback (not crypto-strong; only used if randomUUID missing).
  return 'q-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function enqueue(
  entry: Omit<QueuedCheckin, 'id' | 'createdAt'>,
): Promise<string> {
  const db = await openDb();
  const id = uuidv4();
  const row: QueuedCheckin = { ...entry, id, createdAt: Date.now() };
  await new Promise<void>((resolve, reject) => {
    const r = tx(db, 'readwrite').add(row);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error ?? new Error('enqueue_failed'));
  });
  db.close();
  return id;
}

export async function listQueue(): Promise<QueuedCheckin[]> {
  if (!isIdbAvailable()) return [];
  try {
    const db = await openDb();
    const rows = await new Promise<QueuedCheckin[]>((resolve, reject) => {
      const r = tx(db, 'readonly').getAll();
      r.onsuccess = () => resolve((r.result ?? []) as QueuedCheckin[]);
      r.onerror = () => reject(r.error ?? new Error('list_failed'));
    });
    db.close();
    return rows;
  } catch {
    return [];
  }
}

export async function remove(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const r = tx(db, 'readwrite').delete(id);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error ?? new Error('delete_failed'));
  });
  db.close();
}

export async function queueLength(): Promise<number> {
  return (await listQueue()).length;
}
