import { createHash, randomBytes } from "node:crypto";
import { createSession, hashPassword, newUserId, type SessionUser } from "./auth.ts";
import { getPool, id } from "./database.ts";
import {
  getBusinessVisualSettings,
  publicVisualSettings,
  type PublicVisualSettings,
} from "./experience-service.ts";
import {
  calculateMembershipAnniversary,
  type AnniversaryGiftStatus,
  type MembershipAnniversary,
} from "../lib/member-anniversary.ts";

const invitationLifetimeHours = 72;

export type MemberSummary = {
  id: string;
  name: string;
  email: string;
  memberCode: string | null;
  status: "active" | "invited";
  units: number;
  createdAt: string;
  anniversary: MembershipAnniversary | null;
  anniversaryGift: { status: AnniversaryGiftStatus; note: string; updatedAt: string } | null;
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
      "INSERT INTO member_balances(business_id,member_id,points,visits) VALUES ($1,$2,0,0)",
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
  const database = getPool();
  const timeZone = (await getBusinessVisualSettings(user.businessId)).timeZone;
  const [result, gifts] = await Promise.all([
    database.query<{
      id: string;
      name: string;
      email: string;
      member_code: string | null;
      status: "active" | "invited";
      units: number;
      created_at: Date;
    }>(
      `SELECT members.id, members.name, members.email, members.member_code, members.status,
              members.units, members.created_at
         FROM (
           SELECT u.id, u.name, u.email, u.member_code, 'active'::text AS status,
                  CASE WHEN b.loyalty_mode = 'visits' THEN COALESCE(mb.visits, 0)
                       ELSE COALESCE(mb.points, 0) END AS units, u.created_at
             FROM users u
             JOIN businesses b ON b.id = u.business_id
             LEFT JOIN member_balances mb ON mb.business_id = u.business_id AND mb.member_id = u.id
            WHERE u.business_id = $1 AND u.role = 'member' AND u.active = true
           UNION ALL
           SELECT mi.id, mi.member_name AS name, mi.member_email AS email, NULL AS member_code,
                  'invited'::text AS status, 0 AS units, mi.created_at
             FROM member_invitations mi
            WHERE mi.business_id = $1 AND mi.accepted_at IS NULL AND mi.expires_at > now()
         ) members
        ORDER BY members.created_at DESC, members.name`,
      [user.businessId],
    ),
    database.query<{
      member_id: string;
      milestone_years: number;
      status: AnniversaryGiftStatus;
      note: string;
      updated_at: Date;
    }>(
      `SELECT member_id,milestone_years,status,note,updated_at
         FROM member_anniversary_gifts WHERE business_id = $1`,
      [user.businessId],
    ),
  ]);
  const giftsByMilestone = new Map(
    gifts.rows.map((gift) => [`${gift.member_id}:${gift.milestone_years}`, gift] as const),
  );
  return result.rows.map((row) => {
    const anniversary =
      row.status === "active"
        ? calculateMembershipAnniversary(row.created_at, new Date(), timeZone)
        : null;
    const gift = anniversary
      ? giftsByMilestone.get(`${row.id}:${anniversary.milestoneYears}`)
      : undefined;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      memberCode: row.member_code,
      status: row.status,
      units: Number(row.units),
      createdAt: row.created_at.toISOString(),
      anniversary,
      anniversaryGift: gift
        ? { status: gift.status, note: gift.note, updatedAt: gift.updated_at.toISOString() }
        : null,
    };
  });
}

export async function updateAnniversaryGift(
  user: SessionUser,
  memberId: string,
  milestoneYears: number,
  status: AnniversaryGiftStatus | null,
  note: string,
): Promise<MemberSummary> {
  requireBusinessAdmin(user);
  if (!Number.isInteger(milestoneYears) || milestoneYears < 1 || milestoneYears > 200)
    throw Object.assign(new Error("Anniversary milestone is invalid"), { status: 400 });
  const database = getPool();
  const member = await database.query<{ created_at: Date }>(
    `SELECT u.created_at
       FROM users u
      WHERE u.id = $1 AND u.business_id = $2 AND u.role = 'member' AND u.active = true`,
    [memberId, user.businessId],
  );
  const row = member.rows[0];
  if (!row) throw Object.assign(new Error("Member not found"), { status: 404 });
  const current = calculateMembershipAnniversary(
    row.created_at,
    new Date(),
    (await getBusinessVisualSettings(user.businessId)).timeZone,
  );
  if (current.milestoneYears !== milestoneYears)
    throw Object.assign(new Error("Anniversary milestone is no longer current"), { status: 409 });
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    if (status === null) {
      await client.query(
        "DELETE FROM member_anniversary_gifts WHERE business_id = $1 AND member_id = $2 AND milestone_years = $3",
        [user.businessId, memberId, milestoneYears],
      );
    } else {
      await client.query(
        `INSERT INTO member_anniversary_gifts(
           business_id,member_id,milestone_years,status,note,planned_at,sent_at,updated_by_user_id
         )
         VALUES ($1,$2,$3,$4,$5,
                 CASE WHEN $4 = 'planned' THEN now() ELSE NULL END,
                 CASE WHEN $4 = 'sent' THEN now() ELSE NULL END,$6)
         ON CONFLICT (business_id,member_id,milestone_years) DO UPDATE
           SET status = EXCLUDED.status, note = EXCLUDED.note,
               planned_at = CASE
                 WHEN EXCLUDED.status = 'planned'
                   THEN COALESCE(member_anniversary_gifts.planned_at, now())
                 ELSE member_anniversary_gifts.planned_at
               END,
               sent_at = CASE
                 WHEN EXCLUDED.status = 'sent' THEN now()
                 ELSE member_anniversary_gifts.sent_at
               END,
               updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()`,
        [user.businessId, memberId, milestoneYears, status, note, user.id],
      );
    }
    await client.query(
      `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES ($1,$2,$3,$4,'user',$5,$6)`,
      [
        id("aud"),
        user.businessId,
        user.id,
        status === null ? "member.anniversary_gift_cleared" : "member.anniversary_gift_updated",
        memberId,
        JSON.stringify({ milestoneYears, status, note }),
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const updated = (await listMembers(user)).find((item) => item.id === memberId);
  if (!updated) throw Object.assign(new Error("Member not found"), { status: 404 });
  return updated;
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
    // Expired invitations still satisfy the database's pending-email unique index. Remove them
    // before issuing a replacement so an expired link cannot turn a valid enrollment into a 500.
    await client.query(
      `DELETE FROM member_invitations
        WHERE lower(member_email) = lower($1)
          AND accepted_at IS NULL
          AND expires_at <= now()`,
      [input.email],
    );
    const existingUser = await client.query(
      "SELECT 1 FROM users WHERE lower(email) = lower($1) LIMIT 1",
      [input.email],
    );
    if (existingUser.rowCount)
      throw Object.assign(new Error("An account already uses this email"), { status: 409 });

    const pendingInvitation = await client.query<{ id: string; business_id: string }>(
      `SELECT id, business_id
         FROM member_invitations
        WHERE lower(member_email) = lower($1)
          AND accepted_at IS NULL
          AND expires_at > now()
        FOR UPDATE`,
      [input.email],
    );
    const pending = pendingInvitation.rows[0];
    if (pending && pending.business_id !== user.businessId)
      throw Object.assign(new Error("Another rewards program already invited this email"), {
        status: 409,
      });

    const savedInvitationId = pending?.id ?? invitationId;
    if (pending) {
      await client.query(
        `UPDATE member_invitations
            SET location_id = $2,
                member_name = $3,
                member_email = $4,
                token_hash = $5,
                expires_at = now() + interval '${invitationLifetimeHours} hours',
                created_by_user_id = $6,
                created_at = now()
          WHERE id = $1`,
        [
          savedInvitationId,
          locationId,
          input.name,
          input.email,
          tokenHash(invitationToken),
          user.id,
        ],
      );
    } else {
      await client.query(
        `INSERT INTO member_invitations(id,business_id,location_id,member_name,member_email,token_hash,expires_at,created_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,now() + interval '${invitationLifetimeHours} hours',$7)`,
        [
          savedInvitationId,
          user.businessId,
          locationId,
          input.name,
          input.email,
          tokenHash(invitationToken),
          user.id,
        ],
      );
    }
    await client.query(
      `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES ($1,$2,$3,$4,'member_invitation',$5,$6)`,
      [
        id("aud"),
        user.businessId,
        user.id,
        pending ? "member.invitation_reissued" : "member.invited",
        savedInvitationId,
        JSON.stringify({ email: input.email }),
      ],
    );
    await client.query("COMMIT");
    return {
      member: {
        id: savedInvitationId,
        name: input.name,
        email: input.email,
        memberCode: null,
        status: "invited",
        units: 0,
        createdAt: new Date().toISOString(),
        anniversary: null,
        anniversaryGift: null,
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
