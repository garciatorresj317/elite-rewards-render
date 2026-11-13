import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool, id } from "./database.ts";
import type { SessionUser } from "./auth.ts";
import { clientLogoPath } from "./business-branding.ts";
import type { LoyaltyMode } from "./loyalty-settings-service.ts";
import { countBusinessMembers } from "./member-count.ts";

export type PublicReward = { id: string; name: string; description: string; cost: number };

const unitColumn = (mode: LoyaltyMode) => (mode === "visits" ? "visits" : "points");
const rewardCostColumn = (mode: LoyaltyMode) => (mode === "visits" ? "visits_cost" : "points_cost");

export async function getDashboard(user: SessionUser) {
  const database = getPool();
  const business = await database.query<{
    business_name: string;
    location_name: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
    business_id: string;
    has_logo: boolean;
    updated_at: Date;
    loyalty_mode: LoyaltyMode;
    points_per_dollar: number;
  }>(
    `SELECT b.id AS business_id,b.name AS business_name,l.name AS location_name,b.logo_url,
            b.primary_color,b.secondary_color,b.updated_at,b.loyalty_mode,b.points_per_dollar,
            (b.logo_data IS NOT NULL) AS has_logo
       FROM businesses b LEFT JOIN locations l ON l.business_id=b.id
      WHERE b.id=$1 ORDER BY l.created_at LIMIT 1`,
    [user.businessId],
  );
  const businessRow = business.rows[0];
  const mode: LoyaltyMode = businessRow?.loyalty_mode ?? "points";
  const units = unitColumn(mode);
  const cost = rewardCostColumn(mode);
  const [totalClients, memberCount, totals, transactions, members, rewards] = await Promise.all([
    user.platformAdmin
      ? database.query<{ count: string }>(
          `SELECT count(*) AS count
             FROM businesses
            WHERE id <> (SELECT business_id FROM platform_state WHERE singleton = true)`,
        )
      : Promise.resolve(null),
    countBusinessMembers(database, user.businessId),
    database.query<{
      units_awarded: string;
      rewards_redeemed: string;
      eligible_sales_cents: string;
    }>(
      `SELECT
       COALESCE(sum(CASE WHEN entry_type='earn' AND loyalty_mode=$2 THEN ${units}_delta ELSE 0 END),0) AS units_awarded,
       count(*) FILTER (WHERE entry_type='redeem') AS rewards_redeemed,
       COALESCE(sum(CASE WHEN entry_type='earn' THEN amount_cents ELSE 0 END),0) AS eligible_sales_cents
       FROM ledger_entries WHERE business_id=$1`,
      [user.businessId, mode],
    ),
    database.query<{
      id: string;
      member: string;
      amount_cents: number;
      units_delta: number;
      entry_type: string;
      created_at: Date;
      reward_name: string | null;
    }>(
      `SELECT le.id,u.name AS member,le.amount_cents,le.${units}_delta AS units_delta,
              le.entry_type,le.created_at,COALESCE(le.reward_name_snapshot,r.name) AS reward_name
         FROM ledger_entries le JOIN users u ON u.id=le.member_id
         LEFT JOIN rewards r ON r.id=le.reward_id
        WHERE le.business_id=$1 AND le.loyalty_mode=$2 ORDER BY le.created_at DESC LIMIT 50`,
      [user.businessId, mode],
    ),
    database.query<{ id: string; name: string; email: string; member_code: string; units: number }>(
      `SELECT u.id,u.name,u.email,u.member_code,COALESCE(mb.${units},0) AS units
         FROM users u LEFT JOIN member_balances mb ON mb.member_id=u.id AND mb.business_id=u.business_id
        WHERE u.business_id=$1 AND u.role='member' AND u.active=true ORDER BY u.name`,
      [user.businessId],
    ),
    database.query<{ id: string; name: string; description: string; cost: number }>(
      `SELECT id,name,description,${cost} AS cost FROM rewards
        WHERE business_id=$1 AND active=true AND archived_at IS NULL
          AND (inventory_remaining IS NULL OR inventory_remaining>0) ORDER BY ${cost}`,
      [user.businessId],
    ),
  ]);
  const total = totals.rows[0];
  return {
    business: businessRow
      ? {
          business_name: businessRow.business_name,
          location_name: businessRow.location_name,
          logo_url: businessRow.has_logo
            ? clientLogoPath(businessRow.business_id, businessRow.updated_at)
            : businessRow.logo_url,
          primary_color: businessRow.primary_color,
          secondary_color: businessRow.secondary_color,
          loyalty_mode: mode,
          points_per_dollar: Number(businessRow.points_per_dollar),
        }
      : {
          business_name: "Elite Rewards",
          location_name: "Primary location",
          logo_url: null,
          primary_color: "#F6B900",
          secondary_color: "#FFE27A",
          loyalty_mode: "points" as const,
          points_per_dollar: 1,
        },
    metrics: {
      totalClients: totalClients ? Number(totalClients.rows[0]?.count ?? 0) : null,
      members: memberCount,
      unitsAwarded: Number(total?.units_awarded ?? 0),
      rewardsRedeemed: Number(total?.rewards_redeemed ?? 0),
      eligibleSalesCents: Number(total?.eligible_sales_cents ?? 0),
    },
    transactions: transactions.rows.map((row) => ({
      id: row.id,
      member: row.member,
      amount: Number(row.amount_cents) / 100,
      units: Math.abs(Number(row.units_delta)),
      type: row.entry_type === "redeem" ? "redeemed" : "earned",
      time: row.created_at,
      rewardName: row.reward_name,
    })),
    members: members.rows.map((row) => ({ ...row, units: Number(row.units) })),
    rewards: rewards.rows.map((row) => ({ ...row, cost: Number(row.cost) })),
  };
}

export async function getWallet(user: SessionUser) {
  const database = getPool();
  const context = await database.query<{
    business_name: string;
    location_name: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
    business_id: string;
    has_logo: boolean;
    updated_at: Date;
    loyalty_mode: LoyaltyMode;
  }>(
    `SELECT b.id AS business_id,b.name AS business_name,COALESCE(l.name,'Primary location') AS location_name,
            b.logo_url,b.primary_color,b.secondary_color,b.updated_at,b.loyalty_mode,
            (b.logo_data IS NOT NULL) AS has_logo
       FROM businesses b LEFT JOIN locations l ON l.id=$2 WHERE b.id=$1`,
    [user.businessId, user.locationId],
  );
  const contextRow = context.rows[0];
  const mode: LoyaltyMode = contextRow?.loyalty_mode ?? "points";
  const units = unitColumn(mode);
  const cost = rewardCostColumn(mode);
  const [balance, ledger, rewards, redemptions, products] = await Promise.all([
    database.query<{ balance: number }>(
      `SELECT ${units} AS balance FROM member_balances WHERE business_id=$1 AND member_id=$2`,
      [user.businessId, user.id],
    ),
    database.query<{
      id: string;
      entry_type: string;
      units_delta: number;
      note: string;
      created_at: Date;
      reward_name: string | null;
    }>(
      `SELECT le.id,le.entry_type,le.${units}_delta AS units_delta,le.note,le.created_at,
              COALESCE(le.reward_name_snapshot,r.name) AS reward_name
         FROM ledger_entries le LEFT JOIN rewards r ON r.id=le.reward_id
        WHERE le.business_id=$1 AND le.member_id=$2 AND le.loyalty_mode=$3
        ORDER BY le.created_at DESC LIMIT 100`,
      [user.businessId, user.id, mode],
    ),
    database.query<{ id: string; name: string; description: string; cost: number }>(
      `SELECT id,name,description,${cost} AS cost FROM rewards
        WHERE business_id=$1 AND active=true AND archived_at IS NULL
          AND (inventory_remaining IS NULL OR inventory_remaining>0) ORDER BY ${cost}`,
      [user.businessId],
    ),
    database.query<{
      id: string;
      reward_id: string;
      name: string;
      cost: number;
      code: string;
      status: string;
      created_at: Date;
    }>(
      `SELECT rd.id,rd.reward_id,COALESCE(rd.reward_name_snapshot,r.name) AS name,
              CASE WHEN $3='visits' THEN COALESCE(rd.visits_cost_snapshot,r.visits_cost)
                   ELSE COALESCE(rd.points_cost_snapshot,r.points_cost) END AS cost,
              rd.code,rd.status,rd.created_at
         FROM redemptions rd JOIN rewards r ON r.id=rd.reward_id
        WHERE rd.business_id=$1 AND rd.member_id=$2 ORDER BY rd.created_at DESC`,
      [user.businessId, user.id, mode],
    ),
    database.query<{
      id: string;
      name: string;
      description: string;
      category: string;
      price_cents: number;
      points_cost: number | null;
      visits_cost: number | null;
      image_url: string | null;
      has_image: boolean;
      purchase_url: string | null;
    }>(
      `SELECT id,name,description,category,price_cents,points_cost,visits_cost,image_url,purchase_url,
              (image_data IS NOT NULL) AS has_image FROM business_products
        WHERE business_id=$1 AND active=true AND archived_at IS NULL ORDER BY category,name,created_at,id`,
      [user.businessId],
    ),
  ]);
  return {
    member: user,
    context: contextRow
      ? {
          business_name: contextRow.business_name,
          location_name: contextRow.location_name,
          logo_url: contextRow.has_logo
            ? clientLogoPath(contextRow.business_id, contextRow.updated_at)
            : contextRow.logo_url,
          primary_color: contextRow.primary_color,
          secondary_color: contextRow.secondary_color,
          loyalty_mode: mode,
        }
      : null,
    balance: Number(balance.rows[0]?.balance ?? 0),
    points: Number(balance.rows[0]?.balance ?? 0),
    loyaltyMode: mode,
    ledger: ledger.rows.map((row) => ({ ...row, unitsDelta: Number(row.units_delta) })),
    rewards: rewards.rows.map((row) => ({
      ...row,
      cost: Number(row.cost),
      points: Number(row.cost),
    })),
    redemptions: redemptions.rows.map((row) => ({ ...row, cost: Number(row.cost) })),
    products: products.rows.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      priceCents: Number(item.price_cents),
      pointsCost: item.points_cost === null ? 0 : Number(item.points_cost),
      visitsCost: item.visits_cost === null ? 0 : Number(item.visits_cost),
      imageUrl: item.has_image
        ? `/api/public/products/${encodeURIComponent(item.id)}/image`
        : item.image_url,
      purchaseUrl: item.purchase_url,
    })),
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
    "INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [id("aud"), businessId, actorId, action, targetType, targetId, JSON.stringify(metadata)],
  );
}
function requestDigest(operation: string, payload: object) {
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
    `INSERT INTO idempotency_records(business_id,actor_user_id,idempotency_key,operation,request_digest) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
    [user.businessId, user.id, key, operation, digest],
  );
  const record = await client.query<{
    operation: string;
    request_digest: string;
    result_id: string | null;
  }>(
    `SELECT operation,request_digest,result_id FROM idempotency_records WHERE business_id=$1 AND actor_user_id=$2 AND idempotency_key=$3 FOR UPDATE`,
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
    `UPDATE idempotency_records SET result_id=$4 WHERE business_id=$1 AND actor_user_id=$2 AND idempotency_key=$3`,
    [user.businessId, user.id, key, resultId],
  );
}

export async function awardPoints(
  user: SessionUser,
  input: {
    memberId: string;
    units?: number;
    points?: number;
    amountCents: number;
    idempotencyKey: string;
    note?: string;
  },
) {
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
    const business = await client.query<{
      loyalty_mode: LoyaltyMode;
      points_per_dollar: number;
    }>(
      "SELECT loyalty_mode, points_per_dollar FROM businesses WHERE id=$1 AND active=true FOR UPDATE",
      [user.businessId],
    );
    const businessRow = business.rows[0];
    const mode = businessRow?.loyalty_mode;
    if (!mode || !businessRow)
      throw Object.assign(new Error("Rewards program unavailable"), { status: 404 });
    const submittedUnits = input.units ?? input.points;
    const awardedUnits =
      mode === "points"
        ? Math.floor((input.amountCents * Number(businessRow.points_per_dollar)) / 100)
        : submittedUnits;
    if (
      !Number.isSafeInteger(awardedUnits) ||
      !awardedUnits ||
      awardedUnits <= 0 ||
      awardedUnits > 1_000_000
    )
      throw Object.assign(
        new Error(
          mode === "points"
            ? "Purchase amount is too small or too large for this points rate"
            : "Loyalty amount must be a positive integer",
        ),
        { status: 400 },
      );
    const column = unitColumn(mode);
    const member = await client.query(
      "SELECT id FROM users WHERE id=$1 AND business_id=$2 AND role='member' AND active=true FOR UPDATE",
      [input.memberId, user.businessId],
    );
    if (!member.rowCount) throw Object.assign(new Error("Member not found"), { status: 404 });
    const payload = {
      memberId: input.memberId,
      units: awardedUnits,
      amountCents: input.amountCents,
      note: input.note ?? "Loyalty award",
      ...(mode === "points" ? { pointsPerDollar: Number(businessRow.points_per_dollar) } : {}),
    };
    const existing = await reserveIdempotency(client, user, "award", input.idempotencyKey, payload);
    if (existing) {
      await client.query("COMMIT");
      return { id: existing, duplicate: true };
    }
    const entryId = id("led");
    await client.query(
      `INSERT INTO ledger_entries(id,business_id,location_id,member_id,actor_user_id,entry_type,points_delta,visits_delta,loyalty_mode,amount_cents,idempotency_key,note) VALUES ($1,$2,$3,$4,$5,'earn',$6,$7,$8,$9,$10,$11)`,
      [
        entryId,
        user.businessId,
        user.locationId,
        input.memberId,
        user.id,
        mode === "points" ? awardedUnits : 0,
        mode === "visits" ? awardedUnits : 0,
        mode,
        input.amountCents,
        input.idempotencyKey,
        payload.note,
      ],
    );
    await client.query(
      `INSERT INTO member_balances(business_id,member_id,points,visits) VALUES ($1,$2,$3,$4) ON CONFLICT (business_id,member_id) DO UPDATE SET ${column}=member_balances.${column}+$5,updated_at=now()`,
      [
        user.businessId,
        input.memberId,
        mode === "points" ? awardedUnits : 0,
        mode === "visits" ? awardedUnits : 0,
        awardedUnits,
      ],
    );
    await audit(
      client,
      user.businessId,
      user.id,
      `${mode}.awarded`,
      "ledger_entry",
      entryId,
      payload,
    );
    await finishIdempotency(client, user, input.idempotencyKey, entryId);
    await client.query("COMMIT");
    return { id: entryId, duplicate: false, unitsAwarded: awardedUnits };
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
    const business = await client.query<{ loyalty_mode: LoyaltyMode }>(
      "SELECT loyalty_mode FROM businesses WHERE id=$1 AND active=true FOR UPDATE",
      [user.businessId],
    );
    const mode = business.rows[0]?.loyalty_mode;
    if (!mode) throw Object.assign(new Error("Rewards program unavailable"), { status: 404 });
    const column = unitColumn(mode),
      costColumn = rewardCostColumn(mode);
    const existing = await reserveIdempotency(client, user, "redeem", input.idempotencyKey, {
      rewardId: input.rewardId,
    });
    if (existing) {
      const result = await client.query<{ id: string; code: string }>(
        "SELECT id,code FROM redemptions WHERE id=$1 AND business_id=$2 AND member_id=$3",
        [existing, user.businessId, user.id],
      );
      await client.query("COMMIT");
      return { ...result.rows[0], duplicate: true };
    }
    const rewardResult = await client.query<{
      id: string;
      name: string;
      cost: number;
      inventory_remaining: number | null;
    }>(
      `SELECT id,name,${costColumn} AS cost,inventory_remaining FROM rewards WHERE id=$1 AND business_id=$2 AND active=true AND archived_at IS NULL AND (inventory_remaining IS NULL OR inventory_remaining>0) FOR UPDATE`,
      [input.rewardId, user.businessId],
    );
    const reward = rewardResult.rows[0];
    if (!reward) throw Object.assign(new Error("Reward not found"), { status: 404 });
    const balanceResult = await client.query<{ balance: number }>(
      `SELECT ${column} AS balance FROM member_balances WHERE business_id=$1 AND member_id=$2 FOR UPDATE`,
      [user.businessId, user.id],
    );
    const current = Number(balanceResult.rows[0]?.balance ?? 0),
      cost = Number(reward.cost);
    if (current < cost) throw Object.assign(new Error(`Insufficient ${mode}`), { status: 409 });
    const updated = await client.query(
      `UPDATE member_balances SET ${column}=$3,updated_at=now() WHERE business_id=$1 AND member_id=$2 AND ${column}=$4`,
      [user.businessId, user.id, current - cost, current],
    );
    if (!updated.rowCount)
      throw Object.assign(new Error("Balance changed; retry redemption"), { status: 409 });
    const entryId = id("led");
    await client.query(
      `INSERT INTO ledger_entries(id,business_id,location_id,member_id,actor_user_id,entry_type,points_delta,visits_delta,loyalty_mode,reward_id,idempotency_key,note,reward_name_snapshot) VALUES ($1,$2,$3,$4,$4,'redeem',$5,$6,$7,$8,$9,'Reward redemption',$10)`,
      [
        entryId,
        user.businessId,
        user.locationId,
        user.id,
        mode === "points" ? -cost : 0,
        mode === "visits" ? -cost : 0,
        mode,
        reward.id,
        input.idempotencyKey,
        reward.name,
      ],
    );
    const redemptionId = id("red"),
      code = `ELITE-${randomBytes(10).toString("hex").toUpperCase()}`;
    await client.query(
      `INSERT INTO redemptions(id,business_id,member_id,reward_id,ledger_entry_id,code,reward_name_snapshot,points_cost_snapshot,visits_cost_snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        redemptionId,
        user.businessId,
        user.id,
        reward.id,
        entryId,
        code,
        reward.name,
        mode === "points" ? cost : null,
        mode === "visits" ? cost : null,
      ],
    );
    if (reward.inventory_remaining !== null) {
      const inventory = await client.query(
        `UPDATE rewards SET inventory_remaining = inventory_remaining - 1, updated_at=now() WHERE id=$1 AND business_id=$2 AND inventory_remaining>0`,
        [reward.id, user.businessId],
      );
      if (!inventory.rowCount)
        throw Object.assign(new Error("Reward is no longer available"), { status: 409 });
    }
    await audit(client, user.businessId, user.id, "reward.redeemed", "redemption", redemptionId, {
      rewardId: reward.id,
      loyaltyMode: mode,
      cost,
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
