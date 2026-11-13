import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import { hashPassword } from "./auth.ts";
import { closeDatabase, setDatabasePoolForTests } from "./database.ts";
import { awardPoints, getWallet, redeemReward } from "./rewards-service.ts";
import type { SessionUser } from "./auth.ts";

const businessId = "biz_test";
const locationId = "loc_test";
const ownerId = "usr_owner";
const memberId = "usr_member";
const rewardId = "rew_test";
const owner: SessionUser = {
  id: ownerId,
  businessId,
  locationId,
  role: "owner",
  name: "Test Owner",
  email: "owner@example.com",
  memberCode: null,
  platformAdmin: true,
};
const member: SessionUser = {
  id: memberId,
  businessId,
  locationId,
  role: "member",
  name: "Test Member",
  email: "member@example.com",
  memberCode: "ELITE-TEST",
  platformAdmin: false,
};

describe("production rewards ledger", () => {
  before(async () => {
    const memory = newDb({ autoCreateForeignKeyIndices: true });
    memory.public.registerFunction({
      name: "now",
      returns: DataType.timestamptz,
      implementation: () => new Date(),
    });
    memory.public.registerFunction({
      name: "char_length",
      args: [DataType.text],
      returns: DataType.integer,
      implementation: (value: string) => value.length,
    });
    memory.public.registerFunction({
      name: "octet_length",
      args: [DataType.bytea],
      returns: DataType.integer,
      implementation: (value: Buffer) => value.length,
    });
    const adapter = memory.adapters.createPg();
    const pool = new adapter.Pool() as unknown as pg.Pool;
    setDatabasePoolForTests(pool);
    const sql = await readFile(
      join(process.cwd(), "migrations", "001_production_rewards.sql"),
      "utf8",
    );
    await pool.query(sql.replaceAll("CREATE INDEX IF NOT EXISTS", "CREATE INDEX IF NOT EXISTS"));
    await pool.query(
      await readFile(join(process.cwd(), "migrations", "002_platform_clients.sql"), "utf8"),
    );
    await pool.query(
      await readFile(join(process.cwd(), "migrations", "006_editable_rewards.sql"), "utf8"),
    );
    await pool.query(
      await readFile(
        join(process.cwd(), "migrations", "009_public_enrollment_and_products.sql"),
        "utf8",
      ),
    );
    await pool.query(
      await readFile(join(process.cwd(), "migrations", "010_client_suspension.sql"), "utf8"),
    );
    await pool.query(
      await readFile(
        join(process.cwd(), "migrations", "011_product_images_and_points.sql"),
        "utf8",
      ),
    );
    await pool.query("ALTER TABLE businesses ADD COLUMN logo_url text");
    await pool.query("ALTER TABLE businesses ADD COLUMN logo_data bytea");
    await pool.query(
      await readFile(join(process.cwd(), "migrations", "020_points_per_dollar.sql"), "utf8"),
    );
    await pool.query(
      "ALTER TABLE businesses ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now()",
    );
    await pool.query(
      "ALTER TABLE businesses ADD COLUMN primary_color text NOT NULL DEFAULT '#F6B900'",
    );
    await pool.query(
      "ALTER TABLE businesses ADD COLUMN secondary_color text NOT NULL DEFAULT '#FFE27A'",
    );
    await pool.query(
      "INSERT INTO businesses(id,name,points_per_dollar) VALUES ($1,'Test Business',5)",
      [businessId],
    );
    await pool.query("INSERT INTO locations(id,business_id,name) VALUES ($1,$2,'Test Location')", [
      locationId,
      businessId,
    ]);
    const password = await hashPassword("a-secure-test-password");
    await pool.query(
      "INSERT INTO users(id,business_id,location_id,role,name,email,password_hash) VALUES ($1,$2,$3,'owner','Test Owner','owner@example.com',$4)",
      [ownerId, businessId, locationId, password],
    );
    await pool.query(
      "INSERT INTO users(id,business_id,location_id,role,name,email,password_hash,member_code) VALUES ($1,$2,$3,'member','Test Member','member@example.com',$4,'ELITE-TEST')",
      [memberId, businessId, locationId, password],
    );
    await pool.query("INSERT INTO member_balances(business_id,member_id,points) VALUES ($1,$2,0)", [
      businessId,
      memberId,
    ]);
    await pool.query(
      "INSERT INTO rewards(id,business_id,name,description,points_cost) VALUES ($1,$2,'Five off','Test reward',500)",
      [rewardId, businessId],
    );
  });
  after(async () => {
    await closeDatabase();
  });

  it("awards server-calculated points once for the same idempotency key", async () => {
    const first = await awardPoints(owner, {
      memberId,
      amountCents: 12000,
      idempotencyKey: "award-order-1001",
    });
    const duplicate = await awardPoints(owner, {
      memberId,
      amountCents: 12000,
      idempotencyKey: "award-order-1001",
    });
    assert.equal(first.duplicate, false);
    assert.equal(duplicate.duplicate, true);
    assert.equal((await getWallet(member)).points, 600);
    await assert.rejects(
      () =>
        awardPoints(owner, {
          memberId,
          amountCents: 12100,
          idempotencyKey: "award-order-1001",
        }),
      /different request/,
    );
    assert.equal((await getWallet(member)).points, 600);
  });

  it("redeems atomically, is idempotent, and refuses an overdraw", async () => {
    const first = await redeemReward(member, { rewardId, idempotencyKey: "redeem-order-1001" });
    const duplicate = await redeemReward(member, { rewardId, idempotencyKey: "redeem-order-1001" });
    assert.equal(first.duplicate, false);
    assert.equal(duplicate.duplicate, true);
    assert.equal((await getWallet(member)).points, 100);
    await assert.rejects(
      () => redeemReward(member, { rewardId: "rew_other", idempotencyKey: "redeem-order-1001" }),
      /different request/,
    );
    await assert.rejects(
      () => redeemReward(member, { rewardId, idempotencyKey: "redeem-order-1002" }),
      /Insufficient points/,
    );
    assert.equal((await getWallet(member)).points, 100);
  });
});
