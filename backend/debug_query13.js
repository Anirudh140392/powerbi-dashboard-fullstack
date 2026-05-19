import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const q = `
        WITH curr_pdp AS (
            SELECT
                LOWER(trim(Location)) AS city,
                Platform AS platform,
                argMax(Web_Pid, DATE) AS webPid,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS totalSales,
                ROUND(SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) * ((100.0 / nullIf(SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 / nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0), 0)) - 1), 0) AS projectedSalesLoss
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '2026-04-01' AND '2026-05-13' AND Comp_flag IN (0, '0') AND Product IS NOT NULL AND Product != ''
            GROUP BY city, platform, Category, Product, Brand
        ),
        curr_po AS (
            SELECT 
                LOWER(trim(city)) AS city,
                platform,
                argMax(web_pid, created_on) AS webPid,
                argMax(po_status, created_on) AS poStatus,
                argMax(po_raised_date, created_on) AS poRaisedDate,
                argMax(po_expiry_date, created_on) AS poExpiryDate
            FROM rb_po_olap
            WHERE created_on BETWEEN '2026-04-01' AND '2026-05-13' AND sku_name IS NOT NULL AND sku_name != ''
            GROUP BY city, platform, sku_name
        ),
        curr_combined AS (
            SELECT 
                p.city, p.platform, p.webPid,
                po.poStatus AS actualPoStatus,
                po.poExpiryDate AS poExpiryDate,
                LOWER(po.poStatus) IN ('asn_created', 'unscheduled') AS isEligible
            FROM curr_pdp p
            JOIN curr_po po 
              ON p.city = po.city AND LOWER(p.platform) = LOWER(po.platform) AND LOWER(p.webPid) = LOWER(po.webPid)
        )
        SELECT actualPoStatus, count(*) as cnt FROM curr_combined GROUP BY actualPoStatus;
        `;
        const result = await queryClickHouse(q);
        console.log("Join by webPid counts:", result);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
