import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { newDb } from "pg-mem";
import type pg from "pg";

const bestBudzId = "biz_18fedc53-78d9-46bc-a8b0-8eb375154399";

async function database(includeBestBudz: boolean) {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool() as unknown as pg.Pool;
  await pool.query(`
    CREATE TABLE businesses (id text PRIMARY KEY);
    CREATE TABLE platform_state (singleton boolean PRIMARY KEY, business_id text NOT NULL REFERENCES businesses(id));
    CREATE TABLE business_products (
      id text PRIMARY KEY,
      business_id text NOT NULL REFERENCES businesses(id),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE audit_events (
      id text PRIMARY KEY,
      business_id text NOT NULL REFERENCES businesses(id),
      actor_user_id text,
      action text NOT NULL,
      target_type text NOT NULL,
      target_id text NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    INSERT INTO businesses(id) VALUES ('biz_platform');
    INSERT INTO platform_state(singleton,business_id) VALUES (true,'biz_platform');
  `);
  if (includeBestBudz) await pool.query("INSERT INTO businesses(id) VALUES ($1)", [bestBudzId]);
  return pool;
}

async function applyRepair(pool: pg.Pool) {
  await pool.query(
    await readFile(
      join(process.cwd(), "migrations", "017_repair_platform_product_tenant.sql"),
      "utf8",
    ),
  );
}

describe("platform product tenant repair", () => {
  it("moves orphaned platform products into the reported Best Budz customer catalog", async () => {
    const pool = await database(true);
    await pool.query(
      "INSERT INTO business_products(id,business_id) VALUES ('prd_robot','biz_platform')",
    );
    await applyRepair(pool);

    const product = await pool.query<{ business_id: string }>(
      "SELECT business_id FROM business_products WHERE id='prd_robot'",
    );
    assert.equal(product.rows[0]?.business_id, bestBudzId);
    const audit = await pool.query<{ action: string }>(
      "SELECT action FROM audit_events WHERE target_id='prd_robot'",
    );
    assert.equal(audit.rows[0]?.action, "business.product.tenant.repaired");
    await pool.end();
  });

  it("does not move data when the reported Best Budz tenant is absent", async () => {
    const pool = await database(false);
    await pool.query(
      "INSERT INTO business_products(id,business_id) VALUES ('prd_unassigned','biz_platform')",
    );
    await applyRepair(pool);

    const product = await pool.query<{ business_id: string }>(
      "SELECT business_id FROM business_products WHERE id='prd_unassigned'",
    );
    assert.equal(product.rows[0]?.business_id, "biz_platform");
    assert.equal((await pool.query("SELECT id FROM audit_events")).rowCount, 0);
    await pool.end();
  });
});
