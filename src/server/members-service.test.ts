import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import type { SessionUser } from "./auth.ts";
import { closeDatabase, setDatabasePoolForTests } from "./database.ts";
import { countBusinessMembers } from "./member-count.ts";
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
      "005_automatic_holiday_themes.sql",
      "010_client_suspension.sql",
      "021_full_client_experience_customization.sql",
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
    assert.equal(await countBusinessMembers(pool, owner.businessId), 1);
    const invitedAudit = await pool.query<{
      action: string;
      business_id: string;
      target_id: string;
    }>("SELECT action,business_id,target_id FROM audit_events WHERE target_id = $1", [
      result.member.id,
    ]);
    assert.deepEqual(invitedAudit.rows[0], {
      action: "member.invited",
      business_id: owner.businessId,
      target_id: result.member.id,
    });

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
    assert.equal(await countBusinessMembers(pool, owner.businessId), 1);
    const activatedAudit = await pool.query<{ count: string }>(
      "SELECT count(*) AS count FROM audit_events WHERE business_id = $1 AND action = 'member.activated' AND target_id = (SELECT id FROM users WHERE email = 'member@example.com')",
      [owner.businessId],
    );
    assert.equal(Number(activatedAudit.rows[0]?.count), 1);
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

  it("reissues a current invitation for the same business and invalidates the old link", async () => {
    const first = await createMemberInvitation(owner, {
      name: "Current Invite",
      email: "reissue@example.com",
    });
    const oldToken = new URL(`https://elite.test${first.activationPath}`).searchParams.get("token");
    assert.ok(oldToken);

    const replacement = await createMemberInvitation(owner, {
      name: "Updated Invite",
      email: "REISSUE@example.com",
    });
    const newToken = new URL(`https://elite.test${replacement.activationPath}`).searchParams.get(
      "token",
    );
    assert.ok(newToken);
    assert.equal(replacement.member.id, first.member.id);
    assert.equal(await countBusinessMembers(pool, owner.businessId), 2);
    await assert.rejects(() => getMemberInvitation(oldToken), /invalid or expired/);
    assert.equal((await getMemberInvitation(newToken)).memberName, "Updated Invite");
    const invitations = await pool.query(
      "SELECT count(*)::int AS count FROM member_invitations WHERE lower(member_email) = 'reissue@example.com' AND accepted_at IS NULL",
    );
    assert.equal(Number(invitations.rows[0]?.count), 1);
  });

  it("replaces an expired invitation instead of failing the pending-email unique index", async () => {
    const expired = await createMemberInvitation(owner, {
      name: "Expired Invite",
      email: "expired@example.com",
    });
    await pool.query(
      "UPDATE member_invitations SET expires_at = now() - interval '1 hour' WHERE id = $1",
      [expired.member.id],
    );

    const replacement = await createMemberInvitation(owner, {
      name: "Replacement Invite",
      email: "expired@example.com",
    });
    assert.notEqual(replacement.member.id, expired.member.id);
    const invitations = await pool.query(
      "SELECT id FROM member_invitations WHERE lower(member_email) = 'expired@example.com'",
    );
    assert.deepEqual(
      invitations.rows.map((row) => row.id),
      [replacement.member.id],
    );
  });

  it("does not let another business replace a current invitation", async () => {
    await createMemberInvitation(owner, {
      name: "First Business Invite",
      email: "pending-elsewhere@example.com",
    });
    await assert.rejects(
      () =>
        createMemberInvitation(otherOwner, {
          name: "Other Business Invite",
          email: "pending-elsewhere@example.com",
        }),
      /Another rewards program already invited this email/,
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

  it("blocks pending member invitation activation while the client is suspended", async () => {
    const result = await createMemberInvitation(owner, {
      name: "Suspended Invite",
      email: "suspended-invite@example.com",
    });
    const token = new URL(`https://elite.test${result.activationPath}`).searchParams.get("token");
    assert.ok(token);
    await pool.query(
      "UPDATE businesses SET active = false, suspended_at = now() WHERE id = 'biz_one'",
    );
    await assert.rejects(() => getMemberInvitation(token), /invalid or expired/);
    await assert.rejects(
      () => activateMember(token, "member-secure-password"),
      /invalid or expired/,
    );
  });
});
