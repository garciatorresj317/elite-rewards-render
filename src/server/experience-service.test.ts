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
  getBusinessVisualSettings,
  getClientVisualSettings,
  getOrCreateReferralLink,
  getReferralEnrollment,
  getVisualSettings,
  joinWithReferral,
  updateClientVisualSettings,
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
      "010_client_suspension.sql",
      "021_full_client_experience_customization.sql",
      "022_business_name_color.sql",
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
      "INSERT INTO businesses(id,name) VALUES ('biz_platform','Elite Rewards'),('biz_one','First Business'),('biz_two','Other Business')",
    );
    await pool.query(
      "INSERT INTO platform_state(singleton,business_id) VALUES (true,'biz_platform')",
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
    assert.equal(await countBusinessMembers(pool, "biz_one"), 2);
    const audit = await pool.query<{ business_id: string; target_id: string }>(
      "SELECT business_id,target_id FROM audit_events WHERE action = 'member.referral.joined'",
    );
    assert.equal(audit.rows[0]?.business_id, "biz_one");
    assert.ok(audit.rows[0]?.target_id);
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

  it("disables referral enrollment while the client business is suspended", async () => {
    const code = new URL(
      `https://elite.test${(await getOrCreateReferralLink(otherMember)).sharePath}`,
    ).searchParams.get("ref");
    assert.ok(code);
    await pool.query(
      "UPDATE businesses SET active = false, suspended_at = now() WHERE id = 'biz_two'",
    );
    await assert.rejects(() => getReferralEnrollment(code), /invalid or inactive/);
    await assert.rejects(
      () =>
        joinWithReferral({
          referralCode: code,
          name: "Denied Friend",
          email: "denied-friend@example.com",
          password: "secure-friend-password",
          requestSubject: "203.0.113.12",
        }),
      /invalid or inactive/,
    );
    await pool.query(
      "UPDATE businesses SET active = true, suspended_at = NULL, suspended_by_user_id = NULL WHERE id = 'biz_two'",
    );
  });

  it("persists Elite-controlled visual settings per client business", async () => {
    const platformOwner: SessionUser = { ...owner, platformAdmin: true };
    const saved = await updateClientVisualSettings(platformOwner, owner.businessId, {
      themeKey: "mlk-day",
      occasionTitle: "A day of service",
      occasionMessage: "Honoring unity, service, and progress.",
      automaticHolidayThemes: false,
      timeZone: "America/New_York",
      companySlogan: "Built for the bold",
      companySloganEs: "Creado para los audaces",
      publicHeadline: "Rewards made personal",
      publicHeadlineEs: "Recompensas personales",
      publicMessage: "Earn more with every visit.",
      publicMessageEs: "Gana más con cada visita.",
      joinHeadline: "Join the inner circle",
      joinHeadlineEs: "Únete al círculo",
      joinMessage: "Create your wallet in seconds.",
      joinMessageEs: "Crea tu billetera en segundos.",
      memberHeadline: "Your rewards, your way",
      memberHeadlineEs: "Tus recompensas, a tu manera",
      memberMessage: "See your balance and offers here.",
      memberMessageEs: "Consulta aquí tu saldo y ofertas.",
      businessNameColor: "#66CCFF",
      primaryColor: "#11AAFF",
      accentColor: "#FF44CC",
      backgroundColor: "#020713",
      surfaceColor: "#07111F",
      textColor: "#FFFAF0",
      mutedColor: "#C7BEA8",
      fontStyle: "modern",
      cornerStyle: "rounded",
      showRewards: true,
      showProducts: false,
      showReferrals: true,
    });
    assert.equal(saved.themeKey, "mlk-day");
    assert.equal(saved.companySlogan, "Built for the bold");
    assert.equal(saved.companySloganEs, "Creado para los audaces");
    assert.equal(saved.publicHeadline, "Rewards made personal");
    assert.equal(saved.businessNameColor, "#66CCFF");
    assert.equal(saved.primaryColor, "#11AAFF");
    assert.equal(saved.fontStyle, "modern");
    assert.equal(saved.cornerStyle, "rounded");
    assert.equal(saved.showProducts, false);
    assert.deepEqual(await getVisualSettings(member), saved);
    const audit = await pool.query<{ metadata: string | Record<string, unknown> }>(
      "SELECT metadata FROM audit_events WHERE action = 'platform.client.visual_settings.updated' ORDER BY created_at DESC LIMIT 1",
    );
    const metadata =
      typeof audit.rows[0]?.metadata === "string"
        ? (JSON.parse(audit.rows[0].metadata) as Record<string, unknown>)
        : audit.rows[0]?.metadata;
    assert.equal(metadata?.["themeKey"], "mlk-day");
    assert.equal(metadata?.["businessNameColor"], "#66CCFF");
    assert.equal(metadata?.["fontStyle"], "modern");
    assert.equal(metadata?.["showProducts"], false);
    await assert.rejects(
      () =>
        updateClientVisualSettings(owner, owner.businessId, {
          themeKey: "elite-signature",
          occasionTitle: "",
          occasionMessage: "",
          automaticHolidayThemes: false,
          timeZone: "America/New_York",
        }),
      /Platform administrator access required/i,
    );
    assert.equal((await getVisualSettings(otherMember)).themeKey, "elite-signature");
  });

  it("temporarily applies automatic holiday themes without overwriting the manual theme", async () => {
    const platformOwner: SessionUser = { ...owner, platformAdmin: true };
    await updateClientVisualSettings(platformOwner, owner.businessId, {
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
    const platformOwner: SessionUser = { ...owner, platformAdmin: true };
    const saved = await updateClientVisualSettings(platformOwner, owner.businessId, {
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

  it("lets only the platform administrator control a client holiday-theme toggle", async () => {
    const platformOwner: SessionUser = { ...owner, platformAdmin: true };
    const enabled = await updateClientVisualSettings(platformOwner, otherMember.businessId, {
      themeKey: "community-event",
      occasionTitle: "Community weekend",
      occasionMessage: "Welcome to our neighborhood celebration.",
      automaticHolidayThemes: true,
      timeZone: "America/New_York",
    });
    assert.equal(enabled.automaticHolidayThemes, true);
    assert.equal(
      (await getClientVisualSettings(platformOwner, otherMember.businessId)).timeZone,
      "America/New_York",
    );
    const remembrance = await getBusinessVisualSettings(
      otherMember.businessId,
      new Date("2026-09-11T16:00:00Z"),
    );
    assert.equal(remembrance.themeKey, "remembrance-911");
    assert.equal(remembrance.automaticThemeActive, true);
    await assert.rejects(
      () =>
        updateClientVisualSettings(owner, otherMember.businessId, {
          themeKey: "elite-signature",
          occasionTitle: "",
          occasionMessage: "",
          automaticHolidayThemes: false,
          timeZone: "UTC",
        }),
      /Platform administrator access required/,
    );
  });

  it("rejects unsupported business time zones", async () => {
    const platformOwner: SessionUser = { ...owner, platformAdmin: true };
    await assert.rejects(
      () =>
        updateClientVisualSettings(platformOwner, owner.businessId, {
          themeKey: "elite-signature",
          occasionTitle: "",
          occasionMessage: "",
          automaticHolidayThemes: true,
          timeZone: "Not/A_Time_Zone",
        }),
      /time zone is invalid/i,
    );
  });

  it("stores all four additional themes with tenant-scoped visibility settings", async () => {
    const platformOwner: SessionUser = { ...owner, platformAdmin: true };
    const otherThemeBefore = (await getVisualSettings(otherMember)).themeKey;
    for (const themeKey of [
      "cosmic-neon",
      "royal-purple",
      "ocean-glow",
      "sunset-energy",
    ] as const) {
      const saved = await updateClientVisualSettings(platformOwner, owner.businessId, {
        themeKey,
        occasionTitle: "Live campaign",
        occasionMessage: "A fresh customer experience.",
        automaticHolidayThemes: false,
        timeZone: "America/New_York",
        showRewards: false,
        showProducts: true,
        showReferrals: false,
      });
      assert.equal(saved.themeKey, themeKey);
      assert.equal(saved.showRewards, false);
      assert.equal(saved.showProducts, true);
      assert.equal(saved.showReferrals, false);
      assert.equal((await getVisualSettings(otherMember)).themeKey, otherThemeBefore);
    }
  });
});
