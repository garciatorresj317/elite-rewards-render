import { createHash, randomBytes } from "node:crypto";
import { createSession, hashPassword, newUserId, type SessionUser } from "./auth.ts";
import { getPool, id } from "./database.ts";
import {
  getBusinessVisualSettings,
  publicVisualSettings,
  type PublicVisualSettings,
} from "./experience-service.ts";

const invitationLifetimeHours = 72;

export type MemberSummary = {
  id: string;
  name: string;
  email: string;
  memberCode: string | null;
  status: "active" | "invited";
  points: number;
  createdAt: string;
};

function requireBusinessAdmin(user: SessionUser): void {
  if (user.role !== "owner" && user.role !== "staff") {
    throw Object.assign(new Error("Business administrator access required"), { status: 403 });
  }
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function memberCode(): string {
  return `ELITE-${randomBytes(10).toString("hex").toUpperCase()}`;
}

export async function getMemberInvitation(token: string): Promise<{
  businessName: string;
  locationName: string;
  memberName: string;
  memberEmail: string;
  visualSettings: PublicVisualSettings;
}> {
  const result = await getPool().query<{
    business_id: string;
    business_name: string;
    location_name: string;
    member_name: string;
    member_email: string;
  }>(
    `SELECT b.id AS business_id, b.name AS business_name, l.name AS location_name, mi.member_name, mi.member_email
       FROM member_invitations mi
       JOIN businesses b ON b.id = mi.business_id
       JOIN locations l ON l.id = mi.location_id
      WHERE mi.token_hash = $1 AND mi.accepted_at IS NULL AND mi.expires_at > now()
        AND b.active = true`,
    [tokenHash(token)],
  );
  const invitation = result.rows[0];
  if (!invitation)
    throw Object.assign(new Error("This member invitation is invalid or expired"), { status: 404 });
  return {
    businessName: invitation.business_name,
    locationName: invitation.location_name,
    memberName: invitation.member_name,
    memberEmail: invitation.member_email,
    visualSettings: publicVisualSettings(await getBusinessVisualSettings(invitation.business_id)),
  };
}

export async function activateMember(
  token: string,
  password: string,
): Promise<{ sessionToken: string }> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string;
      business_id: string;
      location_id: string;
      member_name: string;
      member_email: string;
    }>(
      `SELECT mi.id, mi.business_id, mi.location_id, mi.member_name, mi.member_email
         FROM member_invitations mi
         JOIN businesses b ON b.id = mi.business_id
        WHERE mi.token_hash = $1 AND mi.accepted_at IS NULL AND mi.expires_at > now()
          AND b.active = true
        FOR UPDATE`,
      [tokenHash(token)],
    );
    const invitation = result.rows[0];
    if (!invitation)
      throw Object.assign(new Error("This member invitation is invalid or expired"), {
        status: 404,
      });
    const existing = await client.query("SELECT 1 FROM users WHERE lower(email) = lower($1)", [
      invitation.member_email,
    ]);
    if (existing.rowCount)
      throw Object.assign(new Error("An account already uses this email"), { status: 409 });

    const memberId = newUserId();
    const code = memberCode();
    await client.query(
      `INSERT INTO users(id,business_id,location_id,role,name,email,password_hash,member_code)
       VALUES ($1,$2,$3,'member',$4,$5,$6,$7)`,
      [
        memberId,
        invitation.business_id,
        invitation.location_id,
        invitation.member_name,
        invitation.member_email,
        await hashPassword(password),
        code,
      ],
    );
    await client.query(
      "INSERT INTO member_balances(business_id,member_id,points) VALUES ($1,$2,0)",
      [invitation.business_id, memberId],
    );
    await client.query("UPDATE member_invitations SET accepted_at = now() WHERE id = $1", [
      invitation.id,
    ]);
    await client.query(
      `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES ($1,$2,$3,'member.activated','user',$3,$4)`,
      [id("aud"), invitation.business_id, memberId, JSON.stringify({ memberCode: code })],
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

export async function listMembers(user: SessionUser): Promise<MemberSummary[]> {
  requireBusinessAdmin(user);
  const result = await getPool().query<{
    id: string;
    name: string;
    email: string;
    member_code: string | null;
    status: "active" | "invited";
    points: number;
    created_at: Date;
  }>(
    `SELECT id, name, email, member_code, status, points, created_at
       FROM (
         SELECT u.id, u.name, u.email, u.member_code, 'active'::text AS status,
                COALESCE(mb.points, 0) AS points, u.created_at
           FROM users u
           LEFT JOIN member_balances mb ON mb.business_id = u.business_id AND mb.member_id = u.id
          WHERE u.business_id = $1 AND u.role = 'member' AND u.active = true
         UNION ALL
         SELECT mi.id, mi.member_name AS name, mi.member_email AS email, NULL AS member_code,
                'invited'::text AS status, 0 AS points, mi.created_at
           FROM member_invitations mi
          WHERE mi.business_id = $1 AND mi.accepted_at IS NULL AND mi.expires_at > now()
       ) members
      ORDER BY created_at DESC, name`,
    [user.businessId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    memberCode: row.member_code,
    status: row.status,
    points: Number(row.points),
    createdAt: row.created_at.toISOString(),
  }));
}

export async function createMemberInvitation(
  user: SessionUser,
  input: { name: string; email: string; locationId?: string },
): Promise<{ member: MemberSummary; activationPath: string }> {
  requireBusinessAdmin(user);
  const client = await getPool().connect();
  const invitationId = id("minv");
  const invitationToken = randomBytes(32).toString("base64url");
  try {
    await client.query("BEGIN");
    const business = await client.query(
      "SELECT 1 FROM businesses WHERE id = $1 AND active = true FOR UPDATE",
      [user.businessId],
    );
    if (!business.rowCount)
      throw Object.assign(new Error("This rewards program is unavailable"), { status: 404 });
    const locationId = input.locationId ?? user.locationId;
    if (!locationId)
      throw Object.assign(new Error("A location is required to enroll a member"), { status: 400 });
    const location = await client.query(
      "SELECT 1 FROM locations WHERE id = $1 AND business_id = $2",
      [locationId, user.businessId],
    );
    if (!location.rowCount) throw Object.assign(new Error("Location not found"), { status: 404 });
    const existing = await client.query(
      `SELECT 1 FROM users WHERE lower(email) = lower($1)
       UNION ALL
       SELECT 1 FROM member_invitations
        WHERE lower(member_email) = lower($1) AND accepted_at IS NULL AND expires_at > now()
       LIMIT 1`,
      [input.email],
    );
    if (existing.rowCount)
      throw Object.assign(new Error("An active user or invitation already uses this email"), {
        status: 409,
      });
    await client.query(
      `INSERT INTO member_invitations(id,business_id,location_id,member_name,member_email,token_hash,expires_at,created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,now() + interval '${invitationLifetimeHours} hours',$7)`,
      [
        invitationId,
        user.businessId,
        locationId,
        input.name,
        input.email,
        tokenHash(invitationToken),
        user.id,
      ],
    );
    await client.query(
      `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES ($1,$2,$3,'member.invited','member_invitation',$4,$5)`,
      [id("aud"), user.businessId, user.id, invitationId, JSON.stringify({ email: input.email })],
    );
    await client.query("COMMIT");
    return {
      member: {
        id: invitationId,
        name: input.name,
        email: input.email,
        memberCode: null,
        status: "invited",
        points: 0,
        createdAt: new Date().toISOString(),
      },
      activationPath: `/activate-member?token=${encodeURIComponent(invitationToken)}`,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
