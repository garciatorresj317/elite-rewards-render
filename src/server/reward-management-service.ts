import type { PoolClient } from "pg";
import type { SessionUser } from "./auth.ts";
import { getPool, id } from "./database.ts";

export type ManagedReward = {
  id: string;
  name: string;
  description: string;
  points: number;
  visits: number;
  active: boolean;
  inventoryRemaining: number | null;
  archivedAt: string | null;
  redemptionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type RewardInput = {
  name: string;
  description: string;
  points: number;
  visits?: number;
  active: boolean;
  inventoryRemaining: number | null;
};

function requireOwner(user: SessionUser): void {
  if (user.role !== "owner") {
    throw Object.assign(new Error("Owner access required"), { status: 403 });
  }
}

function requirePlatformAdmin(user: SessionUser): void {
  if (!user.platformAdmin)
    throw Object.assign(new Error("Platform administrator access required"), { status: 403 });
}

async function clientOwnerContext(user: SessionUser, businessId: string): Promise<SessionUser> {
  requirePlatformAdmin(user);
  const client = await getPool().query(
    `SELECT 1 FROM businesses
      WHERE id = $1
        AND id <> (SELECT business_id FROM platform_state WHERE singleton = true)`,
    [businessId],
  );
  if (!client.rowCount) throw Object.assign(new Error("Client not found"), { status: 404 });
  return { ...user, businessId, role: "owner", platformAdmin: true };
}

function validate(input: RewardInput): RewardInput {
  const name = input.name.trim();
  const description = input.description.trim();
  const visits =
    input.visits ?? (input.points === 0 ? 0 : Math.max(1, Math.ceil(input.points / 100)));
  if (name.length < 2 || name.length > 120)
    throw Object.assign(new Error("Reward name must contain 2 to 120 characters"), { status: 400 });
  if (description.length > 500)
    throw Object.assign(new Error("Reward description cannot exceed 500 characters"), {
      status: 400,
    });
  if (!Number.isSafeInteger(input.points) || input.points < 0 || input.points > 1_000_000)
    throw Object.assign(new Error("Points cost must be a non-negative whole number"), {
      status: 400,
    });
  if (!Number.isSafeInteger(visits) || visits < 0 || visits > 1_000_000)
    throw Object.assign(new Error("Visits cost must be a non-negative whole number"), {
      status: 400,
    });
  if (
    input.inventoryRemaining !== null &&
    (!Number.isSafeInteger(input.inventoryRemaining) ||
      input.inventoryRemaining < 0 ||
      input.inventoryRemaining > 1_000_000)
  )
    throw Object.assign(new Error("Inventory must be empty or a non-negative whole number"), {
      status: 400,
    });
  return { ...input, visits, name, description };
}

async function audit(
  client: PoolClient,
  user: SessionUser,
  action: string,
  rewardId: string,
  metadata: object,
): Promise<void> {
  await client.query(
    "INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata) VALUES ($1,$2,$3,$4,'reward',$5,$6)",
    [id("aud"), user.businessId, user.id, action, rewardId, JSON.stringify(metadata)],
  );
}

function mapReward(row: {
  id: string;
  name: string;
  description: string;
  points_cost: number;
  visits_cost: number;
  active: boolean;
  inventory_remaining: number | null;
  archived_at: Date | string | null;
  redemption_count: number | string;
  created_at: Date | string;
  updated_at: Date | string;
}): ManagedReward {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    points: Number(row.points_cost),
    visits: Number(row.visits_cost),
    active: row.active,
    inventoryRemaining: row.inventory_remaining === null ? null : Number(row.inventory_remaining),
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
    redemptionCount: Number(row.redemption_count),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listManagedRewards(user: SessionUser): Promise<ManagedReward[]> {
  requireOwner(user);
  const database = getPool();
  const result = await database.query<Omit<Parameters<typeof mapReward>[0], "redemption_count">>(
    `SELECT r.id, r.name, r.description, r.points_cost, r.visits_cost, r.active, r.inventory_remaining,
            r.archived_at, r.created_at, r.updated_at
       FROM rewards r
      WHERE r.business_id = $1
      ORDER BY (r.archived_at IS NOT NULL), r.active DESC, r.points_cost, r.created_at`,
    [user.businessId],
  );
  const redemptionCounts = await database.query<{ reward_id: string; redemption_count: string }>(
    `SELECT reward_id, count(*) AS redemption_count
       FROM redemptions WHERE business_id = $1 GROUP BY reward_id`,
    [user.businessId],
  );
  const byReward = new Map(
    redemptionCounts.rows.map((row) => [row.reward_id, Number(row.redemption_count)]),
  );
  return result.rows.map((row) =>
    mapReward({ ...row, redemption_count: byReward.get(row.id) ?? 0 }),
  );
}

export async function createReward(user: SessionUser, input: RewardInput): Promise<ManagedReward> {
  requireOwner(user);
  const value = validate(input);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const rewardId = id("rew");
    await client.query(
      `INSERT INTO rewards(id,business_id,name,description,points_cost,visits_cost,active,inventory_remaining)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        rewardId,
        user.businessId,
        value.name,
        value.description,
        value.points,
        value.visits,
        value.active,
        value.inventoryRemaining,
      ],
    );
    await audit(client, user, "reward.created", rewardId, value);
    await client.query("COMMIT");
    return (await listManagedRewards(user)).find((reward) => reward.id === rewardId)!;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateReward(
  user: SessionUser,
  rewardId: string,
  input: RewardInput,
): Promise<ManagedReward> {
  requireOwner(user);
  const value = validate(input);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{
      name: string;
      description: string;
      points_cost: number;
      visits_cost: number;
      active: boolean;
      inventory_remaining: number | null;
      archived_at: Date | null;
    }>(
      `SELECT name, description, points_cost, visits_cost, active, inventory_remaining, archived_at
         FROM rewards WHERE id = $1 AND business_id = $2 FOR UPDATE`,
      [rewardId, user.businessId],
    );
    if (!existing.rowCount) throw Object.assign(new Error("Reward not found"), { status: 404 });
    if (existing.rows[0]?.archived_at)
      throw Object.assign(new Error("Archived rewards cannot be edited"), { status: 409 });
    await client.query(
      `UPDATE rewards
          SET name = $3, description = $4, points_cost = $5, visits_cost = $6, active = $7,
              inventory_remaining = $8, updated_at = now()
        WHERE id = $1 AND business_id = $2`,
      [
        rewardId,
        user.businessId,
        value.name,
        value.description,
        value.points,
        value.visits,
        value.active,
        value.inventoryRemaining,
      ],
    );
    const previous = existing.rows[0]!;
    await audit(client, user, "reward.updated", rewardId, {
      before: {
        name: previous.name,
        description: previous.description,
        points: Number(previous.points_cost),
        visits: Number(previous.visits_cost),
        active: previous.active,
        inventoryRemaining:
          previous.inventory_remaining === null ? null : Number(previous.inventory_remaining),
      },
      after: value,
    });
    await client.query("COMMIT");
    return (await listManagedRewards(user)).find((reward) => reward.id === rewardId)!;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function archiveReward(user: SessionUser, rewardId: string): Promise<void> {
  requireOwner(user);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE rewards
          SET active = false, archived_at = COALESCE(archived_at, now()), updated_at = now()
        WHERE id = $1 AND business_id = $2 AND archived_at IS NULL`,
      [rewardId, user.businessId],
    );
    if (!result.rowCount)
      throw Object.assign(new Error("Reward not found or already archived"), { status: 404 });
    await audit(client, user, "reward.archived", rewardId, {});
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function restoreReward(user: SessionUser, rewardId: string): Promise<ManagedReward> {
  requireOwner(user);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE rewards
          SET active = false, archived_at = NULL, updated_at = now()
        WHERE id = $1 AND business_id = $2 AND archived_at IS NOT NULL`,
      [rewardId, user.businessId],
    );
    if (!result.rowCount)
      throw Object.assign(new Error("Reward not found or is not archived"), { status: 404 });
    await audit(client, user, "reward.restored", rewardId, { active: false });
    await client.query("COMMIT");
    return (await listManagedRewards(user)).find((reward) => reward.id === rewardId)!;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listClientRewards(
  user: SessionUser,
  businessId: string,
): Promise<ManagedReward[]> {
  return listManagedRewards(await clientOwnerContext(user, businessId));
}

export async function createClientReward(
  user: SessionUser,
  businessId: string,
  input: RewardInput,
): Promise<ManagedReward> {
  return createReward(await clientOwnerContext(user, businessId), input);
}

export async function updateClientReward(
  user: SessionUser,
  businessId: string,
  rewardId: string,
  input: RewardInput,
): Promise<ManagedReward> {
  return updateReward(await clientOwnerContext(user, businessId), rewardId, input);
}

export async function archiveClientReward(
  user: SessionUser,
  businessId: string,
  rewardId: string,
): Promise<void> {
  return archiveReward(await clientOwnerContext(user, businessId), rewardId);
}

export async function restoreClientReward(
  user: SessionUser,
  businessId: string,
  rewardId: string,
): Promise<ManagedReward> {
  return restoreReward(await clientOwnerContext(user, businessId), rewardId);
}
