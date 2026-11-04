import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import type { SessionUser } from "./auth.ts";
import { closeDatabase, setDatabasePoolForTests } from "./database.ts";
import {
  activateMember,
  createMemberInvitation,
  getMemberInvitation,
  listMembers,
} from "./members-service.ts";

const owner: SessionUser = {
  id: "usr_owner",
  businessId: "biz_one",
  locationId: "loc_one",
  role: "owner",
  name: "Business Owner",
  email: "owner@example.com",
  memberCode: null,
  platformAdmin: false,
};
const otherOwner: SessionUser = {
  ...owner,
  id: "usr_other",
  businessId: "biz_two",
  locationId: "loc_two",
  email: "other@example.com",
};
let pool: pg.Pool;

describe("member enrollment", () => {
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
      "003_member_enrollment.sql",
      "004_referrals_and_visual_themes.sql",
    ]) {
      await pool.query(await readFile(join(process.cwd(), "migrations", file), "utf8"));
    }
    await pool.query(
      "INSERT INTO businesses(id,name) VALUES ('biz_one','First Business'),('biz_two','Other Business')",
    );
    await pool.query(
      "INSERT INTO locations(id,business_id,name) VALUES ('loc_one','biz_one','Main Store'),('loc_two','biz_two','Other Store')",
    );
    await pool.query(
      `INSERT INTO users(id,business_id,location_id,role,name,email,password_hash)
       VALUES ('usr_owner','biz_one','loc_one','owner','Business Owner','owner@example.com','test'),
              ('usr_other','biz_two','loc_two','owner','Other Owner','other@example.com','test')`,
    );
  });

  after(async () => {
    await closeDatabase();
  });

  it("creates a tenant-isolated single-use member invitation and wallet", async () => {
    const result = await createMemberInvitation(owner, {
      name: "First Member",
      email: "member@example.com",
    });
    assert.equal(result.member.status, "invited");
    assert.match(result.activationPath, /^\/activate-member\?token=/);
    const token = new URL(`https://elite.test${result.activationPath}`).searchParams.get("token");
    assert.ok(token);

    const invitation = await getMemberInvitation(token);
    assert.equal(invitation.businessName, "First Business");
    assert.equal(invitation.memberEmail, "member@example.com");
    assert.equal((await listMembers(owner))[0]?.status, "invited");
    assert.equal((await listMembers(otherOwner)).length, 0);

    const activated = await activateMember(token, "member-secure-password");
    assert.ok(activated.sessionToken);
    const member = await pool.query<{
      business_id: string;
      role: string;
      member_code: string;
    }>("SELECT business_id, role, member_code FROM users WHERE email = 'member@example.com'");
    assert.equal(member.rows[0]?.business_id, owner.businessId);
    assert.equal(member.rows[0]?.role, "member");
    assert.match(member.rows[0]?.member_code ?? "", /^ELITE-[A-F0-9]{20}$/);
    const balance = await pool.query<{ points: number }>(
      "SELECT points FROM member_balances WHERE member_id = (SELECT id FROM users WHERE email = 'member@example.com')",
    );
    assert.equal(Number(balance.rows[0]?.points), 0);
    assert.equal((await listMembers(owner))[0]?.status, "active");
    await assert.rejects(
      () => activateMember(token, "member-secure-password"),
      /invalid or expired/,
    );
  });

  it("rejects duplicate email enrollment", async () => {
    await assert.rejects(
      () =>
        createMemberInvitation(owner, {
          name: "Duplicate Member",
          email: "member@example.com",
        }),
      /already uses this email/,
    );
  });

  it("rejects a location outside the business", async () => {
    await assert.rejects(
      () =>
        createMemberInvitation(owner, {
          name: "Wrong Tenant",
          email: "wrong@example.com",
          locationId: "loc_two",
        }),
      /Location not found/,
    );
  });
});
