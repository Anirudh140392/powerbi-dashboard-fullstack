import { createClient } from '@clickhouse/client';

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'mars'
});

const query = `
WITH curr_pdp AS (
    SELECT
        multiIf(LOWER(Location) IN ('gurgaon','gurugram'), 'gurugram', LOWER(Location) IN ('bangalore','bengaluru'), 'bengaluru', LOWER(Location)) AS city,
        LOWER(Platform) AS platform,
        if(Category IS NOT NULL AND Category != '' AND Category != '0' AND Category != '-', LOWER(toString(Category)), multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m', 'm&m''s'), if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%', 'Chocolates (Gifting)', 'Chocolates (Non Gifting)'), 'Others')) AS category,
        LOWER(Product) AS skuName,
        Brand AS brandName,
        Web_Pid AS webPid,
        SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS totalSales,
        SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS totalQtySold,
        argMax(toFloat64OrZero(toString(MRP)), DATE) AS currentMrp
    FROM rb_pdp_olap
    WHERE DATE BETWEEN '2026-05-01' AND '2026-05-13'
      AND Comp_flag IN (0, '0')
      AND Product IS NOT NULL AND Product != ''
      AND 1=1
      AND 1=1
      AND 1=1
    GROUP BY city, platform, category, skuName, brandName, webPid
),
curr_po AS (
    SELECT 
        multiIf(LOWER(city) IN ('gurgaon','gurugram'), 'gurugram', LOWER(city) IN ('bangalore','bengaluru'), 'bengaluru', LOWER(city)) AS city,
        LOWER(platform) AS platform,
        web_pid AS webPid,
        ROUND(
            SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 /
            nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0),
        1) AS osa,
        (SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) AS osa_ratio,
        argMax(po_status, po_raised_date) AS poStatus,
        argMax(po_raised_date, po_raised_date) AS poRaisedDate,
        argMax(po_expiry_date, po_raised_date) AS poExpiryDate,
        argMax(toFloat64OrZero(toString(DIH)), po_raised_date) AS dih
    FROM rb_po_olap
    WHERE po_raised_date BETWEEN '2026-05-01' AND '2026-05-13'
      AND sku_name IS NOT NULL AND sku_name != ''
      AND 1=1
      AND 1=1
    GROUP BY city, platform, webPid
),
curr_combined AS (
    SELECT 
        p.city, p.platform, p.category, p.skuName, p.brandName, p.webPid,
        po.osa AS osa, p.totalSales,
        po.poStatus AS actualPoStatus,
        po.poRaisedDate AS actualPoRaisedDate,
        po.poExpiryDate AS poExpiryDate,
        LOWER(po.poStatus) IN ('scheduled', 'unscheduled') AS isEligible,
        ROUND(
            ((p.totalQtySold / greatest(1, dateDiff('day', toDate('2026-05-01'), toDate('2026-05-13')) + 1)) * 7 * p.currentMrp) 
            * (1 - ifNull(po.osa_ratio, 1)) 
            * greatest(0, (7 - ifNull(po.dih, 0)) / 7.0),
        0) AS projectedSalesLoss
    FROM curr_pdp p
    LEFT JOIN curr_po po 
      ON p.city = po.city AND p.platform = po.platform AND p.webPid = po.webPid
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
),
prev AS (
    SELECT
        multiIf(LOWER(Location) IN ('gurgaon','gurugram'), 'gurugram', LOWER(Location) IN ('bangalore','bengaluru'), 'bengaluru', LOWER(Location)) AS city,
        LOWER(Platform) AS platform,
        if(Category IS NOT NULL AND Category != '' AND Category != '0' AND Category != '-', LOWER(toString(Category)), multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m', 'm&m''s'), if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%', 'Chocolates (Gifting)', 'Chocolates (Non Gifting)'), 'Others')) AS category,
        LOWER(Product) AS skuName,
        Web_Pid AS webPid,
        SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS prevTotalSales
    FROM rb_pdp_olap
    WHERE DATE BETWEEN '2026-04-18' AND '2026-04-30'
      AND Comp_flag IN (0, '0')
      AND Product IS NOT NULL AND Product != ''
      AND 1=1
      AND 1=1
      AND 1=1
    GROUP BY city, platform, category, skuName, webPid
),
prev_po AS (
    SELECT 
        multiIf(LOWER(city) IN ('gurgaon','gurugram'), 'gurugram', LOWER(city) IN ('bangalore','bengaluru'), 'bengaluru', LOWER(city)) AS city,
        LOWER(platform) AS platform,
        web_pid AS webPid,
        ROUND(
            SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 /
            nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0),
        1) AS prevOsa
    FROM rb_po_olap
    WHERE po_raised_date BETWEEN '2026-04-18' AND '2026-04-30'
      AND sku_name IS NOT NULL AND sku_name != ''
      AND 1=1
      AND 1=1
    GROUP BY city, platform, webPid
)
SELECT
    c.city, c.platform, c.category, c.skuName, c.brandName,
    c.osa, c.totalSales,
    if(
        c.isEligible = 1 AND (c.currentSalesRisk >= 0 AND c.daysToExpiry >= 0 AND c.daysToExpiry <= 14),
        c.projectedSalesLoss,
        0
    ) AS projectedSalesLoss,
    c.actualPoRaisedDate AS poRaisedDate,
    ifNull(po_prev.prevOsa, c.osa) AS prevOsa,
    (c.osa - ifNull(po_prev.prevOsa, c.osa)) AS osaChange,
    ifNull(p.prevTotalSales, 0) AS prevTotalSales,
    multiIf(
        c.isEligible = 0, 'low',
        (c.currentSalesRisk >= 0 AND c.daysToExpiry >= 0 AND c.daysToExpiry <= 14), 'high',
        'low'
    ) AS poStatus
FROM curr_with_risk c
LEFT JOIN prev p ON c.city = p.city AND c.platform = p.platform AND c.webPid = p.webPid
LEFT JOIN prev_po po_prev ON c.city = po_prev.city AND c.platform = po_prev.platform AND c.webPid = po_prev.webPid
HAVING poStatus = 'high' AND projectedSalesLoss > 0
ORDER BY projectedSalesLoss DESC
LIMIT 15;
`;

async function run() {
    try {
        const resultSet = await clickhouse.query({
            query,
            format: 'JSONEachRow'
        });
        const dataset = await resultSet.json();
        console.log("Returned rows:", dataset.length);
        console.log(dataset);
    } catch (e) {
        console.error(e);
    }
}
run();
