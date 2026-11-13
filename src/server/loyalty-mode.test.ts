import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import { setDatabasePoolForTests, closeDatabase } from "./database.ts";
import { awardPoints, getWallet, redeemReward } from "./rewards-service.ts";
import {
  getClientLoyaltySettings,
  parsePointsPerDollar,
  updateClientLoyaltySettings,
} from "./loyalty-settings-service.ts";
import type { SessionUser } from "./auth.ts";

const platform: SessionUser = {
  id: "usr_platform",
  businessId: "biz_platform",
  locationId: "loc_platform",
  role: "owner",
  name: "Platform",
  email: "platform@example.com",
  memberCode: null,
  platformAdmin: true,
};
const owner: SessionUser = {
  id: "usr_owner",
  businessId: "biz_client",
  locationId: "loc_client",
  role: "owner",
  name: "Owner",
  email: "owner@example.com",
  memberCode: null,
  platformAdmin: false,
};
const member: SessionUser = {
  id: "usr_member",
  businessId: "biz_client",
  locationId: "loc_client",
  role: "member",
  name: "Member",
  email: "member@example.com",
  memberCode: "ELITE-MEMBER",
  platformAdmin: false,
};

describe("per-business points or visits", () => {
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
    const { Pool } = memory.adapters.createPg();
    const pool = new Pool() as unknown as pg.Pool;
    setDatabasePoolForTests(pool);
    for (const file of [
      "001_production_rewards.sql",
      "002_platform_clients.sql",
      "006_editable_rewards.sql",
    ]) {
      await pool.query(await readFile(join(process.cwd(), "migrations", file), "utf8"));
    }
    await pool.query(
      await readFile(
        join(process.cwd(), "migrations", "009_public_enrollment_and_products.sql"),
        "utf8",
      ),
    );
    await pool.query(
      "ALTER TABLE business_products ADD COLUMN points_cost integer, ADD COLUMN visits_cost integer, ADD COLUMN image_data bytea, ADD COLUMN image_mime text",
    );
    await pool.query("ALTER TABLE businesses ADD COLUMN logo_url text");
    await pool.query("ALTER TABLE businesses ADD COLUMN logo_data bytea");
    await pool.query(
      "ALTER TABLE businesses ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now()",
    );
    await pool.query(
      "ALTER TABLE businesses ADD COLUMN primary_color text NOT NULL DEFAULT '#F6B900'",
    );
    await pool.query(
      "ALTER TABLE businesses ADD COLUMN secondary_color text NOT NULL DEFAULT '#FFE27A'",
    );
    await pool.query("ALTER TABLE businesses ADD COLUMN active boolean NOT NULL DEFAULT true");
    await pool.query(
      await readFile(join(process.cwd(), "migrations", "020_points_per_dollar.sql"), "utf8"),
    );
    await pool.query(
      "INSERT INTO businesses(id,name) VALUES ('biz_platform','Elite Rewards'),('biz_client','Client')",
    );
    await pool.query(
      "INSERT INTO platform_state(singleton,business_id) VALUES (true,'biz_platform')",
    );
    await pool.query(
      "INSERT INTO locations(id,business_id,name) VALUES ('loc_platform','biz_platform','HQ'),('loc_client','biz_client','Main')",
    );
    await pool.query(`INSERT INTO users(id,business_id,location_id,role,name,email,password_hash,member_code,platform_admin)
      VALUES ('usr_platform','biz_platform','loc_platform','owner','Platform','platform@example.com','test',NULL,true),
             ('usr_owner','biz_client','loc_client','owner','Owner','owner@example.com','test',NULL,false),
             ('usr_member','biz_client','loc_client','member','Member','member@example.com','test','ELITE-MEMBER',false)`);
    await pool.query(
      "CREATE TABLE platform_administrator(singleton boolean PRIMARY KEY, user_id text NOT NULL UNIQUE REFERENCES users(id))",
    );
    await pool.query(
      "INSERT INTO platform_administrator(singleton,user_id) VALUES (true,'usr_platform')",
    );
    await pool.query(
      "INSERT INTO member_balances(business_id,member_id,points,visits) VALUES ('biz_client','usr_member',500,0)",
    );
    await pool.query(
      "INSERT INTO rewards(id,business_id,name,description,points_cost,visits_cost) VALUES ('rew_client','biz_client','Free item','Visit reward',500,2)",
    );
  });
  after(async () => closeDatabase());

  it("keeps existing businesses on points at one point per dollar by default", async () => {
    assert.deepEqual(await getClientLoyaltySettings(platform, "biz_client"), {
      loyaltyMode: "points",
      pointsPerDollar: 1,
    });
    assert.equal((await getWallet(member)).balance, 500);
  });

  it("lets Elite switch a client to visits and uses the visit ledger", async () => {
    assert.equal(
      (await updateClientLoyaltySettings(platform, "biz_client", "visits", 5)).loyaltyMode,
      "visits",
    );
    await awardPoints(owner, {
      memberId: member.id,
      units: 3,
      amountCents: 2500,
      idempotencyKey: "visit-award-001",
    });
    const wallet = await getWallet(member);
    assert.equal(wallet.loyaltyMode, "visits");
    assert.equal(wallet.balance, 3);
    assert.equal(wallet.rewards[0]?.cost, 2);
    await redeemReward(member, { rewardId: "rew_client", idempotencyKey: "visit-redeem-001" });
    assert.equal((await getWallet(member)).balance, 1);
  });

  it("lets only the platform administrator change a client", async () => {
    await assert.rejects(
      () => updateClientLoyaltySettings(owner, "biz_client", "points", 5),
      /Platform administrator/,
    );
    assert.equal(
      (await updateClientLoyaltySettings(platform, "biz_client", "points", 5)).loyaltyMode,
      "points",
    );
    assert.equal((await getClientLoyaltySettings(platform, "biz_client")).pointsPerDollar, 5);
    await assert.rejects(
      () => updateClientLoyaltySettings(platform, "biz_platform", "points", 5),
      /Business not found/,
    );
  });

  it("calculates points from purchase cents and the business rate", async () => {
    const before = (await getWallet(member)).balance;
    const result = await awardPoints(owner, {
      memberId: member.id,
      amountCents: 1_099,
      idempotencyKey: "points-rate-award-001",
    });
    assert.equal(result.unitsAwarded, 54);
    assert.equal((await getWallet(member)).balance, before + 54);
  });

  it("validates the configurable points rate", () => {
    assert.equal(parsePointsPerDollar(1), 1);
    assert.equal(parsePointsPerDollar(1_000), 1_000);
    for (const invalid of [0, 1.5, 1_001, "5", null])
      assert.throws(() => parsePointsPerDollar(invalid), /whole number from 1 to 1,000/);
  });
});
