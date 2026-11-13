import type { SessionUser } from "./auth.ts";
import { getPool, id } from "./database.ts";

export type LoyaltyMode = "points" | "visits";
export type LoyaltySettings = { loyaltyMode: LoyaltyMode; pointsPerDollar: number };

export function parsePointsPerDollar(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 1_000)
    throw Object.assign(new Error("Points per dollar must be a whole number from 1 to 1,000"), {
      status: 400,
    });
  return Number(value);
}

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
  const result = await getPool().query<{
    loyalty_mode: LoyaltyMode;
    points_per_dollar: number;
  }>("SELECT loyalty_mode, points_per_dollar FROM businesses WHERE id = $1", [businessId]);
  const row = result.rows[0];
  if (!row) throw Object.assign(new Error("Business not found"), { status: 404 });
  return { loyaltyMode: row.loyalty_mode, pointsPerDollar: Number(row.points_per_dollar) };
}

async function updateForBusiness(
  user: SessionUser,
  businessId: string,
  loyaltyMode: LoyaltyMode,
  pointsPerDollar: number,
  excludePlatformBusiness: boolean,
): Promise<LoyaltySettings> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{
      loyalty_mode: LoyaltyMode;
      points_per_dollar: number;
    }>(
      `SELECT loyalty_mode, points_per_dollar FROM businesses
        WHERE id = $1
          ${excludePlatformBusiness ? "AND id <> (SELECT business_id FROM platform_state WHERE singleton = true)" : ""}
        FOR UPDATE`,
      [businessId],
    );
    const row = current.rows[0];
    if (!row) throw Object.assign(new Error("Business not found"), { status: 404 });
    const currentPointsPerDollar = Number(row.points_per_dollar);
    if (row.loyalty_mode !== loyaltyMode || currentPointsPerDollar !== pointsPerDollar) {
      await client.query(
        "UPDATE businesses SET loyalty_mode = $2, points_per_dollar = $3, updated_at = now() WHERE id = $1",
        [businessId, loyaltyMode, pointsPerDollar],
      );
      await client.query(
        `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
         VALUES ($1,$2,$3,'platform.client.loyalty_settings.updated','business',$2,$4)`,
        [
          id("aud"),
          businessId,
          user.id,
          JSON.stringify({
            before: {
              loyaltyMode: row.loyalty_mode,
              pointsPerDollar: currentPointsPerDollar,
            },
            after: { loyaltyMode, pointsPerDollar },
          }),
        ],
      );
    }
    await client.query("COMMIT");
    return { loyaltyMode, pointsPerDollar };
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
  pointsPerDollar: number,
): Promise<LoyaltySettings> {
  requirePlatformAdmin(user);
  return updateForBusiness(user, businessId, loyaltyMode, pointsPerDollar, true);
}
