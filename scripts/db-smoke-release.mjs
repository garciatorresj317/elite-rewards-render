import pg from "pg";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
try {
  const result = await pool.query(`
    SELECT (SELECT count(*)::int FROM businesses) AS businesses,
           (SELECT count(*)::int FROM users) AS users,
           (SELECT count(*)::int FROM ledger_entries) AS ledger_entries,
           (SELECT count(*)::int FROM redemptions) AS redemptions,
           (SELECT count(*)::int FROM audit_events) AS audit_events,
           (SELECT count(*)::int FROM users WHERE platform_admin=true) AS platform_admins,
           (SELECT count(*)::int FROM platform_administrator) AS authority_rows,
           (SELECT count(*)::int FROM businesses WHERE id<>(SELECT business_id FROM platform_state WHERE singleton=true)) AS listed_clients`);
  console.log(JSON.stringify(result.rows[0]));
} finally {
  await pool.end();
}
