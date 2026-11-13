import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function run() {
    try {
        const alerts = await queryAdminDB("SELECT * FROM admin_master.tb_alert WHERE alert_name LIKE '%Keyword%'");
        if (alerts.length === 0) return;
        const alert = alerts[0];
        
        const dbs = await queryAdminDB(`SELECT db_name FROM admin_master.tb_database WHERE toString(db_id) = '${alert.db_id}'`);
        const dbName = dbs[0].db_name;
        
        const threshold = parseFloat(alert.threshold_value) || 10;
        const kwQuery = `
            WITH
                ${threshold} AS delta_threshold,
                latest_date AS (
                    SELECT MAX(DATE) AS max_date
                    FROM \`${dbName}\`.rb_kw_olap
                    WHERE DATE IS NOT NULL
                ),
                week_boundaries AS (
                    SELECT max_date, subtractDays(max_date, toDayOfWeek(max_date) % 7) AS current_week_start
                    FROM latest_date
                ),
                current_week AS (
                    SELECT
                        platform_name AS Platform,
                        keyword AS KEYWORD,
                        keyword_type AS BCG,
                        ROUND(sumIf(ifNull(overall, 0), flag = 1) * 100.0 / nullIf(sum(ifNull(overall, 0)), 0), 2) AS SOS
                    FROM \`${dbName}\`.rb_kw_olap
                    CROSS JOIN week_boundaries b
                    WHERE DATE >= b.current_week_start AND DATE < b.current_week_start + INTERVAL 7 DAY
                    GROUP BY Platform, KEYWORD, BCG
                ),
                l4w AS (
                    SELECT
                        platform_name AS Platform,
                        keyword AS KEYWORD,
                        keyword_type AS BCG,
                        ROUND(sumIf(ifNull(overall, 0), flag = 1) * 100.0 / nullIf(sum(ifNull(overall, 0)), 0), 2) AS l4w_sos
                    FROM \`${dbName}\`.rb_kw_olap
                    CROSS JOIN week_boundaries b
                    WHERE DATE >= b.current_week_start - INTERVAL 28 DAY AND DATE < b.current_week_start
                    GROUP BY Platform, KEYWORD, BCG
                ),
                keyword_metrics AS (
                    SELECT
                        c.Platform, c.KEYWORD, c.BCG, c.SOS, l.l4w_sos AS \`L4W SOS\`, ROUND(c.SOS - l.l4w_sos, 2) AS DELTA
                    FROM current_week c
                    INNER JOIN l4w l ON c.Platform = l.Platform AND c.KEYWORD = l.KEYWORD AND c.BCG = l.BCG
                )
            SELECT
                Platform, KEYWORD, SOS, \`L4W SOS\`, DELTA, BCG
            FROM keyword_metrics
            WHERE DELTA > delta_threshold
            ORDER BY Platform, BCG, DELTA DESC
            LIMIT 10 BY Platform, BCG
        `;
        const kwStats = await queryAdminDB(kwQuery);
        console.log(`Query returned ${kwStats.length} rows`);
        if (kwStats.length > 0) {
            console.log(kwStats[0]);
        }
    } catch(e) {
        console.error(e);
    }
}
run();
