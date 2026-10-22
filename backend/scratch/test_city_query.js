import { queryAdminDB } from '../src/config/adminClickhouse.js';

async function run() {
    const dbName = 'powerbi_dashboard';
    const pdpFilterClause = "AND lower(Platform) IN ('blinkit')";
    const threshold = 20;
    const pct = (threshold / 100).toFixed(2);
    
    const pdpQuery = `
        WITH
            latest_date AS (
                SELECT MAX(DATE) AS max_date
                FROM \`${dbName}\`.rb_pdp_olap
                WHERE DATE IS NOT NULL ${pdpFilterClause}
            ),
            week_boundaries AS (
                SELECT
                    max_date,
                    subtractDays(max_date, toDayOfWeek(max_date) % 7) AS current_week_start
                FROM latest_date
            ),
            weekly_city_stats AS (
                SELECT
                    Platform, City,
                    subtractDays(DATE, toDayOfWeek(DATE) % 7) AS week_start,
                    sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) AS neno,
                    sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) AS deno,
                    sum(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS sales
                FROM \`${dbName}\`.rb_pdp_olap
                WHERE DATE IS NOT NULL ${pdpFilterClause}
                GROUP BY Platform, City, week_start
            ),
            weekly_osa AS (
                SELECT
                    Platform, City, week_start, sales,
                    if(deno > 0, neno / deno * 100, 100) AS osa
                FROM weekly_city_stats
            ),
            current_week AS (
                SELECT w.Platform, w.City, w.osa
                FROM weekly_osa w
                CROSS JOIN week_boundaries b
                WHERE w.week_start = b.current_week_start
            ),
            l4w_city AS (
                SELECT w.Platform, w.City, avg(w.osa) AS l4w_avg, sum(w.sales) AS l4w_sales
                FROM weekly_osa w
                CROSS JOIN week_boundaries b
                WHERE w.week_start >= b.current_week_start - INTERVAL 28 DAY
                  AND w.week_start < b.current_week_start
                GROUP BY w.Platform, w.City
            ),
            city_metrics AS (
                SELECT
                    c.Platform, c.City, c.osa, l.l4w_avg, l.l4w_sales, c.osa - l.l4w_avg AS delta
                FROM current_week c
                LEFT JOIN l4w_city l ON c.Platform = l.Platform AND c.City = l.City
            ),
            city_sales_weightage AS (
                SELECT
                    *,
                    if(sum(l4w_sales) OVER (PARTITION BY Platform) > 0,
                       l4w_sales / sum(l4w_sales) OVER (PARTITION BY Platform) * 100,
                       0) AS city_sales_weightage
                FROM city_metrics
            ),
            bottom_threshold AS (
                SELECT Platform, quantile(${pct})(osa) AS threshold
                FROM city_sales_weightage
                GROUP BY Platform
            )
        SELECT
            m.Platform, m.City, m.osa, m.l4w_avg, m.delta, m.city_sales_weightage
        FROM city_sales_weightage m
        INNER JOIN bottom_threshold t ON m.Platform = t.Platform
        WHERE m.osa <= t.threshold
        ORDER BY m.Platform, m.osa ASC
        LIMIT 10
    `;
    
    try {
        const res = await queryAdminDB(pdpQuery);
        console.log('Result:', res.length, 'rows');
        if (res.length > 0) console.log(res[0]);
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
