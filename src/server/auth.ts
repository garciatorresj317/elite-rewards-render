import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { PoolClient } from "pg";
import { getPool, id } from "./database.ts";

const scrypt = promisify(scryptCallback);
const sessionCookie = "elite_session";
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;

export type Role = "owner" | "staff" | "member";
export type SessionUser = {
  id: string;
  businessId: string;
  locationId: string | null;
  role: Role;
  name: string;
  email: string;
  memberCode: string | null;
  platformAdmin: boolean;
};

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 200) {
    throw new Error("Password must contain between 12 and 200 characters");
  }
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, saltText, hashText] = stored.split(":");
  if (algorithm !== "scrypt" || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64url");
  const actual = (await scrypt(
    password,
    Buffer.from(saltText, "base64url"),
    expected.length,
  )) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseCookies(request: Request): Record<string, string> {
  return Object.fromEntries(
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter((parts): parts is [string, string] => Boolean(parts[0] && parts[1]))
      .map(([name, value]) => [decodeURIComponent(name), decodeURIComponent(value)]),
  );
}

export function setSessionCookie(token: string): string {
  return `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionLifetimeSeconds}; Secure`;
}

export function clearSessionCookie(): string {
  return `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`;
}

export async function createSession(client: PoolClient, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await client.query(
    "INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '7 days')",
    [tokenHash(token), userId],
  );
  return token;
}

export async function destroySession(request: Request): Promise<void> {
  const token = parseCookies(request)[sessionCookie];
  if (!token) return;
  await getPool().query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const token = parseCookies(request)[sessionCookie];
  if (!token) return null;
  const result = await getPool().query<{
    id: string;
    business_id: string;
    location_id: string | null;
    role: Role;
    name: string;
    email: string;
    member_code: string | null;
    platform_admin: boolean;
  }>(
    `SELECT u.id, u.business_id, u.location_id, u.role, u.name, u.email, u.member_code,
            EXISTS (
              SELECT 1 FROM platform_administrator pa
               WHERE pa.singleton = true AND pa.user_id = u.id
            ) AS platform_admin
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active = true`,
    [tokenHash(token)],
  );
  const user = result.rows[0];
  if (!user) return null;
  return {
    id: user.id,
    businessId: user.business_id,
    locationId: user.location_id,
    role: user.role,
    name: user.name,
    email: user.email,
    memberCode: user.member_code,
    platformAdmin: user.platform_admin,
  };
}

export function requireRole(user: SessionUser | null, roles: Role[]): asserts user is SessionUser {
  if (!user) throw Object.assign(new Error("Authentication required"), { status: 401 });
  if (!roles.includes(user.role)) throw Object.assign(new Error("Not authorized"), { status: 403 });
}

export function requirePlatformAdmin(user: SessionUser | null): asserts user is SessionUser {
  requireRole(user, ["owner"]);
  if (!user.platformAdmin)
    throw Object.assign(new Error("Platform administrator access required"), { status: 403 });
}

export async function authenticate(
  email: string,
  password: string,
): Promise<{ user: SessionUser; token: string } | null> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string;
      business_id: string;
      location_id: string | null;
      role: Role;
      name: string;
      email: string;
      member_code: string | null;
      platform_admin: boolean;
      password_hash: string;
      failed_login_count: number;
      locked_until: Date | null;
    }>(
      `SELECT u.id, u.business_id, u.location_id, u.role, u.name, u.email, u.member_code,
              EXISTS (
                SELECT 1 FROM platform_administrator pa
                 WHERE pa.singleton = true AND pa.user_id = u.id
              ) AS platform_admin,
              u.password_hash, u.failed_login_count, u.locked_until
         FROM users u WHERE lower(u.email) = lower($1) AND u.active = true FOR UPDATE`,
      [email],
    );
    const candidate = result.rows[0];
    if (!candidate || (candidate.locked_until && candidate.locked_until > new Date())) {
      await client.query("ROLLBACK");
      return null;
    }
    const valid = await verifyPassword(password, candidate.password_hash);
    if (!valid) {
      const nextFailures = candidate.failed_login_count + 1;
      await client.query(
        `UPDATE users SET failed_login_count = $2,
          locked_until = CASE WHEN $2 >= 5 THEN now() + interval '15 minutes' ELSE NULL END
          WHERE id = $1`,
        [candidate.id, nextFailures],
      );
      await client.query("COMMIT");
      return null;
    }
    await client.query(
      "UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1",
      [candidate.id],
    );
    const token = await createSession(client, candidate.id);
    await client.query("COMMIT");
    return {
      token,
      user: {
        id: candidate.id,
        businessId: candidate.business_id,
        locationId: candidate.location_id,
        role: candidate.role,
        name: candidate.name,
        email: candidate.email,
        memberCode: candidate.member_code,
        platformAdmin: candidate.platform_admin,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function newUserId(): string {
  return id("usr");
}
