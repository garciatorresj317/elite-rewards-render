import { createHash, createHmac, randomBytes } from "node:crypto";
import type { SessionUser } from "./auth.ts";
import { createSession, hashPassword, newUserId } from "./auth.ts";
import { getPool, id } from "./database.ts";
import { normalizeTimeZone, resolveScheduledTheme } from "./holiday-theme-schedule.ts";

export const themeKeys = [
  "elite-signature",
  "mlk-day",
  "remembrance-911",
  "winter-holiday",
  "spring-celebration",
  "community-event",
] as const;
export type ThemeKey = (typeof themeKeys)[number];
export type VisualSettings = {
  themeKey: ThemeKey;
  occasionTitle: string;
  occasionMessage: string;
  configuredThemeKey: ThemeKey;
  configuredOccasionTitle: string;
  configuredOccasionMessage: string;
  automaticHolidayThemes: boolean;
  timeZone: string;
  automaticThemeActive: boolean;
  automaticThemeName: string | null;
  nextAutomaticTheme: { name: string; localDate: string; dateLabel: string } | null;
  updatedAt: string | null;
};

type StoredVisualSettings = {
  themeKey: ThemeKey;
  occasionTitle: string;
  occasionMessage: string;
  automaticHolidayThemes: boolean;
  timeZone: string;
  updatedAt: string | null;
};

function effectiveVisualSettings(
  stored: StoredVisualSettings,
  now: Date = new Date(),
): VisualSettings {
  const schedule = resolveScheduledTheme(now, stored.timeZone);
  const automatic = stored.automaticHolidayThemes ? schedule.active : null;
  return {
    themeKey: automatic?.key ?? stored.themeKey,
    occasionTitle: automatic?.title ?? stored.occasionTitle,
    occasionMessage: automatic?.message ?? stored.occasionMessage,
    configuredThemeKey: stored.themeKey,
    configuredOccasionTitle: stored.occasionTitle,
    configuredOccasionMessage: stored.occasionMessage,
    automaticHolidayThemes: stored.automaticHolidayThemes,
    timeZone: stored.timeZone,
    automaticThemeActive: Boolean(automatic),
    automaticThemeName: automatic?.name ?? null,
    nextAutomaticTheme: schedule.next
      ? {
          name: schedule.next.name,
          localDate: schedule.next.localDate,
          dateLabel: schedule.next.dateLabel,
        }
      : null,
    updatedAt: stored.updatedAt,
  };
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
function rateLimitHash(subject: string): string {
  const key = process.env["RATE_LIMIT_HMAC_KEY"] ?? "local-test-rate-limit-key";
  return createHmac("sha256", key).update(subject).digest("hex");
}
async function enforceRateLimit(
  client: {
    query: (text: string, values?: unknown[]) => Promise<{ rows: Array<{ attempts: number }> }>;
  },
  scope: string,
  subject: string,
  limit: number,
  window: "hour" | "day",
): Promise<void> {
  const now = new Date();
  const windowStart =
    window === "hour"
      ? new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()),
        )
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const result = await client.query(
    `INSERT INTO request_rate_limits(scope,subject_hash,window_start,attempts)
     VALUES ($1,$2,$3,1)
     ON CONFLICT (scope,subject_hash,window_start)
     DO UPDATE SET attempts = request_rate_limits.attempts + 1
     RETURNING attempts`,
    [scope, rateLimitHash(subject), windowStart],
  );
  if (Number(result.rows[0]?.attempts ?? 0) > limit)
    throw Object.assign(new Error("Too many enrollment attempts; try again later"), {
      status: 429,
      retryAfter: window === "hour" ? 3600 : 86400,
    });
}
function requireMember(user: SessionUser): void {
  if (user.role !== "member")
    throw Object.assign(new Error("Member access required"), { status: 403 });
}
function requireBusinessOwner(user: SessionUser): void {
  if (user.role !== "owner")
    throw Object.assign(new Error("Business owner access required"), { status: 403 });
}
function referralCode(memberId: string, businessId: string): string {
  const key = process.env["RATE_LIMIT_HMAC_KEY"] ?? "local-test-rate-limit-key";
  return createHmac("sha256", key).update(`referral:${businessId}:${memberId}`).digest("base64url");
}
function memberCode(): string {
  return `ELITE-${randomBytes(10).toString("hex").toUpperCase()}`;
}

export async function getVisualSettings(
  user: SessionUser,
  now: Date = new Date(),
): Promise<VisualSettings> {
  const result = await getPool().query<{
    theme_key: ThemeKey;
    occasion_title: string;
    occasion_message: string;
    automatic_holiday_themes: boolean;
    time_zone: string;
    updated_at: Date;
  }>(
    `SELECT theme_key, occasion_title, occasion_message, automatic_holiday_themes, time_zone, updated_at
       FROM business_visual_settings WHERE business_id = $1`,
    [user.businessId],
  );
  const row = result.rows[0];
  const stored: StoredVisualSettings = row
    ? {
        themeKey: row.theme_key,
        occasionTitle: row.occasion_title,
        occasionMessage: row.occasion_message,
        automaticHolidayThemes: row.automatic_holiday_themes,
        timeZone: normalizeTimeZone(row.time_zone),
        updatedAt: row.updated_at.toISOString(),
      }
    : {
        themeKey: "elite-signature",
        occasionTitle: "",
        occasionMessage: "",
        automaticHolidayThemes: false,
        timeZone: normalizeTimeZone(undefined),
        updatedAt: null,
      };
  return effectiveVisualSettings(stored, now);
}

export async function updateVisualSettings(
  user: SessionUser,
  input: {
    themeKey: ThemeKey;
    occasionTitle: string;
    occasionMessage: string;
    automaticHolidayThemes: boolean;
    timeZone: string;
  },
): Promise<VisualSettings> {
  requireBusinessOwner(user);
  if (!themeKeys.includes(input.themeKey))
    throw Object.assign(new Error("Theme is invalid"), { status: 400 });
  const timeZone = normalizeTimeZone(input.timeZone);
  if (timeZone !== input.timeZone)
    throw Object.assign(new Error("Time zone is invalid"), { status: 400 });
  const result = await getPool().query<{
    theme_key: ThemeKey;
    occasion_title: string;
    occasion_message: string;
    automatic_holiday_themes: boolean;
    time_zone: string;
    updated_at: Date;
  }>(
    `INSERT INTO business_visual_settings(business_id, theme_key, occasion_title, occasion_message, automatic_holiday_themes, time_zone, updated_by_user_id, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,now())
     ON CONFLICT (business_id) DO UPDATE SET
       theme_key = EXCLUDED.theme_key,
       occasion_title = EXCLUDED.occasion_title,
       occasion_message = EXCLUDED.occasion_message,
       automatic_holiday_themes = EXCLUDED.automatic_holiday_themes,
       time_zone = EXCLUDED.time_zone,
       updated_by_user_id = EXCLUDED.updated_by_user_id,
       updated_at = now()
     RETURNING theme_key, occasion_title, occasion_message, automatic_holiday_themes, time_zone, updated_at`,
    [
      user.businessId,
      input.themeKey,
      input.occasionTitle,
      input.occasionMessage,
      input.automaticHolidayThemes,
      timeZone,
      user.id,
    ],
  );
  await getPool().query(
    `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
     VALUES ($1,$2,$3,'business.visual_settings.updated','business',$2,$4)`,
    [
      id("aud"),
      user.businessId,
      user.id,
      JSON.stringify({
        themeKey: input.themeKey,
        automaticHolidayThemes: input.automaticHolidayThemes,
        timeZone,
      }),
    ],
  );
  const row = result.rows[0]!;
  return effectiveVisualSettings({
    themeKey: row.theme_key,
    occasionTitle: row.occasion_title,
    occasionMessage: row.occasion_message,
    automaticHolidayThemes: row.automatic_holiday_themes,
    timeZone: normalizeTimeZone(row.time_zone),
    updatedAt: row.updated_at.toISOString(),
  });
}

export async function getOrCreateReferralLink(user: SessionUser): Promise<{
  sharePath: string;
  referralCount: number;
}> {
  requireMember(user);
  if (!user.locationId)
    throw Object.assign(new Error("Member location is unavailable"), { status: 409 });
  const code = referralCode(user.id, user.businessId);
  await getPool().query(
    `INSERT INTO member_referral_links(id,business_id,location_id,member_id,token_hash)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (member_id) DO UPDATE SET active = true, updated_at = now()
    `,
    [id("rfl"), user.businessId, user.locationId, user.id, tokenHash(code)],
  );
  const count = await getPool().query<{ count: string }>(
    `SELECT count(*) FROM member_referrals
      WHERE business_id = $1 AND referrer_member_id = $2 AND status <> 'void'`,
    [user.businessId, user.id],
  );
  return {
    sharePath: `/join?ref=${encodeURIComponent(code)}`,
    referralCount: Number(count.rows[0]?.count ?? 0),
  };
}

export async function getReferralEnrollment(referralCodeValue: string): Promise<{
  businessName: string;
  locationName: string;
}> {
  const result = await getPool().query<{ business_name: string; location_name: string }>(
    `SELECT b.name AS business_name, l.name AS location_name
       FROM member_referral_links rfl
       JOIN businesses b ON b.id = rfl.business_id
       JOIN locations l ON l.id = rfl.location_id
       JOIN users u ON u.id = rfl.member_id
      WHERE rfl.token_hash = $1 AND rfl.active = true AND u.active = true AND u.role = 'member'`,
    [tokenHash(referralCodeValue)],
  );
  const row = result.rows[0];
  if (!row)
    throw Object.assign(new Error("This referral link is invalid or inactive"), { status: 404 });
  return { businessName: row.business_name, locationName: row.location_name };
}

export async function joinWithReferral(input: {
  referralCode: string;
  name: string;
  email: string;
  password: string;
  requestSubject: string;
}): Promise<{ sessionToken: string }> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await enforceRateLimit(client, "referral.ip.hour", input.requestSubject, 5, "hour");
    await enforceRateLimit(client, "referral.token.day", input.referralCode, 20, "day");
    await enforceRateLimit(client, "referral.email.day", input.email.toLowerCase(), 3, "day");
    const linkResult = await client.query<{
      id: string;
      business_id: string;
      location_id: string;
      member_id: string;
    }>(
      `SELECT rfl.id, rfl.business_id, rfl.location_id, rfl.member_id
         FROM member_referral_links rfl
         JOIN users u ON u.id = rfl.member_id
        WHERE rfl.token_hash = $1 AND rfl.active = true AND u.active = true AND u.role = 'member'
        FOR UPDATE`,
      [tokenHash(input.referralCode)],
    );
    const link = linkResult.rows[0];
    if (!link)
      throw Object.assign(new Error("This referral link is invalid or inactive"), { status: 404 });
    const existing = await client.query("SELECT 1 FROM users WHERE lower(email) = lower($1)", [
      input.email,
    ]);
    if (existing.rowCount)
      throw Object.assign(new Error("Enrollment could not be completed"), { status: 409 });
    const memberId = newUserId();
    const code = memberCode();
    await client.query(
      `INSERT INTO users(id,business_id,location_id,role,name,email,password_hash,member_code)
       VALUES ($1,$2,$3,'member',$4,$5,$6,$7)`,
      [
        memberId,
        link.business_id,
        link.location_id,
        input.name,
        input.email,
        await hashPassword(input.password),
        code,
      ],
    );
    await client.query(
      "INSERT INTO member_balances(business_id,member_id,points) VALUES ($1,$2,0)",
      [link.business_id, memberId],
    );
    await client.query(
      `INSERT INTO member_referrals(id,business_id,referrer_member_id,referred_member_id,referral_link_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [id("ref"), link.business_id, link.member_id, memberId, link.id],
    );
    await client.query(
      `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES ($1,$2,$3,'member.referral.joined','user',$4,$5)`,
      [
        id("aud"),
        link.business_id,
        memberId,
        memberId,
        JSON.stringify({ referrerMemberId: link.member_id }),
      ],
    );
    const sessionToken = await createSession(client, memberId);
    await client.query("COMMIT");
    return { sessionToken };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
