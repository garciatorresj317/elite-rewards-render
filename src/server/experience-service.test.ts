import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import type { SessionUser } from "./auth.ts";
import { closeDatabase, setDatabasePoolForTests } from "./database.ts";
import {
  getOrCreateReferralLink,
  getReferralEnrollment,
  getVisualSettings,
  joinWithReferral,
  updateVisualSettings,
} from "./experience-service.ts";

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
const member: SessionUser = {
  id: "usr_member",
  businessId: "biz_one",
  locationId: "loc_one",
  role: "member",
  name: "Referrer",
  email: "referrer@example.com",
  memberCode: "ELITE-REFERRER",
  platformAdmin: false,
};
const otherMember: SessionUser = {
  ...member,
  id: "usr_other_member",
  businessId: "biz_two",
  locationId: "loc_two",
  email: "other-member@example.com",
};
let pool: pg.Pool;

describe("referrals and visual experiences", () => {
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
    ]) {
      await pool.query(await readFile(join(process.cwd(), "migrations", file), "utf8"));
    }
    await pool.query(
      "INSERT INTO businesses(id,name) VALUES ('biz_one','First Business'),('biz_two','Other Business')",
    );
    await pool.query(
      "INSERT INTO locations(id,business_id,name) VALUES ('loc_one','biz_one','Main Store'),('loc_two','biz_two','Other Store')",
    );
    await pool.query(`INSERT INTO users(id,business_id,location_id,role,name,email,password_hash,member_code)
      VALUES ('usr_owner','biz_one','loc_one','owner','Owner','owner@example.com','test',NULL),
             ('usr_member','biz_one','loc_one','member','Referrer','referrer@example.com','test','ELITE-REFERRER'),
             ('usr_other_member','biz_two','loc_two','member','Other','other-member@example.com','test','ELITE-OTHER')`);
    await pool.query(
      "INSERT INTO member_balances(business_id,member_id,points) VALUES ('biz_one','usr_member',0),('biz_two','usr_other_member',0)",
    );
  });

  after(async () => closeDatabase());

  it("creates a stable member referral link and attributes a joined wallet", async () => {
    const first = await getOrCreateReferralLink(member);
    const second = await getOrCreateReferralLink(member);
    assert.equal(first.sharePath, second.sharePath);
    const code = new URL(`https://elite.test${first.sharePath}`).searchParams.get("ref");
    assert.ok(code);
    assert.equal((await getReferralEnrollment(code)).businessName, "First Business");
    const joined = await joinWithReferral({
      referralCode: code,
      name: "Referred Friend",
      email: "friend@example.com",
      password: "secure-friend-password",
      requestSubject: "203.0.113.10",
    });
    assert.ok(joined.sessionToken);
    const account = await pool.query<{
      business_id: string;
      points: number;
      referrer_member_id: string;
    }>(
      `SELECT u.business_id, mb.points, mr.referrer_member_id
         FROM users u JOIN member_balances mb ON mb.member_id = u.id
         JOIN member_referrals mr ON mr.referred_member_id = u.id
        WHERE u.email = 'friend@example.com'`,
    );
    assert.equal(account.rows[0]?.business_id, "biz_one");
    assert.equal(Number(account.rows[0]?.points), 0);
    assert.equal(account.rows[0]?.referrer_member_id, member.id);
    assert.equal((await getOrCreateReferralLink(member)).referralCount, 1);
  });

  it("isolates referral enrollment by the link business and rejects duplicate email", async () => {
    const code = new URL(
      `https://elite.test${(await getOrCreateReferralLink(otherMember)).sharePath}`,
    ).searchParams.get("ref");
    assert.ok(code);
    assert.equal((await getReferralEnrollment(code)).businessName, "Other Business");
    await assert.rejects(
      () =>
        joinWithReferral({
          referralCode: code,
          name: "Duplicate",
          email: "friend@example.com",
          password: "secure-friend-password",
          requestSubject: "203.0.113.11",
        }),
      /could not be completed/,
    );
  });

  it("persists owner-controlled visual settings per business", async () => {
    const saved = await updateVisualSettings(owner, {
      themeKey: "mlk-day",
      occasionTitle: "A day of service",
      occasionMessage: "Honoring unity, service, and progress.",
      automaticHolidayThemes: false,
      timeZone: "America/New_York",
    });
    assert.equal(saved.themeKey, "mlk-day");
    assert.deepEqual(await getVisualSettings(member), saved);
    await assert.rejects(
      () =>
        updateVisualSettings(member, {
          themeKey: "elite-signature",
          occasionTitle: "",
          occasionMessage: "",
          automaticHolidayThemes: false,
          timeZone: "America/New_York",
        }),
      /owner access required/i,
    );
    assert.equal((await getVisualSettings(otherMember)).themeKey, "elite-signature");
  });

  it("temporarily applies automatic holiday themes without overwriting the manual theme", async () => {
    await updateVisualSettings(owner, {
      themeKey: "community-event",
      occasionTitle: "Member appreciation",
      occasionMessage: "Thank you for being part of our community.",
      automaticHolidayThemes: true,
      timeZone: "America/New_York",
    });
    const remembrance = await getVisualSettings(member, new Date("2026-09-11T16:00:00Z"));
    assert.equal(remembrance.themeKey, "remembrance-911");
    assert.equal(remembrance.automaticThemeActive, true);
    assert.equal(remembrance.configuredThemeKey, "community-event");
    const followingDay = await getVisualSettings(member, new Date("2026-09-12T16:00:00Z"));
    assert.equal(followingDay.themeKey, "community-event");
    assert.equal(followingDay.occasionTitle, "Member appreciation");
    assert.equal(followingDay.automaticThemeActive, false);
  });

  it("keeps the manual theme when automatic scheduling is disabled", async () => {
    const saved = await updateVisualSettings(owner, {
      themeKey: "elite-signature",
      occasionTitle: "Welcome",
      occasionMessage: "Our regular experience.",
      automaticHolidayThemes: false,
      timeZone: "America/Los_Angeles",
    });
    const settings = await getVisualSettings(member, new Date("2026-09-11T20:00:00Z"));
    assert.equal(settings.themeKey, "elite-signature");
    assert.equal(settings.automaticThemeActive, false);
    assert.equal(saved.timeZone, "America/Los_Angeles");
  });

  it("rejects unsupported business time zones", async () => {
    await assert.rejects(
      () =>
        updateVisualSettings(owner, {
          themeKey: "elite-signature",
          occasionTitle: "",
          occasionMessage: "",
          automaticHolidayThemes: true,
          timeZone: "Not/A_Time_Zone",
        }),
      /time zone is invalid/i,
    );
  });
});
