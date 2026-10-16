import { queryAdminDB } from './src/config/adminClickhouse.js';
import { getCWDateRange } from './src/services/categoryPerfSummaryDataService.js';

async function test() {
    try {
        const dbName = 'mars';
        const platform = 'Blinkit';
        
        const dateRange = await getCWDateRange(dbName, platform, 'rb_pdp_olap', true);
        console.log("Rolling Date Range:", dateRange);
        
        const cwStart = dateRange.cwStart;
        const query = `
            WITH
                week_boundaries AS (
                    SELECT toDate('${cwStart}') AS cw_start
                ),
                weekly_cat AS (
                    SELECT
                        if(Category IS NULL OR Category = '', 'UNCATEGORIZED', Category) AS cat,
                        if(DATE >= b.cw_start, 'cw', 'l4w') AS week_start,
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
                      AND lower(Platform) = '${platform.toLowerCase()}'
                      AND (Comp_flag = 0 OR Comp_flag IS NULL)
                      AND Category IS NOT NULL AND trim(Category) != '' AND trim(Category) != '0' AND trim(Category) != '-'
                      AND lower(trim(Category)) NOT IN ('uncategorized', 'other', 'others', 'undefined', 'null')
                    GROUP BY cat, week_start
                ),
                cw AS (
                    SELECT w.*
                    FROM weekly_cat w
                    CROSS JOIN week_boundaries b
                    WHERE w.week_start = 'cw'
                ),
                l4w AS (
                    SELECT
                        w.cat,
                        sum(w.qty)/4 AS qty,
                        sum(w.gmv)/4 AS gmv,
                        sum(w.disc_num) AS disc_num,
                        sum(w.disc_den) AS disc_den,
                        sum(w.osa_num) AS osa_num,
                        sum(w.osa_den) AS osa_den
                    FROM weekly_cat w
                    CROSS JOIN week_boundaries b
                    WHERE w.week_start = 'l4w'
                    GROUP BY w.cat
                )
            SELECT
                coalesce(c.cat, l.cat) AS CategoryName,
                ifNull(c.qty, 0) AS cw_qty, ifNull(c.gmv, 0) AS cw_gmv,
                ifNull(c.disc_num, 0) AS cw_disc_num, ifNull(c.disc_den, 0) AS cw_disc_den,
                ifNull(c.osa_num, 0) AS cw_osa_num, ifNull(c.osa_den, 0) AS cw_osa_den,
                ifNull(l.qty, 0) AS l4w_qty, ifNull(l.gmv, 0) AS l4w_gmv,
                ifNull(l.disc_num, 0) AS l4w_disc_num, ifNull(l.disc_den, 0) AS l4w_disc_den,
                ifNull(l.osa_num, 0) AS l4w_osa_num, ifNull(l.osa_den, 0) AS l4w_osa_den
            FROM cw c
            FULL OUTER JOIN l4w l ON c.cat = l.cat
        `;
        const res = await queryAdminDB(query);
        console.log(res);

    } catch (e) {
        console.error(e);
    }
}
test();
