import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

let _db: DrizzleClient | null = null;

function getDb(): DrizzleClient {
  if (_db) return _db;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  const queryClient = postgres(databaseUrl, { prepare: false, max: 10 });
  _db = drizzle(queryClient, { schema });
  return _db;
}

// Proxy so `db` keeps the same import-time API but defers connection setup
// until the first query. Next.js can then collect page data without the env
// being present at module load.
export const db = new Proxy({} as DrizzleClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

export type DB = DrizzleClient;
export { schema };
