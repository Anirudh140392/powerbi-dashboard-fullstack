const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: '3.7.138.75',
  database: 'adsauto',
  user: 'readonly_user',
  password: 'ReadOnlyadsAuto2026',
  port: 5432,
});

async function run() {
  try {
    const userResult = await pool.query(`
        SELECT id FROM ratings.users WHERE lower(email) = 'prestige@trailytics.com'
    `);
    const userId = userResult.rows[0].id;
    console.log('User ID:', userId);

    const membershipsRes = await pool.query(`
        SELECT id, company_id FROM ratings.user_company_memberships
        WHERE user_id = $1 AND status = 'active'
        ORDER BY
          CASE
            WHEN $2::uuid IS NOT NULL AND company_id = $2::uuid THEN 0
            WHEN is_primary THEN 1
            ELSE 2
          END,
          created_at ASC
    `, [userId, null]);
    
    console.log('Memberships:', membershipsRes.rows);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    pool.end();
  }
}
run();
