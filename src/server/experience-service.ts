import { createHash, createHmac, randomBytes } from "node:crypto";
import type { SessionUser } from "./auth.ts";
import { createSession, hashPassword, newUserId } from "./auth.ts";
import { getPool, id } from "./database.ts";
import { clientLogoPath } from "./business-branding.ts";
import { normalizeTimeZone, resolveScheduledTheme } from "./holiday-theme-schedule.ts";

export const themeKeys = [
  "elite-signature",
  "mlk-day",
  "remembrance-911",
  "winter-holiday",
  "spring-celebration",
  "community-event",
  "cosmic-neon",
  "royal-purple",
  "ocean-glow",
  "sunset-energy",
] as const;
export type ThemeKey = (typeof themeKeys)[number];
export const fontStyles = ["futuristic", "modern", "classic"] as const;
export type FontStyle = (typeof fontStyles)[number];
export const cornerStyles = ["sharp", "soft", "rounded"] as const;
export type CornerStyle = (typeof cornerStyles)[number];
export type PublicVisualSettings = {
  themeKey: ThemeKey;
  occasionTitle: string;
  occasionMessage: string;
  automaticThemeActive: boolean;
  companySlogan: string;
  companySloganEs: string;
  publicHeadline: string;
  publicHeadlineEs: string;
  publicMessage: string;
  publicMessageEs: string;
  joinHeadline: string;
  joinHeadlineEs: string;
  joinMessage: string;
  joinMessageEs: string;
  memberHeadline: string;
  memberHeadlineEs: string;
  memberMessage: string;
  memberMessageEs: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
  fontStyle: FontStyle;
  cornerStyle: CornerStyle;
  showRewards: boolean;
  showProducts: boolean;
  showReferrals: boolean;
};
export type VisualSettings = PublicVisualSettings & {
  configuredThemeKey: ThemeKey;
  configuredOccasionTitle: string;
  configuredOccasionMessage: string;
  automaticHolidayThemes: boolean;
  timeZone: string;
  automaticThemeName: string | null;
  nextAutomaticTheme: { name: string; localDate: string; dateLabel: string } | null;
  updatedAt: string | null;
};

export function publicVisualSettings(settings: VisualSettings): PublicVisualSettings {
  return {
    themeKey: settings.themeKey,
    occasionTitle: settings.occasionTitle,
    occasionMessage: settings.occasionMessage,
    automaticThemeActive: settings.automaticThemeActive,
    companySlogan: settings.companySlogan,
    companySloganEs: settings.companySloganEs,
    publicHeadline: settings.publicHeadline,
    publicHeadlineEs: settings.publicHeadlineEs,
    publicMessage: settings.publicMessage,
    publicMessageEs: settings.publicMessageEs,
    joinHeadline: settings.joinHeadline,
    joinHeadlineEs: settings.joinHeadlineEs,
    joinMessage: settings.joinMessage,
    joinMessageEs: settings.joinMessageEs,
    memberHeadline: settings.memberHeadline,
    memberHeadlineEs: settings.memberHeadlineEs,
    memberMessage: settings.memberMessage,
    memberMessageEs: settings.memberMessageEs,
    primaryColor: settings.primaryColor,
    accentColor: settings.accentColor,
    backgroundColor: settings.backgroundColor,
    surfaceColor: settings.surfaceColor,
    textColor: settings.textColor,
    mutedColor: settings.mutedColor,
    fontStyle: settings.fontStyle,
    cornerStyle: settings.cornerStyle,
    showRewards: settings.showRewards,
    showProducts: settings.showProducts,
    showReferrals: settings.showReferrals,
  };
}

type StoredVisualSettings = {
  themeKey: ThemeKey;
  occasionTitle: string;
  occasionMessage: string;
  automaticHolidayThemes: boolean;
  timeZone: string;
  updatedAt: string | null;
  companySlogan: string;
  companySloganEs: string;
  publicHeadline: string;
  publicHeadlineEs: string;
  publicMessage: string;
  publicMessageEs: string;
  joinHeadline: string;
  joinHeadlineEs: string;
  joinMessage: string;
  joinMessageEs: string;
  memberHeadline: string;
  memberHeadlineEs: string;
  memberMessage: string;
  memberMessageEs: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
  fontStyle: FontStyle;
  cornerStyle: CornerStyle;
  showRewards: boolean;
  showProducts: boolean;
  showReferrals: boolean;
};

export function effectiveVisualSettings(
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
    companySlogan: stored.companySlogan,
    companySloganEs: stored.companySloganEs,
    publicHeadline: stored.publicHeadline,
    publicHeadlineEs: stored.publicHeadlineEs,
    publicMessage: stored.publicMessage,
    publicMessageEs: stored.publicMessageEs,
    joinHeadline: stored.joinHeadline,
    joinHeadlineEs: stored.joinHeadlineEs,
    joinMessage: stored.joinMessage,
    joinMessageEs: stored.joinMessageEs,
    memberHeadline: stored.memberHeadline,
    memberHeadlineEs: stored.memberHeadlineEs,
    memberMessage: stored.memberMessage,
    memberMessageEs: stored.memberMessageEs,
    primaryColor: stored.primaryColor,
    accentColor: stored.accentColor,
    backgroundColor: stored.backgroundColor,
    surfaceColor: stored.surfaceColor,
    textColor: stored.textColor,
    mutedColor: stored.mutedColor,
    fontStyle: stored.fontStyle,
    cornerStyle: stored.cornerStyle,
    showRewards: stored.showRewards,
    showProducts: stored.showProducts,
    showReferrals: stored.showReferrals,
  };
}

const customizationDefaults = {
  companySlogan: "",
  companySloganEs: "",
  publicHeadline: "",
  publicHeadlineEs: "",
  publicMessage: "",
  publicMessageEs: "",
  joinHeadline: "",
  joinHeadlineEs: "",
  joinMessage: "",
  joinMessageEs: "",
  memberHeadline: "",
  memberHeadlineEs: "",
  memberMessage: "",
  memberMessageEs: "",
  primaryColor: "#F6B900",
  accentColor: "#14E6FF",
  backgroundColor: "#020713",
  surfaceColor: "#07111F",
  textColor: "#FFFAF0",
  mutedColor: "#C7BEA8",
  fontStyle: "futuristic" as FontStyle,
  cornerStyle: "soft" as CornerStyle,
  showRewards: true,
  showProducts: true,
  showReferrals: true,
};

type StoredVisualRow = {
  theme_key: ThemeKey;
  occasion_title: string;
  occasion_message: string;
  automatic_holiday_themes: boolean;
  time_zone: string;
  updated_at: Date;
  company_slogan: string;
  company_slogan_es: string;
  public_headline: string;
  public_headline_es: string;
  public_message: string;
  public_message_es: string;
  join_headline: string;
  join_headline_es: string;
  join_message: string;
  join_message_es: string;
  member_headline: string;
  member_headline_es: string;
  member_message: string;
  member_message_es: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  muted_color: string;
  font_style: FontStyle;
  corner_style: CornerStyle;
  show_rewards: boolean;
  show_products: boolean;
  show_referrals: boolean;
};

function storedVisualSettings(row?: StoredVisualRow): StoredVisualSettings {
  if (!row)
    return {
      themeKey: "elite-signature",
      occasionTitle: "",
      occasionMessage: "",
      automaticHolidayThemes: false,
      timeZone: normalizeTimeZone(undefined),
      updatedAt: null,
      ...customizationDefaults,
    };
  const defaults = customizationDefaults;
  return {
    themeKey: row.theme_key,
    occasionTitle: row.occasion_title,
    occasionMessage: row.occasion_message,
    automaticHolidayThemes: row.automatic_holiday_themes,
    timeZone: normalizeTimeZone(row.time_zone),
    updatedAt: row.updated_at.toISOString(),
    companySlogan: row.company_slogan ?? defaults.companySlogan,
    companySloganEs: row.company_slogan_es ?? defaults.companySloganEs,
    publicHeadline: row.public_headline ?? defaults.publicHeadline,
    publicHeadlineEs: row.public_headline_es ?? defaults.publicHeadlineEs,
    publicMessage: row.public_message ?? defaults.publicMessage,
    publicMessageEs: row.public_message_es ?? defaults.publicMessageEs,
    joinHeadline: row.join_headline ?? defaults.joinHeadline,
    joinHeadlineEs: row.join_headline_es ?? defaults.joinHeadlineEs,
    joinMessage: row.join_message ?? defaults.joinMessage,
    joinMessageEs: row.join_message_es ?? defaults.joinMessageEs,
    memberHeadline: row.member_headline ?? defaults.memberHeadline,
    memberHeadlineEs: row.member_headline_es ?? defaults.memberHeadlineEs,
    memberMessage: row.member_message ?? defaults.memberMessage,
    memberMessageEs: row.member_message_es ?? defaults.memberMessageEs,
    primaryColor: row.primary_color ?? defaults.primaryColor,
    accentColor: row.accent_color ?? defaults.accentColor,
    backgroundColor: row.background_color ?? defaults.backgroundColor,
    surfaceColor: row.surface_color ?? defaults.surfaceColor,
    textColor: row.text_color ?? defaults.textColor,
    mutedColor: row.muted_color ?? defaults.mutedColor,
    fontStyle: row.font_style ?? defaults.fontStyle,
    cornerStyle: row.corner_style ?? defaults.cornerStyle,
    showRewards: row.show_rewards ?? defaults.showRewards,
    showProducts: row.show_products ?? defaults.showProducts,
    showReferrals: row.show_referrals ?? defaults.showReferrals,
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
function requirePlatformAdmin(user: SessionUser): void {
  if (!user.platformAdmin)
    throw Object.assign(new Error("Platform administrator access required"), { status: 403 });
}
function referralCode(memberId: string, businessId: string): string {
  const key = process.env["RATE_LIMIT_HMAC_KEY"] ?? "local-test-rate-limit-key";
  return createHmac("sha256", key).update(`referral:${businessId}:${memberId}`).digest("base64url");
}
function memberCode(): string {
  return `ELITE-${randomBytes(10).toString("hex").toUpperCase()}`;
}

export async function getBusinessEnrollment(businessId: string): Promise<{
  businessId: string;
  businessName: string;
  locationName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  visualSettings: PublicVisualSettings;
  loyaltyMode: "points" | "visits";
}> {
  const result = await getPool().query<{
    id: string;
    name: string;
    location_name: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
    has_logo: boolean;
    updated_at: Date;
    loyalty_mode: "points" | "visits";
  }>(
    `SELECT b.id, b.name, l.name AS location_name, b.logo_url, b.primary_color,
            b.secondary_color, b.updated_at, b.loyalty_mode, (b.logo_data IS NOT NULL) AS has_logo
       FROM businesses b
       JOIN locations l ON l.business_id = b.id
      WHERE b.id = $1
        AND b.active = true
        AND b.id <> (SELECT business_id FROM platform_state WHERE singleton = true)
      ORDER BY l.created_at, l.id
      LIMIT 1`,
    [businessId],
  );
  const row = result.rows[0];
  if (!row) throw Object.assign(new Error("This rewards program is unavailable"), { status: 404 });
  return {
    businessId: row.id,
    businessName: row.name,
    locationName: row.location_name,
    logoUrl: row.has_logo ? clientLogoPath(row.id, row.updated_at) : row.logo_url,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    visualSettings: publicVisualSettings(await getBusinessVisualSettings(row.id)),
    loyaltyMode: row.loyalty_mode,
  };
}

export async function joinBusinessRewards(input: {
  businessId: string;
  name: string;
  email: string;
  password: string;
  requestSubject: string;
}): Promise<{ sessionToken: string }> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await enforceRateLimit(client, "business-enrollment.ip.hour", input.requestSubject, 5, "hour");
    await enforceRateLimit(
      client,
      "business-enrollment.business.day",
      input.businessId,
      100,
      "day",
    );
    await enforceRateLimit(
      client,
      "business-enrollment.email.day",
      input.email.toLowerCase(),
      3,
      "day",
    );
    const program = await client.query<{ business_id: string; location_id: string }>(
      `SELECT b.id AS business_id, l.id AS location_id
         FROM businesses b
         JOIN locations l ON l.business_id = b.id
        WHERE b.id = $1
          AND b.active = true
          AND b.id <> (SELECT business_id FROM platform_state WHERE singleton = true)
        ORDER BY l.created_at, l.id
        LIMIT 1`,
      [input.businessId],
    );
    const business = program.rows[0];
    if (!business)
      throw Object.assign(new Error("This rewards program is unavailable"), { status: 404 });
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
        business.business_id,
        business.location_id,
        input.name,
        input.email,
        await hashPassword(input.password),
        code,
      ],
    );
    await client.query(
      "INSERT INTO member_balances(business_id,member_id,points,visits) VALUES ($1,$2,0,0)",
      [business.business_id, memberId],
    );
    await client.query(
      `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES ($1,$2,$3,'member.self_enrolled','user',$3,$4)`,
      [id("aud"), business.business_id, memberId, JSON.stringify({ source: "business_join_link" })],
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

export async function getVisualSettings(
  user: SessionUser,
  now: Date = new Date(),
): Promise<VisualSettings> {
  const result = await getPool().query<StoredVisualRow>(
    `SELECT theme_key, occasion_title, occasion_message, automatic_holiday_themes, time_zone, updated_at,
            company_slogan, company_slogan_es, public_headline, public_headline_es,
            public_message, public_message_es, join_headline, join_headline_es, join_message, join_message_es,
            member_headline, member_headline_es, member_message, member_message_es,
            primary_color, accent_color, background_color, surface_color, text_color, muted_color,
            font_style, corner_style, show_rewards, show_products, show_referrals
       FROM business_visual_settings WHERE business_id = $1`,
    [user.businessId],
  );
  return effectiveVisualSettings(storedVisualSettings(result.rows[0]), now);
}

export async function getBusinessVisualSettings(
  businessId: string,
  now: Date = new Date(),
): Promise<VisualSettings> {
  const result = await getPool().query<StoredVisualRow>(
    `SELECT theme_key, occasion_title, occasion_message, automatic_holiday_themes, time_zone, updated_at,
            company_slogan, company_slogan_es, public_headline, public_headline_es,
            public_message, public_message_es, join_headline, join_headline_es, join_message, join_message_es,
            member_headline, member_headline_es, member_message, member_message_es,
            primary_color, accent_color, background_color, surface_color, text_color, muted_color,
            font_style, corner_style, show_rewards, show_products, show_referrals
       FROM business_visual_settings WHERE business_id = $1`,
    [businessId],
  );
  return effectiveVisualSettings(storedVisualSettings(result.rows[0]), now);
}

export async function getClientVisualSettings(
  user: SessionUser,
  businessId: string,
): Promise<VisualSettings> {
  requirePlatformAdmin(user);
  const client = await getPool().query(
    `SELECT 1 FROM businesses
      WHERE id = $1 AND id <> (SELECT business_id FROM platform_state WHERE singleton = true)`,
    [businessId],
  );
  if (!client.rowCount) throw Object.assign(new Error("Client not found"), { status: 404 });
  return getBusinessVisualSettings(businessId);
}

export async function updateClientVisualSettings(
  user: SessionUser,
  businessId: string,
  input: {
    themeKey: ThemeKey;
    occasionTitle: string;
    occasionMessage: string;
    automaticHolidayThemes: boolean;
    timeZone: string;
    companySlogan?: string;
    companySloganEs?: string;
    publicHeadline?: string;
    publicHeadlineEs?: string;
    publicMessage?: string;
    publicMessageEs?: string;
    joinHeadline?: string;
    joinHeadlineEs?: string;
    joinMessage?: string;
    joinMessageEs?: string;
    memberHeadline?: string;
    memberHeadlineEs?: string;
    memberMessage?: string;
    memberMessageEs?: string;
    primaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    surfaceColor?: string;
    textColor?: string;
    mutedColor?: string;
    fontStyle?: FontStyle;
    cornerStyle?: CornerStyle;
    showRewards?: boolean;
    showProducts?: boolean;
    showReferrals?: boolean;
  },
): Promise<VisualSettings> {
  requirePlatformAdmin(user);
  if (!themeKeys.includes(input.themeKey))
    throw Object.assign(new Error("Theme is invalid"), { status: 400 });
  const timeZone = normalizeTimeZone(input.timeZone);
  if (timeZone !== input.timeZone)
    throw Object.assign(new Error("Time zone is invalid"), { status: 400 });
  const customization = {
    ...customizationDefaults,
    companySlogan: input.companySlogan ?? customizationDefaults.companySlogan,
    companySloganEs: input.companySloganEs ?? customizationDefaults.companySloganEs,
    publicHeadline: input.publicHeadline ?? customizationDefaults.publicHeadline,
    publicHeadlineEs: input.publicHeadlineEs ?? customizationDefaults.publicHeadlineEs,
    publicMessage: input.publicMessage ?? customizationDefaults.publicMessage,
    publicMessageEs: input.publicMessageEs ?? customizationDefaults.publicMessageEs,
    joinHeadline: input.joinHeadline ?? customizationDefaults.joinHeadline,
    joinHeadlineEs: input.joinHeadlineEs ?? customizationDefaults.joinHeadlineEs,
    joinMessage: input.joinMessage ?? customizationDefaults.joinMessage,
    joinMessageEs: input.joinMessageEs ?? customizationDefaults.joinMessageEs,
    memberHeadline: input.memberHeadline ?? customizationDefaults.memberHeadline,
    memberHeadlineEs: input.memberHeadlineEs ?? customizationDefaults.memberHeadlineEs,
    memberMessage: input.memberMessage ?? customizationDefaults.memberMessage,
    memberMessageEs: input.memberMessageEs ?? customizationDefaults.memberMessageEs,
    primaryColor: input.primaryColor ?? customizationDefaults.primaryColor,
    accentColor: input.accentColor ?? customizationDefaults.accentColor,
    backgroundColor: input.backgroundColor ?? customizationDefaults.backgroundColor,
    surfaceColor: input.surfaceColor ?? customizationDefaults.surfaceColor,
    textColor: input.textColor ?? customizationDefaults.textColor,
    mutedColor: input.mutedColor ?? customizationDefaults.mutedColor,
    fontStyle: input.fontStyle ?? customizationDefaults.fontStyle,
    cornerStyle: input.cornerStyle ?? customizationDefaults.cornerStyle,
    showRewards: input.showRewards ?? customizationDefaults.showRewards,
    showProducts: input.showProducts ?? customizationDefaults.showProducts,
    showReferrals: input.showReferrals ?? customizationDefaults.showReferrals,
  };
  if (!fontStyles.includes(customization.fontStyle))
    throw Object.assign(new Error("Font style is invalid"), { status: 400 });
  if (!cornerStyles.includes(customization.cornerStyle))
    throw Object.assign(new Error("Corner style is invalid"), { status: 400 });
  const target = await getPool().query(
    `SELECT 1 FROM businesses
      WHERE id = $1 AND id <> (SELECT business_id FROM platform_state WHERE singleton = true)`,
    [businessId],
  );
  if (!target.rowCount) throw Object.assign(new Error("Client not found"), { status: 404 });
  const connection = await getPool().connect();
  try {
    await connection.query("BEGIN");
    await connection.query(
      `INSERT INTO business_visual_settings(
         business_id,theme_key,occasion_title,occasion_message,automatic_holiday_themes,time_zone,
         company_slogan,company_slogan_es,public_headline,public_headline_es,public_message,public_message_es,
         join_headline,join_headline_es,join_message,join_message_es,member_headline,member_headline_es,member_message,member_message_es,
         primary_color,accent_color,background_color,surface_color,text_color,muted_color,font_style,corner_style,
         show_rewards,show_products,show_referrals,updated_by_user_id,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,now())
       ON CONFLICT (business_id) DO UPDATE SET
         theme_key = EXCLUDED.theme_key,
         occasion_title = EXCLUDED.occasion_title,
         occasion_message = EXCLUDED.occasion_message,
         automatic_holiday_themes = EXCLUDED.automatic_holiday_themes,
         time_zone = EXCLUDED.time_zone,
         company_slogan = EXCLUDED.company_slogan,
         company_slogan_es = EXCLUDED.company_slogan_es,
         public_headline = EXCLUDED.public_headline,
         public_headline_es = EXCLUDED.public_headline_es,
         public_message = EXCLUDED.public_message,
         public_message_es = EXCLUDED.public_message_es,
         join_headline = EXCLUDED.join_headline,
         join_headline_es = EXCLUDED.join_headline_es,
         join_message = EXCLUDED.join_message,
         join_message_es = EXCLUDED.join_message_es,
         member_headline = EXCLUDED.member_headline,
         member_headline_es = EXCLUDED.member_headline_es,
         member_message = EXCLUDED.member_message,
         member_message_es = EXCLUDED.member_message_es,
         primary_color = EXCLUDED.primary_color,
         accent_color = EXCLUDED.accent_color,
         background_color = EXCLUDED.background_color,
         surface_color = EXCLUDED.surface_color,
         text_color = EXCLUDED.text_color,
         muted_color = EXCLUDED.muted_color,
         font_style = EXCLUDED.font_style,
         corner_style = EXCLUDED.corner_style,
         show_rewards = EXCLUDED.show_rewards,
         show_products = EXCLUDED.show_products,
         show_referrals = EXCLUDED.show_referrals,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_at = now()`,
      [
        businessId,
        input.themeKey,
        input.occasionTitle,
        input.occasionMessage,
        input.automaticHolidayThemes,
        timeZone,
        customization.companySlogan,
        customization.companySloganEs,
        customization.publicHeadline,
        customization.publicHeadlineEs,
        customization.publicMessage,
        customization.publicMessageEs,
        customization.joinHeadline,
        customization.joinHeadlineEs,
        customization.joinMessage,
        customization.joinMessageEs,
        customization.memberHeadline,
        customization.memberHeadlineEs,
        customization.memberMessage,
        customization.memberMessageEs,
        customization.primaryColor,
        customization.accentColor,
        customization.backgroundColor,
        customization.surfaceColor,
        customization.textColor,
        customization.mutedColor,
        customization.fontStyle,
        customization.cornerStyle,
        customization.showRewards,
        customization.showProducts,
        customization.showReferrals,
        user.id,
      ],
    );
    await connection.query(
      `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES ($1,$2,$3,'platform.client.visual_settings.updated','business',$2,$4)`,
      [
        id("aud"),
        businessId,
        user.id,
        JSON.stringify({
          themeKey: input.themeKey,
          automaticHolidayThemes: input.automaticHolidayThemes,
          timeZone,
          fontStyle: customization.fontStyle,
          cornerStyle: customization.cornerStyle,
          showRewards: customization.showRewards,
          showProducts: customization.showProducts,
          showReferrals: customization.showReferrals,
        }),
      ],
    );
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
  return getBusinessVisualSettings(businessId);
}

export async function getOrCreateReferralLink(user: SessionUser): Promise<{
  sharePath: string;
  referralCount: number;
}> {
  requireMember(user);
  const business = await getPool().query(
    "SELECT 1 FROM businesses WHERE id = $1 AND active = true",
    [user.businessId],
  );
  if (!business.rowCount)
    throw Object.assign(new Error("This rewards program is unavailable"), { status: 404 });
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
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  loyaltyMode: "points" | "visits";
  visualSettings: PublicVisualSettings;
}> {
  const result = await getPool().query<{
    business_id: string;
    business_name: string;
    location_name: string;
    logo_url: string | null;
    has_logo: boolean;
    primary_color: string;
    secondary_color: string;
    loyalty_mode: "points" | "visits";
    updated_at: Date;
  }>(
    `SELECT b.id AS business_id, b.name AS business_name, l.name AS location_name,
            b.logo_url, (b.logo_data IS NOT NULL) AS has_logo, b.primary_color,
            b.secondary_color, b.loyalty_mode, b.updated_at
       FROM member_referral_links rfl
       JOIN businesses b ON b.id = rfl.business_id
       JOIN locations l ON l.id = rfl.location_id
       JOIN users u ON u.id = rfl.member_id
      WHERE rfl.token_hash = $1 AND rfl.active = true AND u.active = true
        AND u.role = 'member' AND b.active = true`,
    [tokenHash(referralCodeValue)],
  );
  const row = result.rows[0];
  if (!row)
    throw Object.assign(new Error("This referral link is invalid or inactive"), { status: 404 });
  return {
    businessName: row.business_name,
    locationName: row.location_name,
    logoUrl: row.has_logo ? clientLogoPath(row.business_id, row.updated_at) : row.logo_url,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    loyaltyMode: row.loyalty_mode,
    visualSettings: publicVisualSettings(await getBusinessVisualSettings(row.business_id)),
  };
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
         JOIN businesses b ON b.id = rfl.business_id
        WHERE rfl.token_hash = $1 AND rfl.active = true AND u.active = true
          AND u.role = 'member' AND b.active = true
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
      "INSERT INTO member_balances(business_id,member_id,points,visits) VALUES ($1,$2,0,0)",
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
