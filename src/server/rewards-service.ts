import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool, id } from "./database.ts";
import type { SessionUser } from "./auth.ts";

export type PublicReward = {
  id: string;
  name: string;
  description: string;
  points: number;
};

export async function getDashboard(user: SessionUser) {
  const database = getPool();
  const [business, totals, transactions, members, rewards] = await Promise.all([
    database.query<{ business_name: string; location_name: string }>(
      `SELECT b.name AS business_name, l.name AS location_name
         FROM businesses b LEFT JOIN locations l ON l.business_id = b.id
        WHERE b.id = $1 ORDER BY l.created_at LIMIT 1`,
      [user.businessId],
    ),
    database.query<{
      members: string;
      points_awarded: string;
      rewards_redeemed: string;
      eligible_sales_cents: string;
    }>(
      `SELECT
         (SELECT count(*) FROM users WHERE business_id = $1 AND role = 'member' AND active) AS members,
         COALESCE(sum(CASE WHEN entry_type = 'earn' THEN points_delta ELSE 0 END), 0) AS points_awarded,
         count(*) FILTER (WHERE entry_type = 'redeem') AS rewards_redeemed,
         COALESCE(sum(CASE WHEN entry_type = 'earn' THEN amount_cents ELSE 0 END), 0) AS eligible_sales_cents
       FROM ledger_entries WHERE business_id = $1`,
      [user.businessId],
    ),
    database.query<{
      id: string;
      member: string;
      amount_cents: number;
      points_delta: number;
      entry_type: string;
      created_at: Date;
      reward_name: string | null;
    }>(
      `SELECT le.id, u.name AS member, le.amount_cents, le.points_delta, le.entry_type,
              le.created_at, r.name AS reward_name
         FROM ledger_entries le JOIN users u ON u.id = le.member_id
         LEFT JOIN rewards r ON r.id = le.reward_id
        WHERE le.business_id = $1 ORDER BY le.created_at DESC LIMIT 50`,
      [user.businessId],
    ),
    database.query<{
      id: string;
      name: string;
      email: string;
      member_code: string;
      points: number;
    }>(
      `SELECT u.id, u.name, u.email, u.member_code, COALESCE(mb.points, 0) AS points
         FROM users u LEFT JOIN member_balances mb ON mb.member_id = u.id AND mb.business_id = u.business_id
        WHERE u.business_id = $1 AND u.role = 'member' AND u.active = true ORDER BY u.name`,
      [user.businessId],
    ),
    database.query<{ id: string; name: string; description: string; points_cost: number }>(
      "SELECT id, name, description, points_cost FROM rewards WHERE business_id = $1 AND active = true ORDER BY points_cost",
      [user.businessId],
    ),
  ]);
  const total = totals.rows[0];
  return {
    business: business.rows[0] ?? {
      business_name: "Elite Rewards",
      location_name: "Primary location",
    },
    metrics: {
      members: Number(total?.members ?? 0),
      pointsAwarded: Number(total?.points_awarded ?? 0),
      rewardsRedeemed: Number(total?.rewards_redeemed ?? 0),
      eligibleSalesCents: Number(total?.eligible_sales_cents ?? 0),
    },
    transactions: transactions.rows.map((row) => ({
      id: row.id,
      member: row.member,
      amount: Number(row.amount_cents) / 100,
      points: Math.abs(Number(row.points_delta)),
      type: row.entry_type === "redeem" ? "redeemed" : "earned",
      time: row.created_at,
      rewardName: row.reward_name,
    })),
    members: members.rows.map((row) => ({ ...row, points: Number(row.points) })),
    rewards: rewards.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      points: row.points_cost,
    })),
  };
}

export async function getWallet(user: SessionUser) {
  const database = getPool();
  const [balance, ledger, rewards, redemptions, context] = await Promise.all([
    database.query<{ points: number }>(
      "SELECT points FROM member_balances WHERE business_id = $1 AND member_id = $2",
      [user.businessId, user.id],
    ),
    database.query<{
      id: string;
      entry_type: string;
      points_delta: number;
      note: string;
      created_at: Date;
      reward_name: string | null;
    }>(
      `SELECT le.id, le.entry_type, le.points_delta, le.note, le.created_at, r.name AS reward_name
         FROM ledger_entries le LEFT JOIN rewards r ON r.id = le.reward_id
        WHERE le.business_id = $1 AND le.member_id = $2 ORDER BY le.created_at DESC LIMIT 100`,
      [user.businessId, user.id],
    ),
    database.query<{ id: string; name: string; description: string; points_cost: number }>(
      "SELECT id, name, description, points_cost FROM rewards WHERE business_id = $1 AND active = true ORDER BY points_cost",
      [user.businessId],
    ),
    database.query<{
      id: string;
      reward_id: string;
      name: string;
      points_cost: number;
      code: string;
      status: string;
      created_at: Date;
    }>(
      `SELECT rd.id, rd.reward_id, r.name, r.points_cost, rd.code, rd.status, rd.created_at
         FROM redemptions rd JOIN rewards r ON r.id = rd.reward_id
        WHERE rd.business_id = $1 AND rd.member_id = $2 ORDER BY rd.created_at DESC`,
      [user.businessId, user.id],
    ),
    database.query<{ business_name: string; location_name: string }>(
      `SELECT b.name AS business_name, COALESCE(l.name, 'Primary location') AS location_name
         FROM businesses b LEFT JOIN locations l ON l.id = $2 WHERE b.id = $1`,
      [user.businessId, user.locationId],
    ),
  ]);
  return {
    member: user,
    context: context.rows[0],
    points: Number(balance.rows[0]?.points ?? 0),
    ledger: ledger.rows.map((row) => ({ ...row, pointsDelta: Number(row.points_delta) })),
    rewards: rewards.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      points: row.points_cost,
    })),
    redemptions: redemptions.rows,
  };
}

async function audit(
  client: PoolClient,
  businessId: string,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: object,
) {
  await client.query(
    "INSERT INTO audit_events(id, business_id, actor_user_id, action, target_type, target_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [id("aud"), businessId, actorId, action, targetType, targetId, JSON.stringify(metadata)],
  );
}

function requestDigest(operation: string, payload: object): string {
  return createHash("sha256")
    .update(`${operation}:${JSON.stringify(payload)}`)
    .digest("hex");
}

async function reserveIdempotency(
  client: PoolClient,
  user: SessionUser,
  operation: "award" | "redeem",
  key: string,
  payload: object,
): Promise<string | null> {
  const digest = requestDigest(operation, payload);
  await client.query(
    `INSERT INTO idempotency_records(business_id,actor_user_id,idempotency_key,operation,request_digest)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
    [user.businessId, user.id, key, operation, digest],
  );
  const record = await client.query<{
    operation: string;
    request_digest: string;
    result_id: string | null;
  }>(
    `SELECT operation, request_digest, result_id FROM idempotency_records
      WHERE business_id = $1 AND actor_user_id = $2 AND idempotency_key = $3 FOR UPDATE`,
    [user.businessId, user.id, key],
  );
  const row = record.rows[0];
  if (!row || row.operation !== operation || row.request_digest !== digest)
    throw Object.assign(new Error("Idempotency key was already used for a different request"), {
      status: 409,
    });
  return row.result_id;
}

async function finishIdempotency(
  client: PoolClient,
  user: SessionUser,
  key: string,
  resultId: string,
) {
  await client.query(
    `UPDATE idempotency_records SET result_id = $4
      WHERE business_id = $1 AND actor_user_id = $2 AND idempotency_key = $3`,
    [user.businessId, user.id, key, resultId],
  );
}

export async function awardPoints(
  user: SessionUser,
  input: {
    memberId: string;
    points: number;
    amountCents: number;
    idempotencyKey: string;
    note?: string;
  },
) {
  if (!Number.isSafeInteger(input.points) || input.points <= 0 || input.points > 1_000_000)
    throw Object.assign(new Error("Points must be a positive integer"), { status: 400 });
  if (
    !Number.isSafeInteger(input.amountCents) ||
    input.amountCents < 0 ||
    input.amountCents > 100_000_000
  )
    throw Object.assign(new Error("Amount is invalid"), { status: 400 });
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(input.idempotencyKey))
    throw Object.assign(new Error("A valid idempotency key is required"), { status: 400 });
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const member = await client.query(
      "SELECT id FROM users WHERE id = $1 AND business_id = $2 AND role = 'member' AND active = true FOR UPDATE",
      [input.memberId, user.businessId],
    );
    if (!member.rowCount) throw Object.assign(new Error("Member not found"), { status: 404 });
    const existingResultId = await reserveIdempotency(client, user, "award", input.idempotencyKey, {
      memberId: input.memberId,
      points: input.points,
      amountCents: input.amountCents,
      note: input.note ?? "Point award",
    });
    if (existingResultId) {
      await client.query("COMMIT");
      return { id: existingResultId, duplicate: true };
    }
    const entryId = id("led");
    await client.query(
      `INSERT INTO ledger_entries(id,business_id,location_id,member_id,actor_user_id,entry_type,points_delta,amount_cents,idempotency_key,note)
       VALUES ($1,$2,$3,$4,$5,'earn',$6,$7,$8,$9)`,
      [
        entryId,
        user.businessId,
        user.locationId,
        input.memberId,
        user.id,
        input.points,
        input.amountCents,
        input.idempotencyKey,
        input.note ?? "Point award",
      ],
    );
    await client.query(
      `INSERT INTO member_balances(business_id, member_id, points) VALUES ($1,$2,$3)
       ON CONFLICT (business_id,member_id) DO UPDATE SET points = member_balances.points + EXCLUDED.points, updated_at = now()`,
      [user.businessId, input.memberId, input.points],
    );
    await audit(client, user.businessId, user.id, "points.awarded", "ledger_entry", entryId, input);
    await finishIdempotency(client, user, input.idempotencyKey, entryId);
    await client.query("COMMIT");
    return { id: entryId, duplicate: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function redeemReward(
  user: SessionUser,
  input: { rewardId: string; idempotencyKey: string },
) {
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(input.idempotencyKey))
    throw Object.assign(new Error("A valid idempotency key is required"), { status: 400 });
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const existingResultId = await reserveIdempotency(
      client,
      user,
      "redeem",
      input.idempotencyKey,
      {
        rewardId: input.rewardId,
      },
    );
    if (existingResultId) {
      const existing = await client.query<{ id: string; code: string }>(
        "SELECT id, code FROM redemptions WHERE id = $1 AND business_id = $2 AND member_id = $3",
        [existingResultId, user.businessId, user.id],
      );
      await client.query("COMMIT");
      return { ...existing.rows[0], duplicate: true };
    }
    const rewardResult = await client.query<{ id: string; points_cost: number }>(
      "SELECT id, points_cost FROM rewards WHERE id = $1 AND business_id = $2 AND active = true",
      [input.rewardId, user.businessId],
    );
    const reward = rewardResult.rows[0];
    if (!reward) throw Object.assign(new Error("Reward not found"), { status: 404 });
    const balanceResult = await client.query<{ points: number }>(
      "SELECT points FROM member_balances WHERE business_id = $1 AND member_id = $2 FOR UPDATE",
      [user.businessId, user.id],
    );
    const currentPoints = Number(balanceResult.rows[0]?.points ?? 0);
    if (currentPoints < reward.points_cost)
      throw Object.assign(new Error("Insufficient points"), { status: 409 });
    const nextPoints = currentPoints - reward.points_cost;
    const updatedBalance = await client.query(
      `UPDATE member_balances
          SET points = $3, updated_at = now()
        WHERE business_id = $1 AND member_id = $2 AND points = $4`,
      [user.businessId, user.id, nextPoints, currentPoints],
    );
    if (!updatedBalance.rowCount)
      throw Object.assign(new Error("Balance changed; retry redemption"), { status: 409 });
    const entryId = id("led");
    await client.query(
      `INSERT INTO ledger_entries(id,business_id,location_id,member_id,actor_user_id,entry_type,points_delta,reward_id,idempotency_key,note)
       VALUES ($1,$2,$3,$4,$4,'redeem',$5,$6,$7,'Reward redemption')`,
      [
        entryId,
        user.businessId,
        user.locationId,
        user.id,
        -reward.points_cost,
        reward.id,
        input.idempotencyKey,
      ],
    );

    const redemptionId = id("red");
    const code = `ELITE-${randomBytes(10).toString("hex").toUpperCase()}`;
    await client.query(
      "INSERT INTO redemptions(id,business_id,member_id,reward_id,ledger_entry_id,code) VALUES ($1,$2,$3,$4,$5,$6)",
      [redemptionId, user.businessId, user.id, reward.id, entryId, code],
    );
    await audit(client, user.businessId, user.id, "reward.redeemed", "redemption", redemptionId, {
      rewardId: reward.id,
      points: reward.points_cost,
    });
    await finishIdempotency(client, user, input.idempotencyKey, redemptionId);
    await client.query("COMMIT");
    return { id: redemptionId, code, duplicate: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
