import { createHash, createHmac, randomBytes } from "node:crypto";
import type { SessionUser } from "./auth.ts";
import { hashPassword } from "./auth.ts";
import { getPool, id } from "./database.ts";

const resetLifetimeMinutes = 30;
const pendingLifetimeHours = 24;

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function subjectHash(subject: string): string {
  const key = process.env["RATE_LIMIT_HMAC_KEY"] ?? "local-test-rate-limit-key";
  return createHmac("sha256", key).update(`password-reset:${subject}`).digest("hex");
}

export async function requestPasswordReset(email: string, requestSubject: string): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const now = new Date();
    const windowStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()),
    );
    for (const limit of [
      { scope: "password-reset-subject", value: requestSubject, maximum: 10 },
      { scope: "password-reset-email", value: email, maximum: 5 },
    ]) {
      const rate = await client.query<{ attempts: number }>(
        `INSERT INTO request_rate_limits(scope,subject_hash,window_start,attempts)
         VALUES ($1,$2,$3,1)
         ON CONFLICT (scope,subject_hash,window_start)
         DO UPDATE SET attempts = request_rate_limits.attempts + 1
         RETURNING attempts`,
        [limit.scope, subjectHash(limit.value), windowStart],
      );
      if (Number(rate.rows[0]?.attempts ?? 0) > limit.maximum)
        throw Object.assign(new Error("Too many password reset requests; try again later"), {
          status: 429,
          retryAfter: 3600,
        });
    }

    const result = await client.query<{ id: string; business_id: string }>(
      `SELECT u.id, u.business_id
         FROM users u JOIN businesses b ON b.id = u.business_id
        WHERE lower(u.email) = lower($1) AND u.active = true AND b.active = true`,
      [email],
    );
    const user = result.rows[0];
    if (user) {
      await client.query(
        `UPDATE password_reset_tokens
            SET used_at = COALESCE(used_at, now())
          WHERE user_id = $1 AND used_at IS NULL`,
        [user.id],
      );
      await client.query(
        `UPDATE password_reset_requests
            SET status = 'cancelled'
          WHERE user_id = $1 AND status = 'pending'`,
        [user.id],
      );
      await client.query(
        `INSERT INTO password_reset_requests
           (id,user_id,business_id,status,subject_hash,expires_at)
         VALUES ($1,$2,$3,'pending',$4,now() + interval '24 hours')`,
        [id("prr"), user.id, user.business_id, subjectHash(requestSubject)],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type PasswordResetRequest = {
  id: string;
  userId: string;
  businessId: string;
  businessName: string;
  userName: string;
  email: string;
  role: "owner" | "staff" | "member";
  requestedAt: string;
  expiresAt: string;
};

export async function listPasswordResetRequests(
  user: SessionUser,
): Promise<PasswordResetRequest[]> {
  if (!user.platformAdmin)
    throw Object.assign(new Error("Platform administrator access required"), { status: 403 });
  await getPool().query(
    `UPDATE password_reset_requests
        SET status = 'expired'
      WHERE status = 'pending' AND expires_at <= now()`,
  );
  const result = await getPool().query<{
    id: string;
    user_id: string;
    business_id: string;
    business_name: string;
    user_name: string;
    email: string;
    role: "owner" | "staff" | "member";
    requested_at: Date;
    expires_at: Date;
  }>(
    `SELECT pr.id, pr.user_id, pr.business_id, b.name AS business_name,
            u.name AS user_name, u.email, u.role, pr.requested_at, pr.expires_at
       FROM password_reset_requests pr
       JOIN users u ON u.id = pr.user_id
       JOIN businesses b ON b.id = pr.business_id
      WHERE pr.status = 'pending' AND pr.expires_at > now()
      ORDER BY pr.requested_at ASC`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    businessId: row.business_id,
    businessName: row.business_name,
    userName: row.user_name,
    email: row.email,
    role: row.role,
    requestedAt: row.requested_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
  }));
}

export async function issuePasswordReset(
  user: SessionUser,
  requestId: string,
): Promise<{ resetPath: string; expiresAt: string }> {
  if (!user.platformAdmin)
    throw Object.assign(new Error("Platform administrator access required"), { status: 403 });
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      user_id: string;
      business_id: string;
      role: "owner" | "staff" | "member";
    }>(
      `SELECT pr.user_id, pr.business_id, u.role
         FROM password_reset_requests pr JOIN users u ON u.id = pr.user_id
        WHERE pr.id = $1 AND pr.status = 'pending' AND pr.expires_at > now()
        FOR UPDATE`,
      [requestId],
    );
    const pending = result.rows[0];
    if (!pending)
      throw Object.assign(new Error("Password reset request is unavailable"), { status: 404 });
    await client.query(
      `UPDATE password_reset_tokens
          SET used_at = COALESCE(used_at, now())
        WHERE user_id = $1 AND used_at IS NULL`,
      [pending.user_id],
    );
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + resetLifetimeMinutes * 60_000);
    await client.query(
      `INSERT INTO password_reset_tokens(id,request_id,user_id,token_hash,expires_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [id("prt"), requestId, pending.user_id, tokenHash(token), expiresAt],
    );
    await client.query(
      `UPDATE password_reset_requests
          SET status = 'issued', issued_by_user_id = $2, issued_at = now(), expires_at = $3
        WHERE id = $1`,
      [requestId, user.id, expiresAt],
    );
    await client.query(
      `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES ($1,$2,$3,'password_reset.issued','user',$4,$5)`,
      [id("aud"), pending.business_id, user.id, pending.user_id, JSON.stringify({ requestId })],
    );
    await client.query("COMMIT");
    return {
      resetPath: `/reset-password?token=${encodeURIComponent(token)}${pending.role === "member" ? "&access=member" : ""}`,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getPasswordResetStatus(token: string): Promise<{ valid: true }> {
  const result = await getPool().query(
    `SELECT 1
       FROM password_reset_tokens prt
       JOIN password_reset_requests pr ON pr.id = prt.request_id
       JOIN users u ON u.id = prt.user_id
       JOIN businesses b ON b.id = u.business_id
      WHERE prt.token_hash = $1 AND prt.used_at IS NULL AND prt.expires_at > now()
        AND pr.status = 'issued' AND u.active = true AND b.active = true`,
    [tokenHash(token)],
  );
  if (!result.rows[0])
    throw Object.assign(new Error("Password reset link is invalid or expired"), { status: 404 });
  return { valid: true };
}

export async function completePasswordReset(
  token: string,
  password: string,
): Promise<{ role: "owner" | "staff" | "member" }> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      token_id: string;
      request_id: string;
      user_id: string;
      business_id: string;
      role: "owner" | "staff" | "member";
    }>(
      `SELECT prt.id AS token_id, prt.request_id, prt.user_id, u.business_id, u.role
         FROM password_reset_tokens prt
         JOIN password_reset_requests pr ON pr.id = prt.request_id
         JOIN users u ON u.id = prt.user_id
         JOIN businesses b ON b.id = u.business_id
        WHERE prt.token_hash = $1 AND prt.used_at IS NULL AND prt.expires_at > now()
          AND pr.status = 'issued' AND u.active = true AND b.active = true
        FOR UPDATE`,
      [tokenHash(token)],
    );
    const reset = result.rows[0];
    if (!reset)
      throw Object.assign(new Error("Password reset link is invalid or expired"), { status: 404 });
    await client.query(
      `UPDATE users
          SET password_hash = $2, failed_login_count = 0, locked_until = NULL
        WHERE id = $1`,
      [reset.user_id, await hashPassword(password)],
    );
    await client.query("DELETE FROM sessions WHERE user_id = $1", [reset.user_id]);
    await client.query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [
      reset.token_id,
    ]);
    await client.query(
      `UPDATE password_reset_tokens
          SET used_at = COALESCE(used_at, now())
        WHERE user_id = $1 AND used_at IS NULL`,
      [reset.user_id],
    );
    await client.query(
      `UPDATE password_reset_requests SET status = 'used', completed_at = now() WHERE id = $1`,
      [reset.request_id],
    );
    await client.query(
      `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES ($1,$2,$3,'password_reset.completed','user',$3,$4)`,
      [
        id("aud"),
        reset.business_id,
        reset.user_id,
        JSON.stringify({ requestId: reset.request_id }),
      ],
    );
    await client.query("COMMIT");
    return { role: reset.role };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const passwordResetPolicy = {
  resetLifetimeMinutes,
  pendingLifetimeHours,
};
