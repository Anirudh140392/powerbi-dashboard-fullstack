import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const q = `
        WITH curr_pdp AS (
            SELECT
                LOWER(trim(Location)) AS city,
                Platform AS platform,
                Category AS category,
                Product AS skuName,
                Brand AS brandName,
                ROUND(SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 / nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0), 1) AS osa,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS totalSales,
                ROUND(SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) * ((100.0 / nullIf(SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 / nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0), 0)) - 1), 0) AS projectedSalesLoss
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '2026-04-01' AND '2026-05-13' AND Comp_flag IN (0, '0') AND Product IS NOT NULL AND Product != ''
            GROUP BY city, platform, category, skuName, brandName
        ),
        curr_po AS (
            SELECT 
                LOWER(trim(city)) AS city,
                platform,
                sku_name AS skuName,
                argMax(po_status, created_on) AS poStatus,
                argMax(po_raised_date, created_on) AS poRaisedDate,
                argMax(po_expiry_date, created_on) AS poExpiryDate
            FROM rb_po_olap
            WHERE created_on BETWEEN '2026-04-01' AND '2026-05-13' AND sku_name IS NOT NULL AND sku_name != ''
            GROUP BY city, platform, skuName
        ),
        curr_combined AS (
            SELECT 
                p.city, p.platform, p.category, p.skuName, p.brandName,
                p.osa, p.totalSales, p.projectedSalesLoss,
                po.poStatus AS actualPoStatus,
                po.poExpiryDate AS poExpiryDate,
                LOWER(po.poStatus) IN ('asn_created', 'unscheduled') AS isEligible
            FROM curr_pdp p
            LEFT JOIN curr_po po 
              ON p.city = po.city AND LOWER(p.platform) = LOWER(po.platform) AND LOWER(p.skuName) = LOWER(po.skuName)
        ),
        cohort_sales_risk AS (
            SELECT 
                city, actualPoStatus, poExpiryDate,
                SUM(projectedSalesLoss) AS maxSalesRisk
            FROM curr_combined
            WHERE isEligible = 1
            GROUP BY city, actualPoStatus, poExpiryDate
        )
        SELECT 
            c.city, c.skuName, c.actualPoStatus, c.poExpiryDate,
            dateDiff('day', today(), c.poExpiryDate) AS daysToExpiry,
            c.projectedSalesLoss, csr.maxSalesRisk,
            (c.projectedSalesLoss / nullIf(csr.maxSalesRisk, 0)) * 100 AS currentSalesRisk
        FROM curr_combined c
        LEFT JOIN cohort_sales_risk csr 
          ON c.city = csr.city AND c.actualPoStatus = csr.actualPoStatus AND c.poExpiryDate = csr.poExpiryDate
        WHERE c.isEligible = 1
        LIMIT 10;
        `;
        const result = await queryClickHouse(q);
        console.log("Eligible POs evaluation:", result);
        
        const counts = await queryClickHouse(`SELECT LOWER(po_status) as st, count(*) as c FROM rb_po_olap GROUP BY st`);
        console.log("Status distribution:", counts);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
