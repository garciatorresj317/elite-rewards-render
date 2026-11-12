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
    CREATE TABLE business_products (
      id text PRIMARY KEY,
      business_id text NOT NULL REFERENCES businesses(id),
      active boolean NOT NULL DEFAULT true,
      archived_at timestamptz,
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

  `);
  if (includeBestBudz) await pool.query("INSERT INTO businesses(id) VALUES ($1)", [bestBudzId]);
  return pool;
}

async function applyRepair(pool: pg.Pool) {
  await pool.query(
    await readFile(
      join(process.cwd(), "migrations", "018_repair_best_budz_product_visibility.sql"),
      "utf8",
    ),
  );
}

describe("Best Budz product visibility repair", () => {
  it("publishes a hidden current Best Budz product without changing its tenant", async () => {
    const pool = await database(true);
    await pool.query(
      "INSERT INTO business_products(id,business_id,active) VALUES ('prd_robot',$1,false)",
      [bestBudzId],
    );
    await applyRepair(pool);

    const product = await pool.query<{ business_id: string }>(
      "SELECT business_id FROM business_products WHERE id='prd_robot'",
    );
    assert.equal(product.rows[0]?.business_id, bestBudzId);
    assert.equal(
      (
        await pool.query<{ active: boolean }>(
          "SELECT active FROM business_products WHERE id='prd_robot'",
        )
      ).rows[0]?.active,
      true,
    );
    const audit = await pool.query<{ action: string }>(
      "SELECT action FROM audit_events WHERE target_id='prd_robot'",
    );
    assert.equal(audit.rows[0]?.action, "business.product.visibility.repaired");
    await pool.end();
  });

  it("does not publish archived Best Budz products", async () => {
    const pool = await database(true);
    await pool.query(
      "INSERT INTO business_products(id,business_id,active,archived_at) VALUES ('prd_archived',$1,false,now())",
      [bestBudzId],
    );
    await applyRepair(pool);

    const product = await pool.query<{ business_id: string }>(
      "SELECT business_id FROM business_products WHERE id='prd_archived'",
    );
    assert.equal(product.rows[0]?.business_id, bestBudzId);
    assert.equal(
      (
        await pool.query<{ active: boolean }>(
          "SELECT active FROM business_products WHERE id='prd_archived'",
        )
      ).rows[0]?.active,
      false,
    );
    assert.equal((await pool.query("SELECT id FROM audit_events")).rowCount, 0);
    await pool.end();
  });
});
