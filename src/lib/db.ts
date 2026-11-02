import { AsyncLocalStorage } from "async_hooks";
import { Pool, type PoolClient } from "pg";

/**
 * Database switch (M2 / ANT-18) — THE one place that knows whether the app
 * saves to Supabase Postgres or to the local .data files.
 *
 * - DATABASE_URL set  -> Postgres via the Supabase "transaction pooler"
 *   connection (port 6543), so many serverless requests share connections
 *   instead of running out. The service-side key/URL never reach the browser:
 *   this module is imported by server code only.
 * - DATABASE_URL empty -> every storage helper keeps using .data exactly as
 *   before, so plain `npm run dev` works with no cloud settings at all.
 *
 * Collections (tasks, history, ...) live as one JSONB document per kind in
 * `app_documents` (see supabase/schema.sql) — same shapes the pages already
 * use. Counters that must be right across several servers (rate limits,
 * the daily AI cap, AI usage) use their own small tables with atomic SQL.
 * Every table has Row Level Security ON and no public policies; only this
 * server-side connection (and the Storage service key) can touch the data.
 */

export function isDbEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

let pool: Pool | null = null;
let warnedAboutPort = false;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL!.trim();
  try {
    const url = new URL(connectionString);
    if (url.port && url.port !== "6543" && !warnedAboutPort) {
      warnedAboutPort = true;
      console.warn(
        `[db] DATABASE_URL uses port ${url.port}; the Supabase transaction pooler is port 6543 — use that online so serverless requests do not run out of connections.`,
      );
    }
  } catch {
    // A malformed URL fails clearly on the first query below.
  }
  // TLS is on by default (the Supabase pooler requires it). A local test
  // database may opt out with ?sslmode=disable in the connection string.
  let ssl: false | { rejectUnauthorized: false } = { rejectUnauthorized: false };
  try {
    if (new URL(connectionString).searchParams.get("sslmode") === "disable") ssl = false;
  } catch { /* keep TLS on */ }
  pool = new Pool({
    connectionString,
    max: 5,
    ssl,
  });
  return pool;
}

type Queryable = Pick<PoolClient, "query">;
const txClient = new AsyncLocalStorage<Queryable>();

/** Run one SQL statement (inside the current document transaction, if any). */
export async function dbQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = txClient.getStore();
  const result = client
    ? await client.query(sql, params as never[])
    : await getPool().query(sql, params as never[]);
  return result.rows as T[];
}

/**
 * Run `work` while holding a Postgres advisory lock for one document key,
 * in one transaction. Read-modify-write cycles of the same collection from
 * different servers therefore cannot lose each other's changes. Outside DB
 * mode this is a no-op (the helpers' own in-process lock already applies).
 */
export async function withDocLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  if (!isDbEnabled() || txClient.getStore()) return work();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`hotelapp:${key}`]);
    const value = await txClient.run(client, work);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** One named JSONB document (a whole collection), or null when absent. */
export async function dbGetDocument<T>(key: string): Promise<T | null> {
  const rows = await dbQuery<{ data: T }>(
    "SELECT data FROM app_documents WHERE key = $1",
    [key],
  );
  return rows.length ? rows[0].data : null;
}

/** Create or replace one named JSONB document (idempotent upsert). */
export async function dbSetDocument(key: string, data: unknown): Promise<void> {
  await dbQuery(
    `INSERT INTO app_documents (key, data, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [key, JSON.stringify(data)],
  );
}

export async function dbDeleteDocument(key: string): Promise<void> {
  await dbQuery("DELETE FROM app_documents WHERE key = $1", [key]);
}
