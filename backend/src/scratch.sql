        WITH curr_pdp AS (
            SELECT
                multiIf(LOWER(Location) IN ('gurgaon','gurugram'), 'Gurugram', LOWER(Location) IN ('bangalore','bengaluru'), 'Bengaluru', initCap(Location)) AS city,
                Platform AS platform,
                category_placeholder AS category,
                Product AS skuName,
                Brand AS brandName,
                argMax(Web_Pid, DATE) AS webPid,
                ROUND(
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 /
                    nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0),
                1) AS osa,
                (SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) AS osa_ratio,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS totalSales,
                SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS totalQtySold,
                argMax(toFloat64OrZero(toString(MRP)), DATE) AS currentMrp
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND Comp_flag IN (0, '0')
              AND Product IS NOT NULL AND Product != ''
            GROUP BY city, platform, category, skuName, brandName
        ),
        curr_po AS (
            SELECT 
                multiIf(LOWER(city) IN ('gurgaon','gurugram'), 'Gurugram', LOWER(city) IN ('bangalore','bengaluru'), 'Bengaluru', initCap(city)) AS city,
                platform,
                sku_name AS skuName,
                argMax(web_pid, created_on) AS webPid,
                argMax(po_status, created_on) AS poStatus,
                argMax(po_raised_date, created_on) AS poRaisedDate,
                argMax(po_expiry_date, created_on) AS poExpiryDate,
                argMax(toFloat64OrZero(toString(dih)), created_on) AS dih
            FROM rb_po_olap
            WHERE created_on BETWEEN '${dateFrom}' AND '${dateTo}'
              AND sku_name IS NOT NULL AND sku_name != ''
            GROUP BY city, platform, skuName
        ),
        curr_combined AS (
            SELECT 
                p.city, p.platform, p.category, p.skuName, p.brandName, p.webPid,
                p.osa, p.totalSales,
                po.poStatus AS actualPoStatus,
                po.poRaisedDate AS actualPoRaisedDate,
                po.poExpiryDate AS poExpiryDate,
                LOWER(po.poStatus) IN ('asn_created', 'unscheduled') AS isEligible,
                
                ROUND(
                    ((p.totalQtySold / greatest(1, dateDiff('day', toDate('${dateFrom}'), toDate('${dateTo}')) + 1)) * 7 * p.currentMrp) 
                    * (1 - ifNull(p.osa_ratio, 1)) 
                    * greatest(0, (7 - ifNull(po.dih, 0)) / 7.0),
                0) AS projectedSalesLoss
            FROM curr_pdp p
            LEFT JOIN curr_po po 
              ON p.city = po.city AND LOWER(p.platform) = LOWER(po.platform) AND LOWER(p.webPid) = LOWER(po.webPid)
        )
