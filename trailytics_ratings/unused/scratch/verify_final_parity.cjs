const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: { rejectUnauthorized: false }
});

async function verifyFinalParity() {
    const compRes = await pool.query("SELECT id FROM public.companies WHERE slug = 'prestige' OR name ILIKE '%prestige%' LIMIT 1");
    const companyId = compRes.rows[0].id;
    const trendPeriod = 3;

    const latestDateRes = await pool.query('SELECT MAX(review_date) as max_date FROM ratings.reviews WHERE company_id = $1', [companyId]);
    const latestDate = latestDateRes.rows[0].max_date;
    const anchorDate = `'${latestDate.toISOString().split('T')[0]}'::date`;

    console.log('Verifying parity after fix (take 3)...');

    const catSql = `
        WITH snap_cats AS (
            SELECT DISTINCT ON (ps.web_pid) web_pid, ps.pareto_status
            FROM ratings.product_snapshots ps
            WHERE ps.company_id = '${companyId}'
              AND ps.category ILIKE 'Pressure Cooker'
              AND ps.snapshot_date >= (${anchorDate} - INTERVAL '${trendPeriod} months')
        ),
        review_only_cats AS (
            SELECT DISTINCT ON (r.web_pid) web_pid, r.pareto_status
            FROM ratings.reviews r
            WHERE r.company_id = '${companyId}'
              AND r.category ILIKE 'Pressure Cooker'
              AND r.review_date >= (${anchorDate} - INTERVAL '${trendPeriod} months')
              AND NOT EXISTS (SELECT 1 FROM snap_cats sc WHERE sc.web_pid = r.web_pid)
        ),
        all_skus AS (
            SELECT web_pid, pareto_status FROM snap_cats
            UNION ALL
            SELECT web_pid, pareto_status FROM review_only_cats
        )
        SELECT 
            COUNT(DISTINCT web_pid) AS total,
            COUNT(DISTINCT web_pid) FILTER (WHERE pareto_status = 'Pareto') AS pareto,
            COUNT(DISTINCT web_pid) FILTER (WHERE pareto_status IN ('Non-Pareto', 'Non-Pareto (Unclassified)') OR pareto_status IS NULL) AS non_pareto,
            COUNT(DISTINCT web_pid) FILTER (WHERE pareto_status = 'NPD') AS npd
        FROM all_skus
    `;

    const execSql = `
        WITH latest_snapshots AS (
            SELECT DISTINCT ON (ps.platform, ps.web_pid) web_pid, ps.pareto_status, ps.platform as platform_key
            FROM ratings.product_snapshots ps
            WHERE ps.company_id = '${companyId}'
              AND ps.category ILIKE 'Pressure Cooker'
              AND ps.snapshot_date >= (${anchorDate} - INTERVAL '${trendPeriod} months')
        ),
        review_stats AS (
            SELECT DISTINCT ON (r.web_pid) web_pid, r.pareto_status
            FROM ratings.reviews r
            WHERE r.company_id = '${companyId}'
              AND r.category ILIKE 'Pressure Cooker'
              AND r.review_date >= (${anchorDate} - INTERVAL '${trendPeriod} months')
        ),
        sku_scope AS (
            SELECT web_pid FROM latest_snapshots
            UNION
            SELECT web_pid FROM review_stats
        ),
        product_health AS (
            SELECT 
                ss.web_pid,
                COALESCE(ls.pareto_status, rs.pareto_status) as pareto_status
            FROM sku_scope ss
            LEFT JOIN (SELECT DISTINCT ON (web_pid) web_pid, pareto_status FROM latest_snapshots) ls ON ls.web_pid = ss.web_pid
            LEFT JOIN (SELECT DISTINCT ON (web_pid) web_pid, pareto_status FROM review_stats) rs ON rs.web_pid = ss.web_pid
        )
        SELECT 
            COUNT(DISTINCT web_pid) AS total,
            COUNT(DISTINCT web_pid) FILTER (WHERE pareto_status = 'Pareto') AS pareto,
            COUNT(DISTINCT web_pid) FILTER (WHERE pareto_status IN ('Non-Pareto', 'Non-Pareto (Unclassified)') OR pareto_status IS NULL) AS non_pareto,
            COUNT(DISTINCT web_pid) FILTER (WHERE pareto_status = 'NPD') AS npd
        FROM product_health
    `;

    const catRes = await pool.query(catSql);
    const execRes = await pool.query(execSql);

    console.log('Category Health:', catRes.rows[0]);
    console.log('Executive Overview:', execRes.rows[0]);

    if (catRes.rows[0].non_pareto === execRes.rows[0].non_pareto) {
        console.log('✅ SUCCESS: Counts match!');
    } else {
        console.log('❌ STILL DISCREPANT');
    }

    process.exit(0);
}

verifyFinalParity();
