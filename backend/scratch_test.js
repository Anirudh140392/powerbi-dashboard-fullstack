import { queryAdminDB } from './src/config/adminClickhouse.js';

async function test() {
    const dbName = 'mars';
    const cwStart = '2026-08-09';
    const platform = 'Blinkit';
    
    console.log("Testing PDP...");
    try {
        const pdpQuery = `
            WITH
                week_boundaries AS (SELECT toDate('${cwStart}') AS cw_start),
                weekly_cat AS (
                    SELECT
                        if(Category IS NOT NULL AND trim(Category) != '' AND trim(Category) != '0' AND trim(Category) != '-', trim(Category), 'Uncategorized') AS cat,
                        subtractDays(DATE, toDayOfWeek(DATE) % 7) AS week_start,
                        SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS qty,
                        SUM(ifNull(toFloat64OrZero(toString(Selling_Price)), 0) * ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS gmv,
                        SUM((ifNull(toFloat64OrZero(toString(MRP)), 0) - ifNull(toFloat64OrZero(toString(Selling_Price)), 0)) * ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS disc_num,
                        SUM(ifNull(toFloat64OrZero(toString(MRP)), 0) * ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS disc_den,
                        SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) AS osa_num,
                        SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) AS osa_den
                    FROM \`${dbName}\`.rb_pdp_olap
                    CROSS JOIN week_boundaries b
                    WHERE DATE >= b.cw_start - INTERVAL 28 DAY
                      AND DATE < b.cw_start + INTERVAL 7 DAY
                      AND lower(Platform) = 'blinkit'
                      AND (Comp_flag = 0 OR Comp_flag IS NULL)
                      AND Category IS NOT NULL AND trim(Category) != '' AND trim(Category) != '0' AND trim(Category) != '-'
                      AND lower(trim(Category)) NOT IN ('uncategorized', 'other', 'others', 'undefined', 'null')
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
                        avg(w.qty) AS qty,
                        avg(w.gmv) AS gmv,
                        sum(w.disc_num) AS disc_num,
                        sum(w.disc_den) AS disc_den,
                        sum(w.osa_num) AS osa_num,
                        sum(w.osa_den) AS osa_den
                    FROM weekly_cat w
                    CROSS JOIN week_boundaries b
                    WHERE w.week_start >= b.cw_start - INTERVAL 28 DAY
                      AND w.week_start < b.cw_start
                    GROUP BY w.cat
                )
            SELECT
                coalesce(c.cat, l.cat) AS CategoryName,
                ifNull(c.qty, 0) AS cw_qty,
                ifNull(c.gmv, 0) AS cw_gmv,
                ifNull(l.qty, 0) AS l4w_qty,
                ifNull(l.gmv, 0) AS l4w_gmv
            FROM cw c
            FULL OUTER JOIN l4w l ON c.cat = l.cat
            LIMIT 10;
        `;
        const pdpRows = await queryAdminDB(pdpQuery);
        console.log("PDP Rows Full:", pdpRows);
    } catch (e) {
        console.error("PDP Query Failed:", e.message);
    }

    try {
        const brandSpendQuery = `
            WITH
                week_boundaries AS (SELECT toDate('${cwStart}') AS cw_start)
            SELECT
                brand,
                SUM(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) AS spend
            FROM \`${dbName}\`.rb_pm_olap
            CROSS JOIN week_boundaries b
            WHERE DATE >= b.cw_start - INTERVAL 28 DAY
              AND DATE < b.cw_start
              AND lower(Platform) = 'blinkit'
              AND lower(trim(category)) = 'gmfc'
            GROUP BY brand;
        `;
        const brandSpendRows = await queryAdminDB(brandSpendQuery);
        console.log("GMFC L4W Spend by Brand:", brandSpendRows);
    } catch (e) {
        console.error("Brand Spend Query Failed:", e.message);
    }

    console.log("Testing PM columns...");
    try {
        const pmQuery = `
            SELECT DISTINCT category, Category
            FROM \`${dbName}\`.rb_pm_olap
            LIMIT 1;
        `;
        const pmRows = await queryAdminDB(pmQuery);
        console.log("PM Columns:", pmRows);
    } catch (e) {
        console.error("PM Query Failed:", e.message);
    }
}
test();
