import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        console.log("Checking total POs in range...");
        const q1 = await queryClickHouse(`SELECT count(*) as cnt FROM rb_po_olap WHERE created_on BETWEEN '2026-04-01' AND '2026-05-13'`);
        console.log("Total POs:", q1);

        console.log("Checking eligible POs...");
        const q2 = await queryClickHouse(`SELECT po_status, count(*) as cnt FROM rb_po_olap WHERE created_on BETWEEN '2026-04-01' AND '2026-05-13' GROUP BY po_status`);
        console.log("Eligible POs by status:", q2);
        
        console.log("Checking joined PDP-PO data...");
        const q3 = `
            WITH curr_pdp AS (
                SELECT
                    if(empty(trim(Location)), '-', Location) AS city,
                    Platform AS platform,
                    Category AS category,
                    Product AS skuName,
                    Brand AS brandName,
                    SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS totalSales,
                    ROUND(
                        SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) *
                        ((100.0 / nullIf(
                            SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 /
                            nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0),
                        0)) - 1),
                    0) AS projectedSalesLoss
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '2026-04-01' AND '2026-05-13'
                  AND Comp_flag IN (0, '0')
                  AND Product IS NOT NULL AND Product != ''
                GROUP BY city, platform, category, skuName, brandName
            ),
            curr_po AS (
                SELECT 
                    if(empty(trim(city)), '-', city) AS city,
                    platform,
                    sku_name AS skuName,
                    argMax(po_status, created_on) AS poStatus,
                    argMax(po_expiry_date, created_on) AS poExpiryDate
                FROM rb_po_olap
                WHERE created_on BETWEEN '2026-04-01' AND '2026-05-13'
                  AND sku_name IS NOT NULL AND sku_name != ''
                GROUP BY city, platform, skuName
            )
            SELECT 
                po.poStatus AS actualPoStatus,
                dateDiff('day', today(), po.poExpiryDate) AS daysToExpiry,
                count(*) as cnt,
                SUM(p.projectedSalesLoss) as sumPsl
            FROM curr_pdp p
            JOIN curr_po po ON p.city = po.city AND LOWER(p.platform) = LOWER(po.platform) AND LOWER(p.skuName) = LOWER(po.skuName)
            GROUP BY actualPoStatus, daysToExpiry
            ORDER BY cnt DESC
            LIMIT 20;
        `;
        const r3 = await queryClickHouse(q3);
        console.log("Join result stats:", r3);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
