import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
let pool: pg.Pool | undefined;
let migrationPromise: Promise<void> | undefined;

export function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL is required");
  pool = new Pool({
    connectionString,
    ssl: process.env["DATABASE_SSL"] === "true" ? { rejectUnauthorized: true } : false,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return pool;
}

export function setDatabasePoolForTests(testPool: pg.Pool): void {
  if (process.env["NODE_ENV"] === "production" && !process.env["NODE_TEST_CONTEXT"]) {
    throw new Error("Test database injection is disabled in production");
  }
  pool = testPool;
  migrationPromise = undefined;
}

export async function migrateDatabase(): Promise<void> {
  migrationPromise ??= (async () => {
    const database = getPool();
    await database.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version integer PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await database.query<{ version: number }>(
      "SELECT version FROM schema_migrations",
    );
    const versions = new Set(applied.rows.map((row) => row.version));
    const migrations = [
      [1, "001_production_rewards.sql"],
      [2, "002_platform_clients.sql"],
      [3, "003_member_enrollment.sql"],
    ] as const;
    for (const [version, filename] of migrations) {
      if (versions.has(version)) continue;
      const sql = await readFile(join(process.cwd(), "migrations", filename), "utf8");
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations(version) VALUES ($1) ON CONFLICT DO NOTHING",
          [version],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  })();
  return migrationPromise;
}

export function id(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export async function closeDatabase(): Promise<void> {
  if (pool) await pool.end();
  pool = undefined;
  migrationPromise = undefined;
}
