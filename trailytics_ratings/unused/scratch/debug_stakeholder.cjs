const pg = require('pg');
const pool = new pg.Pool({
    host: '3.7.138.75',
    database: 'adsauto',
    user: 'adsauto',
    password: 'Adsauto7060',
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    const companyId = '297e37ea-a5ac-47df-bebd-ac44e52b7979';
    const dateFrom = '2024-02-07'; // Example 3 months ago
    const dateTo = '2024-05-07';

    console.log('--- Checking "Production" Stakeholder ---');

    // 1. Get subcategories for Production
    const mappingRes = await pool.query(
        `SELECT sentiment_subcategory FROM ratings.stakeholder_mappings WHERE company_id = $1 AND stakeholder = 'Production'`,
        [companyId]
    );
    const subcats = mappingRes.rows.map(r => r.sentiment_subcategory);
    console.log('Subcategories:', subcats.length);

    // 2. Query like /issues-breakdown (The "Outside" count)
    const resOutside = await pool.query(`
        SELECT SUM(negative_count) as total_neg
        FROM (
            SELECT
                r.sentiment_subcategory,
                COUNT(*) FILTER (WHERE r.sentiment = 'Negative') AS negative_count
            FROM ratings.reviews r
            WHERE r.company_id = $1
              AND r.is_competitor = false
              AND r.review_date >= $2 AND r.review_date <= $3
            GROUP BY 1
        ) t
        JOIN ratings.stakeholder_mappings m ON m.sentiment_subcategory = t.sentiment_subcategory AND m.company_id = $1
        WHERE m.stakeholder = 'Production'
    `, [companyId, dateFrom, dateTo]);
    console.log('Outside Count (Simulated):', resOutside.rows[0].total_neg);

    // 3. Query like /stakeholder-detail (The "Inside" count)
    const resInside = await pool.query(`
        WITH sku_issues AS (
            SELECT
                r.sentiment_subcategory,
                r.web_pid,
                COUNT(*) FILTER (WHERE r.sentiment = 'Negative') AS neg_count
            FROM ratings.reviews r
            WHERE r.company_id = $1
              AND r.is_competitor = false
              AND r.sentiment_subcategory = ANY($4)
              AND r.review_date >= $2 AND r.review_date <= $3
            GROUP BY 1, 2
            HAVING COUNT(*) FILTER (WHERE r.sentiment = 'Negative') > 0
        )
        SELECT SUM(neg_count) as total_neg FROM sku_issues
    `, [companyId, dateFrom, dateTo, subcats]);
    console.log('Inside Count (Simulated):', resInside.rows[0].total_neg);

    await pool.end();
}

check();
