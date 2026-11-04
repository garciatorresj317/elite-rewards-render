import { timingSafeEqual } from "node:crypto";
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
  getClientInvitation,
  listClients,
} from "./clients-service.ts";
import {
  activateMember,
  createMemberInvitation,
  getMemberInvitation,
  listMembers,
} from "./members-service.ts";
import { awardPoints, getDashboard, getWallet, redeemReward } from "./rewards-service.ts";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...headers } });
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

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
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
    const ownerPassword = text(payload["ownerPassword"], "Owner password", 12, 200);
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
    await migrateDatabase();
    if (request.method !== "GET" && !isSameOrigin(request))
      return json({ error: "Cross-origin request rejected" }, 403);
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
        text(payload["password"], "Password", 12, 200),
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
        text(payload["password"], "Password", 12, 200),
      );
      return json({ ok: true }, 201, { "set-cookie": setSessionCookie(result.sessionToken) });
    }
    const user = await getSessionUser(request);
    if (url.pathname === "/api/auth/session" && request.method === "GET") return json({ user });
    if (url.pathname === "/api/admin/dashboard" && request.method === "GET") {
      requireRole(user, ["owner", "staff"]);
      return json(await getDashboard(user));
    }
    if (url.pathname === "/api/admin/clients" && request.method === "GET") {
      requirePlatformAdmin(user);
      return json({ clients: await listClients(user) });
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
    if (url.pathname === "/api/admin/award" && request.method === "POST") {
      requireRole(user, ["owner", "staff"]);
      const payload = await body(request);
      const awardInput = {
        memberId: text(payload["memberId"], "Member", 8, 120),
        points: integer(payload["points"], "Points", 1, 1_000_000),
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
    );
  }
}
