import pg from "pg";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
try {
  const migrations = await pool.query("SELECT version FROM schema_migrations ORDER BY version");
  const authority = await pool.query(`
    SELECT pa.user_id,u.name,u.email,b.name AS business_name
      FROM platform_administrator pa
      JOIN users u ON u.id=pa.user_id
      JOIN businesses b ON b.id=u.business_id`);
  const clients = await pool.query(`
    SELECT b.name,u.name AS owner_name,u.platform_admin,b.logo_url,b.primary_color,b.secondary_color
      FROM businesses b
      LEFT JOIN users u ON u.business_id=b.id AND u.role='owner'
     WHERE b.id<>(SELECT business_id FROM platform_state WHERE singleton=true)
     ORDER BY b.created_at`);
  console.log(
    JSON.stringify(
      { migrations: migrations.rows, authority: authority.rows, clients: clients.rows },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
