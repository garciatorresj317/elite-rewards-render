import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import type { SessionUser } from "./auth.ts";
import { closeDatabase, setDatabasePoolForTests } from "./database.ts";
import {
  archiveReward,
  createClientReward,
  createReward,
  listClientRewards,
  listManagedRewards,
  updateReward,
} from "./reward-management-service.ts";
import { getWallet, redeemReward } from "./rewards-service.ts";

const owner: SessionUser = {
  id: "usr_owner",
  businessId: "biz_one",
  locationId: "loc_one",
  role: "owner",
  name: "Owner",
  email: "owner@example.com",
  memberCode: null,
  platformAdmin: false,
};
const staff: SessionUser = { ...owner, id: "usr_staff", role: "staff", email: "staff@example.com" };
const member: SessionUser = {
  ...owner,
  id: "usr_member",
  role: "member",
  email: "member@example.com",
  memberCode: "ELITE-MEMBER",
};
const otherOwner: SessionUser = {
  ...owner,
  id: "usr_other_owner",
  businessId: "biz_two",
  locationId: "loc_two",
  email: "other@example.com",
};
const platformAdmin: SessionUser = {
  ...owner,
  id: "usr_platform",
  businessId: "biz_platform",
  locationId: "loc_platform",
  email: "platform@example.com",
  platformAdmin: true,
};
let pool: pg.Pool;

const input = {
  name: "Free signature item",
  description: "Choose one eligible signature item.",
  points: 750,
  active: true,
  inventoryRemaining: 2,
};

describe("editable business rewards", () => {
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
    pool = new adapter.Pool() as unknown as pg.Pool;
    setDatabasePoolForTests(pool);
    for (const file of [
      "001_production_rewards.sql",
      "002_platform_clients.sql",
      "006_editable_rewards.sql",
    ]) {
      await pool.query(await readFile(join(process.cwd(), "migrations", file), "utf8"));
    }
    await pool.query("ALTER TABLE businesses ADD COLUMN logo_url text");
    await pool.query(
      "ALTER TABLE businesses ADD COLUMN primary_color text NOT NULL DEFAULT '#F6B900'",
    );
    await pool.query(
      "ALTER TABLE businesses ADD COLUMN secondary_color text NOT NULL DEFAULT '#FFE27A'",
    );
    await pool.query(
      "INSERT INTO businesses(id,name) VALUES ('biz_one','First'),('biz_two','Second'),('biz_platform','Elite Rewards')",
    );
    await pool.query(
      "INSERT INTO locations(id,business_id,name) VALUES ('loc_one','biz_one','Main'),('loc_two','biz_two','Main'),('loc_platform','biz_platform','HQ')",
    );
    await pool.query(`INSERT INTO users(id,business_id,location_id,role,name,email,password_hash,member_code)
      VALUES ('usr_owner','biz_one','loc_one','owner','Owner','owner@example.com','test',NULL),
             ('usr_staff','biz_one','loc_one','staff','Staff','staff@example.com','test',NULL),
             ('usr_member','biz_one','loc_one','member','Member','member@example.com','test','ELITE-MEMBER'),
             ('usr_other_owner','biz_two','loc_two','owner','Other','other@example.com','test',NULL),
             ('usr_platform','biz_platform','loc_platform','owner','Platform','platform@example.com','test',NULL)`);
    await pool.query(
      "INSERT INTO member_balances(business_id,member_id,points) VALUES ('biz_one','usr_member',3000)",
    );
  });

  after(async () => closeDatabase());

  it("lets an owner create and edit a reward for only their business", async () => {
    const created = await createReward(owner, input);
    assert.equal(created.name, input.name);
    assert.equal(created.inventoryRemaining, 2);
    assert.equal((await listManagedRewards(otherOwner)).length, 0);

    const updated = await updateReward(owner, created.id, {
      ...input,
      name: "$10 member reward",
      points: 900,
      active: false,
      inventoryRemaining: null,
    });
    assert.equal(updated.name, "$10 member reward");
    assert.equal(updated.points, 900);
    assert.equal(updated.active, false);
    assert.equal(updated.inventoryRemaining, null);
    assert.ok(!(await getWallet(member)).rewards.some((item) => item.id === created.id));
    const audit = await pool.query<{
      metadata: { before: { name: string }; after: { name: string } };
    }>("SELECT metadata FROM audit_events WHERE action = 'reward.updated' AND target_id = $1", [
      created.id,
    ]);
    assert.equal(audit.rows[0]?.metadata.before.name, input.name);
    assert.equal(audit.rows[0]?.metadata.after.name, "$10 member reward");
  });

  it("rejects staff edits and cross-tenant updates", async () => {
    await assert.rejects(() => createReward(staff, input), /owner access required/i);
    const reward = (await listManagedRewards(owner))[0]!;
    await assert.rejects(() => updateReward(otherOwner, reward.id, input), /not found/i);
  });

  it("lets only the platform administrator manage an isolated client reward catalog", async () => {
    const created = await createClientReward(platformAdmin, "biz_two", {
      ...input,
      name: "Big Smoke special",
    });
    assert.equal(created.name, "Big Smoke special");
    assert.ok(
      (await listClientRewards(platformAdmin, "biz_two")).some((item) => item.id === created.id),
    );
    assert.equal(
      (await listManagedRewards(owner)).some((item) => item.id === created.id),
      false,
    );
    await assert.rejects(
      () => createClientReward(owner, "biz_two", input),
      /Platform administrator access required/,
    );
  });

  it("publishes active inventory and consumes it atomically on redemption", async () => {
    const reward = await createReward(owner, input);
    assert.ok((await getWallet(member)).rewards.some((item) => item.id === reward.id));
    await redeemReward(member, { rewardId: reward.id, idempotencyKey: "redeem-inventory-1" });
    await redeemReward(member, { rewardId: reward.id, idempotencyKey: "redeem-inventory-1" });
    assert.equal(
      (await listManagedRewards(owner)).find((item) => item.id === reward.id)?.inventoryRemaining,
      1,
    );
    await redeemReward(member, { rewardId: reward.id, idempotencyKey: "redeem-inventory-2" });
    assert.ok(!(await getWallet(member)).rewards.some((item) => item.id === reward.id));
    await assert.rejects(
      () => redeemReward(member, { rewardId: reward.id, idempotencyKey: "redeem-inventory-3" }),
      /not found/i,
    );
  });

  it("archives offers without erasing redemption history or snapshots", async () => {
    const reward = await createReward(owner, { ...input, inventoryRemaining: null });
    await redeemReward(member, { rewardId: reward.id, idempotencyKey: "redeem-archive-1" });
    await updateReward(owner, reward.id, {
      ...input,
      name: "Renamed offer",
      inventoryRemaining: null,
    });
    await archiveReward(owner, reward.id);
    const archived = (await listManagedRewards(owner)).find((item) => item.id === reward.id);
    assert.ok(archived?.archivedAt);
    assert.equal(archived?.active, false);
    assert.ok(!(await getWallet(member)).rewards.some((item) => item.id === reward.id));
    const wallet = await getWallet(member);
    assert.ok(wallet.redemptions.some((item) => item.name === input.name));
  });
});
