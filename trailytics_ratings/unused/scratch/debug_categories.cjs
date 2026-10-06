const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function test() {
    try {
        const { rows } = await pool.query(`
            SELECT
                COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) as raw_cat,
                COUNT(*) as count
            FROM ratings.reviews r
            LEFT JOIN masters.products mp
                ON mp.company_id = r.company_id
               AND mp.product_external_id = r.web_pid
               AND LOWER(mp.platform) = LOWER(r.platform)
            WHERE r.company_id = $1
            GROUP BY 1
            ORDER BY 2 DESC
        `, [process.env.COMPANY_ID]);
        
        console.log('Categories:', rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

test();
