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
    const lockClient = await database.connect();
    if (!process.env["NODE_TEST_CONTEXT"])
      await lockClient.query("SELECT pg_advisory_lock(1735552117)");
    try {
      await lockClient.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version integer PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
      const applied = await lockClient.query<{ version: number }>(
        "SELECT version FROM schema_migrations",
      );
      const versions = new Set(applied.rows.map((row) => row.version));
      const migrations = [
        [1, "001_production_rewards.sql"],
        [2, "002_platform_clients.sql"],
        [3, "003_member_enrollment.sql"],
        [4, "004_referrals_and_visual_themes.sql"],
        [5, "005_automatic_holiday_themes.sql"],
        [6, "006_editable_rewards.sql"],
        [7, "007_platform_client_customization.sql"],
        [8, "008_client_logos.sql"],
        [9, "009_public_enrollment_and_products.sql"],
        [10, "010_client_suspension.sql"],
        [11, "011_product_images_and_points.sql"],
        [12, "012_client_logo_10mb.sql"],
      ] as const;
      for (const [version, filename] of migrations) {
        if (versions.has(version)) continue;
        const sql = await readFile(join(process.cwd(), "migrations", filename), "utf8");
        try {
          await lockClient.query("BEGIN");
          await lockClient.query(sql);
          await lockClient.query(
            "INSERT INTO schema_migrations(version) VALUES ($1) ON CONFLICT DO NOTHING",
            [version],
          );
          await lockClient.query("COMMIT");
        } catch (error) {
          await lockClient.query("ROLLBACK");
          throw error;
        }
      }
    } finally {
      if (!process.env["NODE_TEST_CONTEXT"])
        await lockClient.query("SELECT pg_advisory_unlock(1735552117)").catch(() => undefined);
      lockClient.release();
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
