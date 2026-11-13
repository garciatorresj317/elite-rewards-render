import type { Pool, PoolClient } from "pg";

export type Queryable = Pick<Pool | PoolClient, "query">;

/**
 * Counts every current member relationship for a business exactly once.
 * Activated members live in users; unexpired invitations are included until activation.
 */
export async function countBusinessMembers(
  database: Queryable,
  businessId: string,
): Promise<number> {
  const result = await database.query<{ count: string }>(
    `SELECT
       (SELECT count(*) FROM users
         WHERE business_id = $1 AND role = 'member' AND active = true)
       +
       (SELECT count(*) FROM member_invitations
         WHERE business_id = $1 AND accepted_at IS NULL AND expires_at > now()) AS count`,
    [businessId],
  );
  return Number(result.rows[0]?.count ?? 0);
}
