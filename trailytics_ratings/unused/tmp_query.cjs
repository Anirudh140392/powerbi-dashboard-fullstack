const { Pool } = require('pg');
const pool = new Pool({
    host: '34.131.29.106',
    database: 'adsauto',
    user: 'adsauto',
    password: 'Adsauto7060',
    port: 5432,
});

(async () => {
    try {
        const res = await pool.query(`
            SELECT brand, count(*)::int as cnt 
            FROM ratings.reviews 
            WHERE company_id = '297e37ea-a5ac-47df-bebd-ac44e52b7979' 
              AND is_competitor = true
            GROUP BY brand 
            ORDER BY cnt DESC 
            LIMIT 25
        `);
        res.rows.forEach(r => console.log(`${r.cnt}\t${r.brand}`));
    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
    }
})();
