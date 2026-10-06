import { queryAdminDB } from './backend/src/config/adminClickhouse.js';

async function test() {
    const PM_CATEGORY_EXPR = `if(category IS NOT NULL AND category != '' AND category != '0' AND category != '-', category, 'Uncategorized')`;
    const cwStart = '2026-08-02';
    const dbName = 'prestige';
    const pmPlatClause = `AND lower(Platform) = 'blinkit'`;
    
    const query = `
        WITH
            week_boundaries AS (
                SELECT toDate('${cwStart}') AS cw_start
            ),
            weekly_cat AS (
                SELECT
                    ${PM_CATEGORY_EXPR} AS cat,
                    subtractDays(DATE, toDayOfWeek(DATE) % 7) AS week_start,
                    SUM(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) AS spend
                FROM \`${dbName}\`.rb_pm_olap
                CROSS JOIN week_boundaries b
                WHERE DATE >= b.cw_start - INTERVAL 28 DAY
                  AND DATE < b.cw_start + INTERVAL 7 DAY
                  ${pmPlatClause}
                GROUP BY cat, week_start
            ),
            cw AS (
                SELECT w.*
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE w.week_start = b.cw_start
            ),
            l4w AS (
                SELECT
                    w.cat,
                    avg(w.spend) AS spend
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE w.week_start >= b.cw_start - INTERVAL 28 DAY
                  AND w.week_start < b.cw_start
                GROUP BY w.cat
            )
        SELECT
            coalesce(c.cat, l.cat) AS CategoryName,
            ifNull(c.spend, 0) AS cw_spend,
            ifNull(l.spend, 0) AS l4w_spend
        FROM cw c
        FULL OUTER JOIN l4w l ON c.cat = l.cat
    `;
    
    try {
        console.log("Testing new Ad Spend query on 'sugar' db...");
        const res = await queryAdminDB(query.replace(/prestige/g, 'sugar'));
        console.log("Success! Returned rows:", res.length);
        if (res.length > 0) console.log(res[0]);
    } catch(e) {
        console.error("Query failed:", e.message);
    }
}
test().catch(console.error);
