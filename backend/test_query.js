import { queryClickHouse } from './src/config/clickhouse.js';

const q = `
        WITH curr_pdp AS (
            SELECT
                if(empty(trim(Location)), '-', Location) AS city,
                Platform AS platform,
                Category AS category,
                Product AS skuName,
                Brand AS brandName,
                ROUND(
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 /
                    nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0),
                1) AS osa,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS totalSales,
                ROUND(
                    SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) *
                    ((100.0 / nullIf(
                        SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 /
                        nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0),
                    0)) - 1),
                0) AS projectedSalesLoss
            FROM rb_pdp_olap
            WHERE DATE >= '2023-01-01'
              AND Comp_flag IN (0, '0')
              AND Product IS NOT NULL AND Product != ''
            GROUP BY city, platform, category, skuName, brandName
        ),
        curr_po AS (
            SELECT 
                city,
                platform,
                sku_name AS skuName,
                argMax(po_status, created_on) AS poStatus,
                argMax(po_raised_date, created_on) AS poRaisedDate,
                argMax(po_expiry_date, created_on) AS poExpiryDate
            FROM rb_po_olap
            WHERE created_on >= '2023-01-01'
              AND sku_name IS NOT NULL AND sku_name != ''
            GROUP BY city, platform, skuName
        ),
        curr_combined AS (
            SELECT 
                p.city, p.platform, p.category, p.skuName, p.brandName,
                p.osa, p.totalSales, p.projectedSalesLoss,
                po.poStatus AS actualPoStatus,
                po.poRaisedDate AS actualPoRaisedDate,
                po.poExpiryDate AS poExpiryDate,
                po.poStatus IN ('Created', 'Unscheduled') AS isEligible
            FROM curr_pdp p
            LEFT JOIN curr_po po 
              ON p.city = po.city AND p.platform = po.platform AND p.skuName = po.skuName
        ),
        cohort_sales_risk AS (
            SELECT 
                city, actualPoStatus, actualPoRaisedDate, poExpiryDate,
                SUM(projectedSalesLoss) AS maxSalesRisk
            FROM curr_combined
            WHERE isEligible = 1
            GROUP BY city, actualPoStatus, actualPoRaisedDate, poExpiryDate
        ),
        curr_with_risk AS (
            SELECT 
                c.*,
                csr.maxSalesRisk,
                (c.projectedSalesLoss / nullIf(csr.maxSalesRisk, 0)) * 100 AS currentSalesRisk,
                dateDiff('day', today(), c.poExpiryDate) AS daysToExpiry
            FROM curr_combined c
            LEFT JOIN cohort_sales_risk csr 
              ON c.city = csr.city 
             AND c.actualPoStatus = csr.actualPoStatus 
             AND c.actualPoRaisedDate = csr.actualPoRaisedDate 
             AND c.poExpiryDate = csr.poExpiryDate
        )
        SELECT * FROM curr_with_risk LIMIT 5;
`;

queryClickHouse(q).then(console.log).catch(console.error);
