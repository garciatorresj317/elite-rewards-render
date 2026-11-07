import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import { closeDatabase, setDatabasePoolForTests } from "./database.ts";
import { getBusinessEnrollment, joinBusinessRewards } from "./experience-service.ts";

describe("business Join Rewards enrollment", () => {
  let pool: pg.Pool;
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
      "004_referrals_and_visual_themes.sql",
      "005_automatic_holiday_themes.sql",
      "006_editable_rewards.sql",
      "010_client_suspension.sql",
    ]) {
      await pool.query(await readFile(join(process.cwd(), "migrations", file), "utf8"));
    }
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
    await pool.query(
      "CREATE TABLE platform_administrator(singleton boolean PRIMARY KEY, user_id text UNIQUE)",
    );
    await pool.query(
      "INSERT INTO businesses(id,name) VALUES ('biz_platform','Elite Rewards'),('biz_client','Big Smoke')",
    );
    await pool.query(
      "INSERT INTO platform_state(singleton,business_id) VALUES (true,'biz_platform')",
    );
    await pool.query(
      "INSERT INTO locations(id,business_id,name) VALUES ('loc_platform','biz_platform','Platform'),('loc_client','biz_client','Main Store')",
    );
  });
  after(async () => closeDatabase());

  it("exposes only client enrollment context and creates a zero-balance tenant member", async () => {
    const context = await getBusinessEnrollment("biz_client");
    assert.equal(context.businessName, "Big Smoke");
    const joined = await joinBusinessRewards({
      businessId: "biz_client",
      name: "New Member",
      email: "newmember@example.com",
      password: "secure-member-password",
      requestSubject: "198.51.100.1",
    });
    assert.ok(joined.sessionToken);
    const result = await pool.query<{ business_id: string; points: number }>(
      `SELECT u.business_id, mb.points FROM users u
       JOIN member_balances mb ON mb.business_id=u.business_id AND mb.member_id=u.id
       WHERE u.email='newmember@example.com'`,
    );
    assert.equal(result.rows[0]?.business_id, "biz_client");
    assert.equal(Number(result.rows[0]?.points), 0);
    await assert.rejects(
      () =>
        joinBusinessRewards({
          businessId: "biz_client",
          name: "Duplicate",
          email: "newmember@example.com",
          password: "secure-member-password",
          requestSubject: "198.51.100.2",
        }),
      /Enrollment could not be completed/,
    );
  });

  it("accepts an eight-character member password and rejects shorter passwords", async () => {
    const joined = await joinBusinessRewards({
      businessId: "biz_client",
      name: "Eight Character Member",
      email: "eight@example.com",
      password: "12345678",
      requestSubject: "198.51.100.8",
    });
    assert.ok(joined.sessionToken);
    await assert.rejects(
      () =>
        joinBusinessRewards({
          businessId: "biz_client",
          name: "Short Password",
          email: "short@example.com",
          password: "1234567",
          requestSubject: "198.51.100.9",
        }),
      /between 8 and 200 characters/,
    );
  });

  it("does not allow public enrollment into the Elite platform tenant", async () => {
    await assert.rejects(() => getBusinessEnrollment("biz_platform"), /unavailable/);
    await assert.rejects(
      () =>
        joinBusinessRewards({
          businessId: "biz_platform",
          name: "Denied Member",
          email: "denied@example.com",
          password: "secure-member-password",
          requestSubject: "198.51.100.3",
        }),
      /unavailable/,
    );
  });

  it("blocks a suspended client's public page and self-enrollment without deleting the tenant", async () => {
    await pool.query(
      "UPDATE businesses SET active = false, suspended_at = now() WHERE id = 'biz_client'",
    );
    await assert.rejects(() => getBusinessEnrollment("biz_client"), /unavailable/);
    await assert.rejects(
      () =>
        joinBusinessRewards({
          businessId: "biz_client",
          name: "Denied Member",
          email: "suspended@example.com",
          password: "secure-member-password",
          requestSubject: "198.51.100.4",
        }),
      /unavailable/,
    );
    assert.equal(
      Number(
        (await pool.query("SELECT count(*) FROM businesses WHERE id = 'biz_client'")).rows[0].count,
      ),
      1,
    );
  });
});
