import pg from "pg";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
try {
  const accounts = await pool.query(`
    SELECT u.id,u.name,u.email,u.role,u.platform_admin,b.id AS business_id,b.name AS business_name,
           (SELECT business_id FROM platform_state WHERE singleton=true) AS platform_business_id
      FROM users u JOIN businesses b ON b.id=u.business_id
     WHERE lower(u.name) IN ('mike d','big smoke') OR u.platform_admin=true
     ORDER BY u.created_at`);
  const counts = await pool.query(`
    SELECT (SELECT count(*)::int FROM businesses) AS businesses,
           (SELECT count(*)::int FROM users) AS users,
           (SELECT count(*)::int FROM ledger_entries) AS ledger_entries,
           (SELECT count(*)::int FROM redemptions) AS redemptions,
           (SELECT count(*)::int FROM audit_events) AS audit_events`);
  console.log(JSON.stringify({ accounts: accounts.rows, counts: counts.rows[0] }, null, 2));
} finally {
  await pool.end();
}
