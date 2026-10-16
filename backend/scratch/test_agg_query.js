import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function run() {
    const dbName = 'powerbi_dashboard';
    const pdpFilterClause = "AND lower(Platform) IN ('blinkit')";
    
    const aggQuery = `
        WITH
            latest_date AS (
                SELECT MAX(DATE) AS max_date
                FROM \`${dbName}\`.rb_pdp_olap
                WHERE DATE IS NOT NULL ${pdpFilterClause}
            ),
            week_boundaries AS (
                SELECT max_date, subtractDays(max_date, toDayOfWeek(max_date) % 7) AS current_week_start
                FROM latest_date
            ),
            weekly_stats AS (
                SELECT
                    subtractDays(DATE, toDayOfWeek(DATE) % 7) AS week_start,
                    sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) AS neno,
                    sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) AS deno
                FROM \`${dbName}\`.rb_pdp_olap
                WHERE DATE IS NOT NULL ${pdpFilterClause}
                GROUP BY week_start
            ),
            weekly_osa AS (
                SELECT week_start, if(deno > 0, neno / deno * 100, 100) AS osa
                FROM weekly_stats
            )
        SELECT
            (SELECT osa FROM weekly_osa CROSS JOIN week_boundaries WHERE week_start = current_week_start) AS cw_osa,
            (SELECT avg(osa) FROM weekly_osa CROSS JOIN week_boundaries WHERE week_start >= current_week_start - INTERVAL 28 DAY AND week_start < current_week_start) AS l4w_osa
    `;
    const res = await queryAdminDB(aggQuery);
    console.log(res);
}

run().catch(console.error);
