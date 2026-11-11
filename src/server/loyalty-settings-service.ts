import type { SessionUser } from "./auth.ts";
import { getPool, id } from "./database.ts";

export type LoyaltyMode = "points" | "visits";
export type LoyaltySettings = { loyaltyMode: LoyaltyMode };

function requireOwner(user: SessionUser): void {
  if (user.role !== "owner")
    throw Object.assign(new Error("Business owner access required"), { status: 403 });
}

function requirePlatformAdmin(user: SessionUser): void {
  if (!user.platformAdmin)
    throw Object.assign(new Error("Platform administrator access required"), { status: 403 });
}

export function parseLoyaltyMode(value: unknown): LoyaltyMode {
  if (value !== "points" && value !== "visits")
    throw Object.assign(new Error("Loyalty mode must be points or visits"), { status: 400 });
  return value;
}

async function getForBusiness(businessId: string): Promise<LoyaltySettings> {
  const result = await getPool().query<{ loyalty_mode: LoyaltyMode }>(
    "SELECT loyalty_mode FROM businesses WHERE id = $1",
    [businessId],
  );
  const row = result.rows[0];
  if (!row) throw Object.assign(new Error("Business not found"), { status: 404 });
  return { loyaltyMode: row.loyalty_mode };
}

async function updateForBusiness(
  user: SessionUser,
  businessId: string,
  loyaltyMode: LoyaltyMode,
  excludePlatformBusiness: boolean,
): Promise<LoyaltySettings> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ loyalty_mode: LoyaltyMode }>(
      `SELECT loyalty_mode FROM businesses
        WHERE id = $1
          ${excludePlatformBusiness ? "AND id <> (SELECT business_id FROM platform_state WHERE singleton = true)" : ""}
        FOR UPDATE`,
      [businessId],
    );
    const row = current.rows[0];
    if (!row) throw Object.assign(new Error("Business not found"), { status: 404 });
    if (row.loyalty_mode !== loyaltyMode) {
      await client.query(
        "UPDATE businesses SET loyalty_mode = $2, updated_at = now() WHERE id = $1",
        [businessId, loyaltyMode],
      );
      await client.query(
        `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
         VALUES ($1,$2,$3,'business.loyalty_mode.updated','business',$2,$4)`,
        [
          id("aud"),
          businessId,
          user.id,
          JSON.stringify({ before: row.loyalty_mode, after: loyaltyMode }),
        ],
      );
    }
    await client.query("COMMIT");
    return { loyaltyMode };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getLoyaltySettings(user: SessionUser): Promise<LoyaltySettings> {
  requireOwner(user);
  return getForBusiness(user.businessId);
}

export async function updateLoyaltySettings(
  user: SessionUser,
  loyaltyMode: LoyaltyMode,
): Promise<LoyaltySettings> {
  requireOwner(user);
  return updateForBusiness(user, user.businessId, loyaltyMode, false);
}

export async function getClientLoyaltySettings(
  user: SessionUser,
  businessId: string,
): Promise<LoyaltySettings> {
  requirePlatformAdmin(user);
  const platform = await getPool().query(
    "SELECT 1 FROM businesses WHERE id = $1 AND id <> (SELECT business_id FROM platform_state WHERE singleton = true)",
    [businessId],
  );
  if (!platform.rowCount) throw Object.assign(new Error("Client not found"), { status: 404 });
  return getForBusiness(businessId);
}

export async function updateClientLoyaltySettings(
  user: SessionUser,
  businessId: string,
  loyaltyMode: LoyaltyMode,
): Promise<LoyaltySettings> {
  requirePlatformAdmin(user);
  return updateForBusiness(user, businessId, loyaltyMode, true);
}
