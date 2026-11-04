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
};
const member: SessionUser = {
  id: memberId,
  businessId,
  locationId,
  role: "member",
  name: "Test Member",
  email: "member@example.com",
  memberCode: "ELITE-TEST",
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
    const adapter = memory.adapters.createPg();
    const pool = new adapter.Pool() as unknown as pg.Pool;
    setDatabasePoolForTests(pool);
    const sql = await readFile(
      join(process.cwd(), "migrations", "001_production_rewards.sql"),
      "utf8",
    );
    await pool.query(sql.replaceAll("CREATE INDEX IF NOT EXISTS", "CREATE INDEX IF NOT EXISTS"));
    await pool.query("INSERT INTO businesses(id,name) VALUES ($1,'Test Business')", [businessId]);
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

  it("awards points once for the same idempotency key", async () => {
    const first = await awardPoints(owner, {
      memberId,
      points: 600,
      amountCents: 12000,
      idempotencyKey: "award-order-1001",
    });
    const duplicate = await awardPoints(owner, {
      memberId,
      points: 600,
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
          points: 601,
          amountCents: 12000,
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
