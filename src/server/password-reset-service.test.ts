import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import { authenticate, createSession, hashPassword, type SessionUser } from "./auth.ts";
import { closeDatabase, setDatabasePoolForTests } from "./database.ts";
import {
  completePasswordReset,
  getPasswordResetStatus,
  issuePasswordReset,
  listPasswordResetRequests,
  requestPasswordReset,
} from "./password-reset-service.ts";

const admin: SessionUser = {
  id: "usr_admin",
  businessId: "biz_platform",
  locationId: "loc_platform",
  role: "owner",
  name: "Platform Admin",
  email: "admin@example.com",
  memberCode: null,
  platformAdmin: true,
};

describe("password reset service", () => {
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
      "010_client_suspension.sql",
      "013_password_resets.sql",
    ]) {
      const sql = await readFile(join(process.cwd(), "migrations", file), "utf8");
      await pool.query(sql.replaceAll("date_trunc('hour',now())", "now()"));
    }
    await pool.query(
      "CREATE TABLE platform_administrator(singleton boolean PRIMARY KEY, user_id text UNIQUE)",
    );
    await pool.query(
      "INSERT INTO businesses(id,name) VALUES ('biz_platform','Elite Rewards'),('biz_client','Client Business')",
    );
    await pool.query(
      "INSERT INTO locations(id,business_id,name) VALUES ('loc_platform','biz_platform','Platform'),('loc_client','biz_client','Main')",
    );
    const oldHash = await hashPassword("old-password");
    await pool.query(
      `INSERT INTO users(id,business_id,location_id,role,name,email,password_hash,platform_admin)
       VALUES ('usr_admin','biz_platform','loc_platform','owner','Platform Admin','admin@example.com',$1,true),
              ('usr_member','biz_client','loc_client','member','Test Member','member@example.com',$1,false)`,
      [oldHash],
    );
    await pool.query(
      "INSERT INTO platform_administrator(singleton,user_id) VALUES (true,'usr_admin')",
    );
  });

  after(async () => closeDatabase());

  it("returns the same public result for known and unknown email addresses", async () => {
    await requestPasswordReset("missing@example.com", "198.51.100.1");
    await requestPasswordReset("member@example.com", "198.51.100.2");
    assert.equal(
      Number((await pool.query("SELECT count(*) FROM password_reset_requests")).rows[0].count),
      1,
    );
  });

  it("requires platform authority to view and issue a reset", async () => {
    const requests = await listPasswordResetRequests(admin);
    assert.equal(requests.length, 1);
    await assert.rejects(
      () => listPasswordResetRequests({ ...admin, platformAdmin: false }),
      /Platform administrator/,
    );
    const issued = await issuePasswordReset(admin, requests[0]!.id);
    const token = new URL(`https://example.com${issued.resetPath}`).searchParams.get("token")!;
    assert.deepEqual(await getPasswordResetStatus(token), { valid: true });

    const sessionClient = await pool.connect();
    const previousSession = await createSession(sessionClient, "usr_member");
    sessionClient.release();
    assert.ok(previousSession);

    const result = await completePasswordReset(token, "new-password");
    assert.equal(result.role, "member");
    assert.equal((await authenticate("member@example.com", "old-password")) === null, true);
    assert.ok(await authenticate("member@example.com", "new-password"));
    await assert.rejects(() => getPasswordResetStatus(token), /invalid or expired/);
    assert.equal(
      Number(
        (await pool.query("SELECT count(*) FROM sessions WHERE user_id='usr_member'")).rows[0]
          .count,
      ),
      1,
      "the old session is revoked and only the explicit post-reset login session remains",
    );
  });
});
