import { createHash, timingSafeEqual } from "node:crypto";
import {
  authenticate,
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  newUserId,
  requirePlatformAdmin,
  requireRole,
  setSessionCookie,
} from "./auth.ts";
import { getPool, id, migrateDatabase } from "./database.ts";
import {
  activateClient,
  createClient,
  getClientBranding,
  getClientInvitation,
  getClientLogo,
  getPublicClientExperience,
  listClients,
  resetClientBranding,
  setClientActive,
  updateClientBranding,
  updateClientLogo,
} from "./clients-service.ts";
import {
  activateMember,
  createMemberInvitation,
  getMemberInvitation,
  listMembers,
} from "./members-service.ts";
import { awardPoints, getDashboard, getWallet, redeemReward } from "./rewards-service.ts";
import {
  archiveReward,
  archiveClientReward,
  createClientReward,
  createReward,
  listClientRewards,
  listManagedRewards,
  updateClientReward,
  updateReward,
} from "./reward-management-service.ts";
import {
  getBusinessEnrollment,
  getClientVisualSettings,
  getOrCreateReferralLink,
  getReferralEnrollment,
  getVisualSettings,
  joinBusinessRewards,
  joinWithReferral,
  publicVisualSettings,
  themeKeys,
  updateClientVisualSettings,
  updateVisualSettings,
} from "./experience-service.ts";
import {
  archiveClientProduct,
  archiveProduct,
  createClientProduct,
  createProduct,
  getProductImage,
  listClientProducts,
  listManagedProducts,
  updateClientProductImage,
  updateClientProduct,
  updateProductImage,
  updateProduct,
} from "./products-service.ts";
import { CLIENT_LOGO_MAX_BYTES } from "../lib/upload-limits.ts";
import {
  completePasswordReset,
  getPasswordResetStatus,
  issuePasswordReset,
  listPasswordResetRequests,
  requestPasswordReset,
} from "./password-reset-service.ts";
import {
  getClientLoyaltySettings,
  getLoyaltySettings,
  parseLoyaltyMode,
  updateClientLoyaltySettings,
  updateLoyaltySettings,
} from "./loyalty-settings-service.ts";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...headers } });
}

async function imageUpload(
  request: Request,
  label = "Logo",
  maxBytes = 2_097_152,
): Promise<{
  mime: "image/png" | "image/jpeg" | "image/webp";
  data: Buffer;
}> {
  const mime = request.headers.get("content-type")?.split(";")[0]?.trim();
  if (mime !== "image/png" && mime !== "image/jpeg" && mime !== "image/webp")
    throw Object.assign(new Error(`${label} must be a PNG, JPEG, or WebP image`), { status: 415 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes)
    throw Object.assign(new Error(`${label} is too large`), { status: 413 });
  const data = Buffer.from(await request.arrayBuffer());
  if (!data.length || data.length > maxBytes)
    throw Object.assign(new Error(`${label} is too large`), { status: 413 });
  return { mime, data };
}

async function body(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json"))
    throw Object.assign(new Error("JSON request required"), { status: 415 });
  const parsed = await request.json();
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw Object.assign(new Error("Invalid request body"), { status: 400 });
  return parsed as Record<string, unknown>;
}

function text(value: unknown, name: string, min = 1, max = 200): string {
  if (typeof value !== "string")
    throw Object.assign(new Error(`${name} is required`), { status: 400 });
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max)
    throw Object.assign(new Error(`${name} is invalid`), { status: 400 });
  return normalized;
}

function integer(value: unknown, name: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max)
    throw Object.assign(new Error(`${name} is invalid`), { status: 400 });
  return Number(value);
}

function color(value: unknown, name: string): string {
  const normalized = text(value, name, 7, 7).toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normalized))
    throw Object.assign(new Error(`${name} is invalid`), { status: 400 });
  return normalized;
}

function optionalHttpsUrl(value: unknown, name: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = text(value, name, 1, 2048);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw Object.assign(new Error(`${name} is invalid`), { status: 400 });
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    throw Object.assign(new Error(`${name} must use a public HTTPS URL`), { status: 400 });
  return parsed.toString();
}

function productInput(payload: Record<string, unknown>) {
  if (typeof payload["active"] !== "boolean")
    throw Object.assign(new Error("Active status is required"), { status: 400 });
  return {
    name: text(payload["name"], "Product name", 2, 120),
    description: text(payload["description"] ?? "", "Description", 0, 1000),
    category: text(payload["category"] ?? "", "Category", 0, 80),
    priceCents: integer(payload["priceCents"], "Price", 0, 100_000_000),
    pointsCost: integer(payload["pointsCost"], "Points", 1, 1_000_000),
    visitsCost: integer(payload["visitsCost"], "Visits", 1, 1_000_000),
    imageUrl: optionalHttpsUrl(payload["imageUrl"], "Product image"),
    purchaseUrl: optionalHttpsUrl(payload["purchaseUrl"], "Purchase link"),
    active: payload["active"],
  };
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function requestSubject(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unavailable";
}

export async function setupProductionProgram(payload: Record<string, unknown>) {
  const setupToken = process.env["SETUP_TOKEN"];
  if (!setupToken || !safeEqual(text(payload["setupToken"], "Setup token", 24), setupToken))
    throw Object.assign(new Error("Invalid setup token"), { status: 403 });
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const setupLock = await client.query<{ singleton: boolean }>(
      "SELECT singleton FROM platform_state WHERE singleton = true FOR UPDATE",
    );
    if (setupLock.rowCount)
      throw Object.assign(new Error("Setup is already complete"), { status: 409 });
    const businessId = id("biz");
    const locationId = id("loc");
    const ownerId = newUserId();
    const businessName = text(payload["businessName"], "Business name", 2, 120);
    const locationName = text(payload["locationName"], "Location name", 2, 120);
    const ownerName = text(payload["ownerName"], "Owner name", 2, 120);
    const ownerEmail = text(payload["ownerEmail"], "Owner email", 5, 254).toLowerCase();
    const ownerPassword = text(payload["ownerPassword"], "Owner password", 8, 200);
    await client.query("INSERT INTO businesses(id,name) VALUES ($1,$2)", [
      businessId,
      businessName,
    ]);
    await client.query("INSERT INTO platform_state(singleton,business_id) VALUES (true,$1)", [
      businessId,
    ]);
    await client.query("INSERT INTO locations(id,business_id,name) VALUES ($1,$2,$3)", [
      locationId,
      businessId,
      locationName,
    ]);
    await client.query(
      "INSERT INTO users(id,business_id,location_id,role,name,email,password_hash,platform_admin) VALUES ($1,$2,$3,'owner',$4,$5,$6,true)",
      [ownerId, businessId, locationId, ownerName, ownerEmail, await hashPassword(ownerPassword)],
    );
    const rewardRows = [
      [id("rew"), "$5 off", "Take $5 off your next purchase.", 500],
      [id("rew"), "Free favorite", "Choose one eligible item on us.", 850],
      [id("rew"), "$15 reward", "A bigger thank-you for loyal members.", 1200],
    ];
    for (const reward of rewardRows)
      await client.query(
        "INSERT INTO rewards(id,business_id,name,description,points_cost) VALUES ($1,$2,$3,$4,$5)",
        [reward[0], businessId, reward[1], reward[2], reward[3]],
      );
    await client.query(
      "INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata) VALUES ($1,$2,$3,'system.setup','business',$2,$4)",
      [id("aud"), businessId, ownerId, JSON.stringify({ locationId })],
    );
    const token = await createSession(client, ownerId);
    await client.query("COMMIT");
    return { token, ownerId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function normalizedOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password)
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isSameOrigin(request: Request): boolean {
  const origin = normalizedOrigin(request.headers.get("origin"));
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || (fetchSite && fetchSite !== "same-origin")) return false;

  const allowedOrigins = new Set<string>([new URL(request.url).origin]);
  const configuredOrigin = normalizedOrigin(
    process.env["APP_ORIGIN"] ?? process.env["RENDER_EXTERNAL_URL"] ?? null,
  );
  if (configuredOrigin) allowedOrigins.add(configuredOrigin);
  return allowedOrigins.has(origin);
}

export async function handleApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  try {
    if (request.method !== "GET" && !isSameOrigin(request))
      return json({ error: "Cross-origin request rejected" }, 403);
    await migrateDatabase();
    if (url.pathname === "/api/health" && request.method === "GET") {
      await getPool().query("SELECT 1");
      return json({ ok: true, database: "connected" });
    }
    if (url.pathname === "/api/setup/status" && request.method === "GET") {
      const result = await getPool().query<{ count: string }>(
        "SELECT count(*) FROM users WHERE role = 'owner'",
      );
      return json({ setupRequired: Number(result.rows[0]?.count ?? 0) === 0 });
    }
    if (url.pathname === "/api/setup" && request.method === "POST") {
      const result = await setupProductionProgram(await body(request));
      return json({ ok: true }, 201, { "set-cookie": setSessionCookie(result.token) });
    }
    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const payload = await body(request);
      const result = await authenticate(
        text(payload["email"], "Email", 5, 254),
        text(payload["password"], "Password", 1, 200),
      );
      if (!result) return json({ error: "Invalid credentials or account temporarily locked" }, 401);
      return json({ user: result.user }, 200, { "set-cookie": setSessionCookie(result.token) });
    }
    if (url.pathname === "/api/auth/forgot-password" && request.method === "POST") {
      const payload = await body(request);
      await requestPasswordReset(
        text(payload["email"], "Email", 5, 254).toLowerCase(),
        requestSubject(request),
      );
      return json({ ok: true }, 202);
    }
    if (url.pathname === "/api/auth/password-reset/status" && request.method === "GET") {
      const token = text(url.searchParams.get("token"), "Password reset token", 32, 200);
      return json(await getPasswordResetStatus(token));
    }
    if (url.pathname === "/api/auth/password-reset" && request.method === "POST") {
      const payload = await body(request);
      const result = await completePasswordReset(
        text(payload["token"], "Password reset token", 32, 200),
        text(payload["password"], "Password", 8, 200),
      );
      return json({ ok: true, role: result.role });
    }
    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      await destroySession(request);
      return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
    }
    if (url.pathname === "/api/client-invitations/status" && request.method === "GET") {
      const token = text(url.searchParams.get("token"), "Invitation token", 32, 200);
      return json(await getClientInvitation(token));
    }
    if (url.pathname === "/api/client-invitations/activate" && request.method === "POST") {
      const payload = await body(request);
      const result = await activateClient(
        text(payload["token"], "Invitation token", 32, 200),
        text(payload["password"], "Password", 8, 200),
      );
      return json({ ok: true }, 201, { "set-cookie": setSessionCookie(result.sessionToken) });
    }
    if (url.pathname === "/api/member-invitations/status" && request.method === "GET") {
      const token = text(url.searchParams.get("token"), "Invitation token", 32, 200);
      return json(await getMemberInvitation(token));
    }
    if (url.pathname === "/api/member-invitations/activate" && request.method === "POST") {
      const payload = await body(request);
      const result = await activateMember(
        text(payload["token"], "Invitation token", 32, 200),
        text(payload["password"], "Password", 8, 200),
      );
      return json({ ok: true }, 201, { "set-cookie": setSessionCookie(result.sessionToken) });
    }
    if (url.pathname === "/api/referrals/enrollment" && request.method === "GET") {
      const code = text(url.searchParams.get("ref"), "Referral code", 20, 200);
      return json(await getReferralEnrollment(code));
    }
    if (url.pathname === "/api/referrals/join" && request.method === "POST") {
      const payload = await body(request);
      const result = await joinWithReferral({
        referralCode: text(payload["referralCode"], "Referral code", 20, 200),
        name: text(payload["name"], "Name", 2, 120),
        email: text(payload["email"], "Email", 5, 254).toLowerCase(),
        password: text(payload["password"], "Password", 8, 200),
        requestSubject: requestSubject(request),
      });
      return json({ ok: true }, 201, { "set-cookie": setSessionCookie(result.sessionToken) });
    }
    const businessEnrollmentMatch = url.pathname.match(
      /^\/api\/public\/clients\/([^/]+)\/enrollment$/,
    );
    if (businessEnrollmentMatch && request.method === "GET") {
      const businessId = text(
        decodeURIComponent(businessEnrollmentMatch[1] ?? ""),
        "Client",
        8,
        120,
      );
      return json(await getBusinessEnrollment(businessId));
    }
    if (businessEnrollmentMatch && request.method === "POST") {
      const businessId = text(
        decodeURIComponent(businessEnrollmentMatch[1] ?? ""),
        "Client",
        8,
        120,
      );
      const payload = await body(request);
      const result = await joinBusinessRewards({
        businessId,
        name: text(payload["name"], "Name", 2, 120),
        email: text(payload["email"], "Email", 5, 254).toLowerCase(),
        password: text(payload["password"], "Password", 8, 200),
        requestSubject: requestSubject(request),
      });
      return json({ ok: true }, 201, { "set-cookie": setSessionCookie(result.sessionToken) });
    }
    const publicClientMatch = url.pathname.match(/^\/api\/public\/clients\/([^/]+)$/);
    if (publicClientMatch && request.method === "GET") {
      const businessId = text(decodeURIComponent(publicClientMatch[1] ?? ""), "Client", 8, 120);
      return json(await getPublicClientExperience(businessId));
    }
    const publicClientLogoMatch = url.pathname.match(/^\/api\/public\/clients\/([^/]+)\/logo$/);
    if (publicClientLogoMatch && request.method === "GET") {
      const businessId = text(decodeURIComponent(publicClientLogoMatch[1] ?? ""), "Client", 8, 120);
      const logo = await getClientLogo(businessId);
      if (!logo) return json({ error: "Logo not found" }, 404);
      const etag = `"${createHash("sha256").update(logo.data).digest("base64url")}"`;
      if (request.headers.get("if-none-match") === etag)
        return new Response(null, { status: 304, headers: { etag } });
      return new Response(new Uint8Array(logo.data), {
        headers: {
          "content-type": logo.mime,
          "cache-control": "public, max-age=31536000, immutable",
          etag,
          "x-content-type-options": "nosniff",
        },
      });
    }
    const publicProductImageMatch = url.pathname.match(/^\/api\/public\/products\/([^/]+)\/image$/);
    if (publicProductImageMatch && request.method === "GET") {
      const productId = text(
        decodeURIComponent(publicProductImageMatch[1] ?? ""),
        "Product",
        8,
        120,
      );
      const image = await getProductImage(productId);
      if (!image) return json({ error: "Product image not found" }, 404);
      const etag = `"${createHash("sha256").update(image.data).digest("base64url")}"`;
      if (request.headers.get("if-none-match") === etag)
        return new Response(null, { status: 304, headers: { etag } });
      return new Response(new Uint8Array(image.data), {
        headers: {
          "content-type": image.mime,
          "cache-control": "public, max-age=3600, must-revalidate",
          etag,
          "x-content-type-options": "nosniff",
        },
      });
    }
    const user = await getSessionUser(request);
    if (url.pathname === "/api/auth/session" && request.method === "GET") return json({ user });
    if (url.pathname === "/api/admin/dashboard" && request.method === "GET") {
      requireRole(user, ["owner", "staff"]);
      return json(await getDashboard(user));
    }
    if (url.pathname === "/api/visual-settings" && request.method === "GET") {
      requireRole(user, ["owner", "staff", "member"]);
      const settings = await getVisualSettings(user);
      return json(user.role === "member" ? publicVisualSettings(settings) : settings);
    }
    if (url.pathname === "/api/admin/visual-settings" && request.method === "PUT") {
      requireRole(user, ["owner"]);
      const payload = await body(request);
      const themeKey = text(payload["themeKey"], "Theme", 3, 40);
      if (!themeKeys.includes(themeKey as (typeof themeKeys)[number]))
        throw Object.assign(new Error("Theme is invalid"), { status: 400 });
      return json(
        await updateVisualSettings(user, {
          themeKey: themeKey as (typeof themeKeys)[number],
          occasionTitle: text(payload["occasionTitle"] ?? "", "Occasion title", 0, 80),
          occasionMessage: text(payload["occasionMessage"] ?? "", "Occasion message", 0, 220),
          automaticHolidayThemes: payload["automaticHolidayThemes"] === true,
          timeZone: text(payload["timeZone"] ?? "UTC", "Time zone", 1, 100),
        }),
      );
    }
    if (url.pathname === "/api/admin/clients" && request.method === "GET") {
      requirePlatformAdmin(user);
      return json({ clients: await listClients(user) });
    }
    if (url.pathname === "/api/admin/password-resets" && request.method === "GET") {
      requirePlatformAdmin(user);
      return json({ requests: await listPasswordResetRequests(user) });
    }
    const passwordResetIssueMatch = url.pathname.match(
      /^\/api\/admin\/password-resets\/([^/]+)\/issue$/,
    );
    if (passwordResetIssueMatch && request.method === "POST") {
      requirePlatformAdmin(user);
      const requestId = text(
        decodeURIComponent(passwordResetIssueMatch[1] ?? ""),
        "Password reset request",
        8,
        120,
      );
      return json(await issuePasswordReset(user, requestId), 201);
    }
    if (url.pathname === "/api/admin/clients" && request.method === "POST") {
      requirePlatformAdmin(user);
      const payload = await body(request);
      const result = await createClient(user, {
        businessName: text(payload["businessName"], "Business name", 2, 120),
        locationName: text(payload["locationName"], "Location name", 2, 120),
        ownerName: text(payload["ownerName"], "Owner name", 2, 120),
        ownerEmail: text(payload["ownerEmail"], "Owner email", 5, 254).toLowerCase(),
      });
      return json(result, 201);
    }
    const clientStatusMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/status$/);
    if (clientStatusMatch && request.method === "PUT") {
      requirePlatformAdmin(user);
      const businessId = text(decodeURIComponent(clientStatusMatch[1] ?? ""), "Client", 8, 120);
      const payload = await body(request);
      if (typeof payload["active"] !== "boolean")
        throw Object.assign(new Error("Active status is required"), { status: 400 });
      return json({ client: await setClientActive(user, businessId, payload["active"]) });
    }
    const clientLoyaltyMatch = url.pathname.match(
      /^\/api\/admin\/clients\/([^/]+)\/loyalty-settings$/,
    );
    if (clientLoyaltyMatch && request.method === "GET") {
      requirePlatformAdmin(user);
      const businessId = text(decodeURIComponent(clientLoyaltyMatch[1] ?? ""), "Client", 8, 120);
      return json(await getClientLoyaltySettings(user, businessId));
    }
    if (clientLoyaltyMatch && request.method === "PUT") {
      requirePlatformAdmin(user);
      const businessId = text(decodeURIComponent(clientLoyaltyMatch[1] ?? ""), "Client", 8, 120);
      const payload = await body(request);
      return json(
        await updateClientLoyaltySettings(
          user,
          businessId,
          parseLoyaltyMode(payload["loyaltyMode"]),
        ),
      );
    }
    const clientBrandingMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/branding$/);
    if (clientBrandingMatch && request.method === "GET") {
      requirePlatformAdmin(user);
      const businessId = text(decodeURIComponent(clientBrandingMatch[1] ?? ""), "Client", 8, 120);
      return json({ branding: await getClientBranding(user, businessId) });
    }
    if (clientBrandingMatch && request.method === "PUT") {
      requirePlatformAdmin(user);
      const businessId = text(decodeURIComponent(clientBrandingMatch[1] ?? ""), "Client", 8, 120);
      const payload = await body(request);
      const branding = await updateClientBranding(user, businessId, {
        name: text(payload["name"], "Business name", 2, 120),
        locationName: text(payload["locationName"], "Location name", 2, 120),
        primaryColor: color(payload["primaryColor"], "Primary color"),
        secondaryColor: color(payload["secondaryColor"], "Secondary color"),
      });
      return json({ branding });
    }
    if (clientBrandingMatch && request.method === "DELETE") {
      requirePlatformAdmin(user);
      const businessId = text(decodeURIComponent(clientBrandingMatch[1] ?? ""), "Client", 8, 120);
      return json({ branding: await resetClientBranding(user, businessId) });
    }
    const clientVisualSettingsMatch = url.pathname.match(
      /^\/api\/admin\/clients\/([^/]+)\/visual-settings$/,
    );
    if (clientVisualSettingsMatch && request.method === "GET") {
      requirePlatformAdmin(user);
      const businessId = text(
        decodeURIComponent(clientVisualSettingsMatch[1] ?? ""),
        "Client",
        8,
        120,
      );
      return json(await getClientVisualSettings(user, businessId));
    }
    if (clientVisualSettingsMatch && request.method === "PUT") {
      requirePlatformAdmin(user);
      const businessId = text(
        decodeURIComponent(clientVisualSettingsMatch[1] ?? ""),
        "Client",
        8,
        120,
      );
      const payload = await body(request);
      const themeKey = text(payload["themeKey"], "Theme", 3, 40);
      if (!themeKeys.includes(themeKey as (typeof themeKeys)[number]))
        throw Object.assign(new Error("Theme is invalid"), { status: 400 });
      return json(
        await updateClientVisualSettings(user, businessId, {
          themeKey: themeKey as (typeof themeKeys)[number],
          occasionTitle: text(payload["occasionTitle"] ?? "", "Occasion title", 0, 80),
          occasionMessage: text(payload["occasionMessage"] ?? "", "Occasion message", 0, 220),
          automaticHolidayThemes: payload["automaticHolidayThemes"] === true,
          timeZone: text(payload["timeZone"] ?? "UTC", "Time zone", 1, 100),
        }),
      );
    }
    const clientLogoMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/logo$/);
    if (clientLogoMatch && request.method === "PUT") {
      requirePlatformAdmin(user);
      const businessId = text(decodeURIComponent(clientLogoMatch[1] ?? ""), "Client", 8, 120);
      return json({
        branding: await updateClientLogo(
          user,
          businessId,
          await imageUpload(request, "Logo", CLIENT_LOGO_MAX_BYTES),
        ),
      });
    }
    const clientRewardsMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/rewards$/);
    if (clientRewardsMatch && request.method === "GET") {
      requirePlatformAdmin(user);
      const businessId = text(decodeURIComponent(clientRewardsMatch[1] ?? ""), "Client", 8, 120);
      return json({ rewards: await listClientRewards(user, businessId) });
    }
    if (clientRewardsMatch && request.method === "POST") {
      requirePlatformAdmin(user);
      const businessId = text(decodeURIComponent(clientRewardsMatch[1] ?? ""), "Client", 8, 120);
      const payload = await body(request);
      if (typeof payload["active"] !== "boolean")
        throw Object.assign(new Error("Active status is required"), { status: 400 });
      return json(
        {
          reward: await createClientReward(user, businessId, {
            name: text(payload["name"], "Reward name", 2, 120),
            description: text(payload["description"] ?? "", "Description", 0, 500),
            points: integer(payload["points"], "Points cost", 1, 1_000_000),
            visits: integer(payload["visits"], "Visits cost", 1, 1_000_000),
            active: payload["active"],
            inventoryRemaining:
              payload["inventoryRemaining"] === null || payload["inventoryRemaining"] === undefined
                ? null
                : integer(payload["inventoryRemaining"], "Inventory", 0, 1_000_000),
          }),
        },
        201,
      );
    }
    const clientRewardMatch = url.pathname.match(
      /^\/api\/admin\/clients\/([^/]+)\/rewards\/([^/]+)$/,
    );
    if (clientRewardMatch && request.method === "PUT") {
      requirePlatformAdmin(user);
      const businessId = text(decodeURIComponent(clientRewardMatch[1] ?? ""), "Client", 8, 120);
      const rewardId = text(decodeURIComponent(clientRewardMatch[2] ?? ""), "Reward", 8, 120);
      const payload = await body(request);
      if (typeof payload["active"] !== "boolean")
        throw Object.assign(new Error("Active status is required"), { status: 400 });
      return json({
        reward: await updateClientReward(user, businessId, rewardId, {
          name: text(payload["name"], "Reward name", 2, 120),
          description: text(payload["description"] ?? "", "Description", 0, 500),
          points: integer(payload["points"], "Points cost", 1, 1_000_000),
          visits: integer(payload["visits"], "Visits cost", 1, 1_000_000),
          active: payload["active"],
          inventoryRemaining:
            payload["inventoryRemaining"] === null || payload["inventoryRemaining"] === undefined
              ? null
              : integer(payload["inventoryRemaining"], "Inventory", 0, 1_000_000),
        }),
      });
    }
    if (clientRewardMatch && request.method === "DELETE") {
      requirePlatformAdmin(user);
      const businessId = text(decodeURIComponent(clientRewardMatch[1] ?? ""), "Client", 8, 120);
      const rewardId = text(decodeURIComponent(clientRewardMatch[2] ?? ""), "Reward", 8, 120);
      await archiveClientReward(user, businessId, rewardId);
      return json({ ok: true });
    }
    const clientProductsMatch = url.pathname.match(/^\/api\/admin\/clients\/([^/]+)\/products$/);
    if (clientProductsMatch && request.method === "GET") {
      requirePlatformAdmin(user);
      const businessId = text(decodeURIComponent(clientProductsMatch[1] ?? ""), "Client", 8, 120);
      return json({ products: await listClientProducts(user, businessId) });
    }
    if (clientProductsMatch && request.method === "POST") {
      requirePlatformAdmin(user);
      const businessId = text(decodeURIComponent(clientProductsMatch[1] ?? ""), "Client", 8, 120);
      return json(
        { product: await createClientProduct(user, businessId, productInput(await body(request))) },
        201,
      );
    }
    const clientProductMatch = url.pathname.match(
      /^\/api\/admin\/clients\/([^/]+)\/products\/([^/]+)$/,
    );
    if (clientProductMatch && request.method === "PUT") {
      requirePlatformAdmin(user);
      const businessId = text(decodeURIComponent(clientProductMatch[1] ?? ""), "Client", 8, 120);
      const productId = text(decodeURIComponent(clientProductMatch[2] ?? ""), "Product", 8, 120);
      return json({
        product: await updateClientProduct(
          user,
          businessId,
          productId,
          productInput(await body(request)),
        ),
      });
    }
    if (clientProductMatch && request.method === "DELETE") {
      requirePlatformAdmin(user);
      const businessId = text(decodeURIComponent(clientProductMatch[1] ?? ""), "Client", 8, 120);
      const productId = text(decodeURIComponent(clientProductMatch[2] ?? ""), "Product", 8, 120);
      await archiveClientProduct(user, businessId, productId);
      return json({ ok: true });
    }
    const clientProductImageMatch = url.pathname.match(
      /^\/api\/admin\/clients\/([^/]+)\/products\/([^/]+)\/image$/,
    );
    if (clientProductImageMatch && request.method === "PUT") {
      requirePlatformAdmin(user);
      const businessId = text(
        decodeURIComponent(clientProductImageMatch[1] ?? ""),
        "Client",
        8,
        120,
      );
      const productId = text(
        decodeURIComponent(clientProductImageMatch[2] ?? ""),
        "Product",
        8,
        120,
      );
      return json({
        product: await updateClientProductImage(
          user,
          businessId,
          productId,
          await imageUpload(request, "Product image", 4_194_304),
        ),
      });
    }
    if (url.pathname === "/api/admin/members" && request.method === "GET") {
      requireRole(user, ["owner", "staff"]);
      return json({ members: await listMembers(user) });
    }
    if (url.pathname === "/api/admin/members" && request.method === "POST") {
      requireRole(user, ["owner", "staff"]);
      const payload = await body(request);
      const result = await createMemberInvitation(user, {
        name: text(payload["name"], "Member name", 2, 120),
        email: text(payload["email"], "Member email", 5, 254).toLowerCase(),
      });
      return json(result, 201);
    }
    if (url.pathname === "/api/admin/rewards" && request.method === "GET") {
      requireRole(user, ["owner"]);
      return json({ rewards: await listManagedRewards(user) });
    }
    if (url.pathname === "/api/admin/loyalty-settings" && request.method === "GET") {
      requireRole(user, ["owner"]);
      return json(await getLoyaltySettings(user));
    }
    if (url.pathname === "/api/admin/loyalty-settings" && request.method === "PUT") {
      requireRole(user, ["owner"]);
      const payload = await body(request);
      return json(await updateLoyaltySettings(user, parseLoyaltyMode(payload["loyaltyMode"])));
    }
    if (url.pathname === "/api/admin/rewards" && request.method === "POST") {
      requireRole(user, ["owner"]);
      const payload = await body(request);
      if (typeof payload["active"] !== "boolean")
        throw Object.assign(new Error("Active status is required"), { status: 400 });
      const reward = await createReward(user, {
        name: text(payload["name"], "Reward name", 2, 120),
        description: text(payload["description"] ?? "", "Description", 0, 500),
        points: integer(payload["points"], "Points cost", 1, 1_000_000),
        visits: integer(payload["visits"], "Visits cost", 1, 1_000_000),
        active: payload["active"],
        inventoryRemaining:
          payload["inventoryRemaining"] === null || payload["inventoryRemaining"] === undefined
            ? null
            : integer(payload["inventoryRemaining"], "Inventory", 0, 1_000_000),
      });
      return json({ reward }, 201);
    }
    const rewardMatch = url.pathname.match(/^\/api\/admin\/rewards\/([^/]+)$/);
    if (rewardMatch && request.method === "PUT") {
      requireRole(user, ["owner"]);
      const rewardId = text(decodeURIComponent(rewardMatch[1] ?? ""), "Reward", 8, 120);
      const payload = await body(request);
      if (typeof payload["active"] !== "boolean")
        throw Object.assign(new Error("Active status is required"), { status: 400 });
      const reward = await updateReward(user, rewardId, {
        name: text(payload["name"], "Reward name", 2, 120),
        description: text(payload["description"] ?? "", "Description", 0, 500),
        points: integer(payload["points"], "Points cost", 1, 1_000_000),
        visits: integer(payload["visits"], "Visits cost", 1, 1_000_000),
        active: payload["active"],
        inventoryRemaining:
          payload["inventoryRemaining"] === null || payload["inventoryRemaining"] === undefined
            ? null
            : integer(payload["inventoryRemaining"], "Inventory", 0, 1_000_000),
      });
      return json({ reward });
    }
    if (rewardMatch && request.method === "DELETE") {
      requireRole(user, ["owner"]);
      const rewardId = text(decodeURIComponent(rewardMatch[1] ?? ""), "Reward", 8, 120);
      await archiveReward(user, rewardId);
      return json({ ok: true });
    }
    if (url.pathname === "/api/admin/products" && request.method === "GET") {
      requireRole(user, ["owner", "staff"]);
      return json({ products: await listManagedProducts(user) });
    }
    if (url.pathname === "/api/admin/products" && request.method === "POST") {
      requireRole(user, ["owner"]);
      return json({ product: await createProduct(user, productInput(await body(request))) }, 201);
    }
    const productMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
    if (productMatch && request.method === "PUT") {
      requireRole(user, ["owner"]);
      const productId = text(decodeURIComponent(productMatch[1] ?? ""), "Product", 8, 120);
      return json({
        product: await updateProduct(user, productId, productInput(await body(request))),
      });
    }
    if (productMatch && request.method === "DELETE") {
      requireRole(user, ["owner"]);
      const productId = text(decodeURIComponent(productMatch[1] ?? ""), "Product", 8, 120);
      await archiveProduct(user, productId);
      return json({ ok: true });
    }
    const productImageMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)\/image$/);
    if (productImageMatch && request.method === "PUT") {
      requireRole(user, ["owner"]);
      const productId = text(decodeURIComponent(productImageMatch[1] ?? ""), "Product", 8, 120);
      return json({
        product: await updateProductImage(
          user,
          productId,
          await imageUpload(request, "Product image", 4_194_304),
        ),
      });
    }
    if (url.pathname === "/api/admin/award" && request.method === "POST") {
      requireRole(user, ["owner", "staff"]);
      const payload = await body(request);
      const awardInput = {
        memberId: text(payload["memberId"], "Member", 8, 120),
        units: integer(payload["units"] ?? payload["points"], "Loyalty amount", 1, 1_000_000),
        amountCents: integer(payload["amountCents"], "Amount", 0, 100_000_000),
        idempotencyKey: text(request.headers.get("idempotency-key"), "Idempotency key", 8, 120),
        ...(typeof payload["note"] === "string" ? { note: payload["note"].slice(0, 300) } : {}),
      };
      const result = await awardPoints(user, awardInput);
      return json(result, result.duplicate ? 200 : 201);
    }
    if (url.pathname === "/api/wallet" && request.method === "GET") {
      requireRole(user, ["member"]);
      return json(await getWallet(user));
    }
    if (url.pathname === "/api/wallet/referral" && request.method === "GET") {
      requireRole(user, ["member"]);
      return json(await getOrCreateReferralLink(user));
    }
    if (url.pathname === "/api/wallet/redeem" && request.method === "POST") {
      requireRole(user, ["member"]);
      const payload = await body(request);
      const result = await redeemReward(user, {
        rewardId: text(payload["rewardId"], "Reward", 8, 120),
        idempotencyKey: text(request.headers.get("idempotency-key"), "Idempotency key", 8, 120),
      });
      return json(result, result.duplicate ? 200 : 201);
    }
    return json({ error: "API route not found" }, 404);
  } catch (error) {
    console.error(error);
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: unknown }).status)
        : 500;
    const retryAfter =
      typeof error === "object" && error && "retryAfter" in error
        ? String((error as { retryAfter: unknown }).retryAfter)
        : null;
    return json(
      {
        error:
          status >= 500
            ? "Internal server error"
            : error instanceof Error
              ? error.message
              : "Request failed",
      },
      status,
      retryAfter ? { "retry-after": retryAfter } : {},
    );
  }
}
